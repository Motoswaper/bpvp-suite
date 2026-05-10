"use client";

import { useState } from "react";

type TestnetGuestAccessProps = {
  idleLabel: string;
  busyLabel: string;
};

/**
 * Full document POST to /api/auth/register — the browser applies Set-Cookie and follows the 303.
 * Do not replace this with fetch(..., redirect: "manual"): Location is often hidden from JS,
 * so no navigation runs and the user stays on the home page.
 */
export function TestnetGuestAccess({ idleLabel, busyLabel }: TestnetGuestAccessProps) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-2">
      <form action="/api/auth/register?redirect=1" method="post" onSubmit={() => setBusy(true)}>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-5 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? busyLabel : idleLabel}
        </button>
      </form>
    </div>
  );
}
