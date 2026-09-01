"use client";

import { useFormStatus } from "react-dom";
import { rockerBtnClass } from "@/lib/ui-classes";

type SyncButtonProps = {
  label?: string;
  pendingLabel?: string;
  lastSyncedAt?: string | null;
};

export default function SyncButton({
  label = "Sync from GitHub",
  pendingLabel = "Syncing…",
  lastSyncedAt = null,
}: SyncButtonProps) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`relative overflow-hidden ${rockerBtnClass} ${
          pending ? "cursor-wait opacity-70 hover:shadow-none" : ""
        }`}
      >
        {/* The dot only ever meant "loading" — showing it at rest was
            decorative noise, so it's now scoped to the pending state
            it's actually communicating. */}
        {pending && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-console pulse-dot"
            aria-hidden="true"
          />
        )}
        {pending ? pendingLabel : label}

        {pending && (
          <span
            className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-console/20"
            aria-hidden="true"
          >
            <span className="progress-sweep block h-full w-1/3 rounded-full bg-console" />
          </span>
        )}
      </button>

      {!pending && lastSyncedAt && (
        <p className="font-mono-ui text-[10.5px] text-paper-dim">
          Synced {new Date(lastSyncedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}