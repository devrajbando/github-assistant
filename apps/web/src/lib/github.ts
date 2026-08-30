import { Octokit } from "octokit";

export function createGitHubClient(accessToken: string) {
  return new Octokit({ auth: accessToken });
}