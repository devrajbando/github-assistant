'use server'
import { auth } from "@/auth";
import { prisma } from "database/client";
import { syncRepositoriesAction } from "@/lib/actions";
import { redirect } from "next/navigation";
import { SyncButton } from "@/components/SyncButton";
import Link from "next/link";

export default async function RepositoriesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const repositories = await prisma.repository.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-100">
          Your Repositories
        </h1>
        <form
          action={async () => {
            "use server";
            await syncRepositoriesAction();
          }}
        >
          <SyncButton />
        </form>
      </div>

      {repositories.length === 0 ? (
        <p className="text-sm text-gray-500">
          No repositories synced yet — click &quot;Sync from GitHub&quot; above.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
  {repositories.map((repo) => (
    <li key={repo.id}>
      <Link
        href={`/repositories/${repo.id}`}
        className="flex items-center justify-between px-4 py-3 text-gray-200  hover:bg-gray-50 hover:text-gray-900"
      >
        <span className="text-sm font-medium ">
          {repo.fullName}
        </span>
        {repo.isPrivate && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            private
          </span>
        )}
      </Link>
    </li>
  ))}
</ul>
      )}
    </div>
  );
}