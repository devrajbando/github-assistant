import { signIn, signOut, auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {session ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Signed in as: {"  "}
            <span className="font-medium text-gray-100">
              {session.user?.email}
            </span>
          </p>
          <div className="flex gap-3">
            <Link
              href="/repositories"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              View Repositories
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("github");
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Sign in with GitHub
          </button>
        </form>
      )}
    </div>
  );
}