"use client";

import { useFormStatus } from "react-dom";

export function SyncButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Syncing..." : "Sync from GitHub"}
    </button>
  );
}