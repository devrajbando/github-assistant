// apps/web/src/lib/compute-repo-health.ts
import { prisma } from "database/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createGitHubClient } from "./github";

const execFileAsync = promisify(execFile);

export type HealthStatus = "NOT_COMPUTED" | "COMPUTING" | "COMPUTED" | "FAILED";

const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "c", "cpp", "h", "hpp", "cs", "rb", "php", "swift", "kt",
]);
const DOC_RATIO_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx"]);
const EXCLUDED_PATH_SUBSTRINGS = ["node_modules/", "dist/", "build/", ".next/", "generated/", "/.git/"];
const MAX_FILE_SIZE_BYTES = 200_000;
const HIGH_COMPLEXITY_THRESHOLD = 30; // decision points in a single file

// Deliberately conservative regex set — false negatives (missed decision
// points) are safer than false positives here, since this score is
// user-facing and needs to be defensible, not maximally sensitive.
const DECISION_POINT_PATTERNS: RegExp[] = [
  /\bif\s*\(/g, /\belif\b/g, /\belse\s+if\b/g,
  /\bfor\s*\(/g, /\bforeach\b/gi, /\bwhile\s*\(/g,
  /\bcase\s+/g, /\bcatch\s*[\(\{]/g, /\bexcept\b/g,
  /&&/g, /\|\|/g, /\?\?/g,
];

function extOf(path: string): string {
  const filename = path.split("/").pop() ?? "";
  return filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
}

function countDecisionPoints(content: string): number {
  return DECISION_POINT_PATTERNS.reduce(
    (sum, re) => sum + (content.match(re)?.length ?? 0),
    0
  );
}

// Very small heuristic: an export line is "documented" if a JSDoc block
// closes within the 3 lines immediately above it. Doesn't understand
// scoping or attach comments to the right symbol precisely — a proxy,
// not a real doc-linter.
function computeDocRatio(content: string): { exported: number; documented: number } {
  const lines = content.split("\n");
  let exported = 0;
  let documented = 0;

  const exportRe = /^\s*export\s+(default\s+)?(async\s+)?(function|class|const|interface|type)\b/;

  for (let i = 0; i < lines.length; i++) {
    if (exportRe.test(lines[i])) {
      exported++;
      const windowAbove = lines.slice(Math.max(0, i - 3), i).join("\n");
      if (windowAbove.includes("*/") && windowAbove.includes("/**")) {
        documented++;
      }
    }
  }

  return { exported, documented };
}

interface FetchedFile {
  path: string;
  content: string;
}

async function fetchRepoFiles(
  octokit: ReturnType<typeof createGitHubClient>,
  owner: string,
  repo: string,
  defaultBranch: string
): Promise<{ files: FetchedFile[]; hasReadme: boolean; packageLockContent: string | null; packageJsonContent: string | null }> {
  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: defaultBranch,
    recursive: "true",
  });

  const entries = (tree.tree ?? []).filter((item) => item.type === "blob" && item.path);

  const hasReadme = entries.some((e) => /^readme(\.\w+)?$/i.test(e.path!.split("/").pop() ?? ""));

  const codeEntries = entries.filter((e) => {
    if (EXCLUDED_PATH_SUBSTRINGS.some((s) => e.path!.includes(s))) return false;
    if (e.size !== undefined && e.size > MAX_FILE_SIZE_BYTES) return false;
    return CODE_EXTENSIONS.has(extOf(e.path!));
  });

  const files: FetchedFile[] = [];
  for (const entry of codeEntries) {
    const { data: blob } = await octokit.rest.git.getBlob({ owner, repo, file_sha: entry.sha! });
    files.push({ path: entry.path!, content: Buffer.from(blob.content, "base64").toString("utf-8") });
  }

  const lockEntry = entries.find((e) => e.path === "package-lock.json");
  const pkgEntry = entries.find((e) => e.path === "package.json");

  const packageLockContent = lockEntry
    ? Buffer.from((await octokit.rest.git.getBlob({ owner, repo, file_sha: lockEntry.sha! })).data.content, "base64").toString("utf-8")
    : null;
  const packageJsonContent = pkgEntry
    ? Buffer.from((await octokit.rest.git.getBlob({ owner, repo, file_sha: pkgEntry.sha! })).data.content, "base64").toString("utf-8")
    : null;

  return { files, hasReadme, packageLockContent, packageJsonContent };
}

function computeComplexity(files: FetchedFile[]) {
  const codeFiles = files.filter((f) => CODE_EXTENSIONS.has(extOf(f.path)));
  if (codeFiles.length === 0) return { avgCyclomaticComplexity: 0, highComplexityFileCount: 0 };

  const perFile = codeFiles.map((f) => 1 + countDecisionPoints(f.content));
  const avg = perFile.reduce((a, b) => a + b, 0) / perFile.length;
  const highCount = perFile.filter((c) => c > HIGH_COMPLEXITY_THRESHOLD).length;

  return { avgCyclomaticComplexity: avg, highComplexityFileCount: highCount };
}

function computeDocumentation(files: FetchedFile[], hasReadme: boolean) {
  const docFiles = files.filter((f) => DOC_RATIO_EXTENSIONS.has(extOf(f.path)));
  let exported = 0;
  let documented = 0;
  for (const f of docFiles) {
    const r = computeDocRatio(f.content);
    exported += r.exported;
    documented += r.documented;
  }
  const documentedExportRatio = exported > 0 ? documented / exported : 0;
  return { documentedExportRatio, hasReadme };
}

async function computeSecurity(packageJsonContent: string | null, packageLockContent: string | null) {
  if (!packageJsonContent || !packageLockContent) return null;

  const dir = await mkdtemp(join(tmpdir(), "health-audit-"));
  try {
    await writeFile(join(dir, "package.json"), packageJsonContent);
    await writeFile(join(dir, "package-lock.json"), packageLockContent);

    // npm audit exits non-zero when vulnerabilities are found — that's
    // expected, not a failure. --package-lock-only means no install, no
    // scripts run, just the lockfile checked against the advisory DB.
    let stdout = "";
    try {
      const result = await execFileAsync("npm", ["audit", "--package-lock-only", "--json"], { cwd: dir });
      stdout = result.stdout;
    } catch (err: any) {
      if (typeof err?.stdout === "string" && err.stdout.length > 0) {
        stdout = err.stdout;
      } else {
        throw err;
      }
    }

    const parsed = JSON.parse(stdout);
    const bySeverity = parsed.metadata?.vulnerabilities ?? {};
    return {
      critical: bySeverity.critical ?? 0,
      high: bySeverity.high ?? 0,
      moderate: bySeverity.moderate ?? 0,
      low: bySeverity.low ?? 0,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function computeActivity(
  octokit: ReturnType<typeof createGitHubClient>,
  owner: string,
  repo: string,
  repositoryId: string
) {
  let commitsLast90Days = 0;
  try {
    const { data: weeks } = await octokit.rest.repos.getCommitActivityStats({ owner, repo });
    if (Array.isArray(weeks)) {
      // ~13 weeks ≈ 90 days. GitHub sometimes returns 202 (stats being
      // computed) on first request — `weeks` won't be an array then, and
      // commitsLast90Days just stays 0 rather than throwing.
      commitsLast90Days = weeks.slice(-13).reduce((sum, w) => sum + (w.total ?? 0), 0);
    }
  } catch {
    // Stats endpoint can 202/fail transiently — activity degrades to 0
    // rather than failing the whole health computation over one signal.
  }

  const [mergedCount, closedCount] = await Promise.all([
    prisma.pullRequest.count({ where: { repositoryId, isMerged: true } }),
    prisma.pullRequest.count({ where: { repositoryId, state: "closed" } }),
  ]);
  const prMergeRate = closedCount > 0 ? mergedCount / closedCount : null;

  return { commitsLast90Days, prMergeRate };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function startRepoHealthComputation(repositoryId: string): Promise<void> {
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository) throw new Error(`Repository ${repositoryId} not found`);
  if (repository.healthStatus === "COMPUTING") {
    throw new Error("Health computation already in progress for this repository");
  }

  await prisma.repository.update({
    where: { id: repositoryId },
    data: { healthStatus: "COMPUTING", lastHealthError: null },
  });

  runHealthJob(repositoryId).catch((err) => {
    console.error(`Health computation failed for repository ${repositoryId}:`, err);
  });
}

async function runHealthJob(repositoryId: string): Promise<void> {
  try {
    const repository = await prisma.repository.findUniqueOrThrow({ where: { id: repositoryId } });
    const account = await prisma.account.findFirst({ where: { userId: repository.userId, provider: "github" } });
    if (!account?.access_token) throw new Error(`No GitHub account/token found for user ${repository.userId}`);

    const octokit = createGitHubClient(account.access_token);
    const { files, hasReadme, packageLockContent, packageJsonContent } = await fetchRepoFiles(
      octokit, repository.owner, repository.name, repository.defaultBranch
    );

    const complexity = computeComplexity(files);
    const documentation = computeDocumentation(files, hasReadme);
    const security = await computeSecurity(packageJsonContent, packageLockContent);
    const activity = await computeActivity(octokit, repository.owner, repository.name, repositoryId);

    const complexityScore = Math.round(clamp(100 - complexity.avgCyclomaticComplexity * 3, 0, 100));
    const documentationScore = Math.round(
      clamp((documentation.hasReadme ? 30 : 0) + documentation.documentedExportRatio * 70, 0, 100)
    );
    const activityScore = Math.round(
      clamp(
        activity.prMergeRate !== null
          ? clamp(activity.commitsLast90Days * 2, 0, 100) * 0.7 + activity.prMergeRate * 100 * 0.3
          : clamp(activity.commitsLast90Days * 2, 0, 100),
        0, 100
      )
    );
    const securityScore = security
      ? Math.round(clamp(100 - (security.critical * 25 + security.high * 10 + security.moderate * 3 + security.low * 1), 0, 100))
      : null;

    // Overall is the average of whatever was actually computed — security
    // is excluded (not zeroed) when there's no lockfile, so a non-npm
    // repo isn't penalized for a metric that doesn't apply to it.
    const scores = [complexityScore, documentationScore, activityScore, ...(securityScore !== null ? [securityScore] : [])];
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    await prisma.$transaction([
      prisma.repositoryHealthScore.upsert({
        where: { repositoryId },
        create: {
          repositoryId,
          overallScore,
          securityScore: securityScore, 
          vulnerabilityCriticalCount: security?.critical ?? 0,
          vulnerabilityHighCount: security?.high ?? 0,
          vulnerabilityModerateCount: security?.moderate ?? 0,
          vulnerabilityLowCount: security?.low ?? 0,
          complexityScore,
          avgCyclomaticComplexity: complexity.avgCyclomaticComplexity,
          highComplexityFileCount: complexity.highComplexityFileCount,
          documentationScore,
          documentedExportRatio: documentation.documentedExportRatio,
          hasReadme: documentation.hasReadme,
          activityScore,
          commitsLast90Days: activity.commitsLast90Days,
          prMergeRate: activity.prMergeRate,
        },
        update: {
          overallScore,
          securityScore: securityScore, 
          vulnerabilityCriticalCount: security?.critical ?? 0,
          vulnerabilityHighCount: security?.high ?? 0,
          vulnerabilityModerateCount: security?.moderate ?? 0,
          vulnerabilityLowCount: security?.low ?? 0,
          complexityScore,
          avgCyclomaticComplexity: complexity.avgCyclomaticComplexity,
          highComplexityFileCount: complexity.highComplexityFileCount,
          documentationScore,
          documentedExportRatio: documentation.documentedExportRatio,
          hasReadme: documentation.hasReadme,
          activityScore,
          commitsLast90Days: activity.commitsLast90Days,
          prMergeRate: activity.prMergeRate,
          computedAt: new Date(),
        },
      }),
      prisma.repository.update({
        where: { id: repositoryId },
        data: { healthStatus: "COMPUTED", lastHealthComputedAt: new Date(), lastHealthError: null },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.repository.update({
      where: { id: repositoryId },
      data: { healthStatus: "FAILED", lastHealthError: message },
    });
    throw err;
  }
}