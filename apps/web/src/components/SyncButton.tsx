"use client";

import { useFormStatus } from "react-dom";
import { rockerBtnClass } from "@/lib/ui-classes";

type SyncButtonProps = {
  label?: string;
  pendingLabel?: string;
};

export default function SyncButton({
  label = "Sync from GitHub",
  pendingLabel = "Syncing…",
}: SyncButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${rockerBtnClass} ${pending ? "cursor-wait opacity-70 hover:shadow-none" : ""}`}
    >
      <span
        className={`h-2 w-2 rounded-full bg-console ${pending ? "pulse-dot" : ""}`}
        aria-hidden="true"
      />
      {pending ? pendingLabel : label}
    </button>
  );
}