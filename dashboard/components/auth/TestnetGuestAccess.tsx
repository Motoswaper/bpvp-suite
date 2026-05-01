"use client";

type TestnetGuestAccessProps = {
  idleLabel: string;
  busyLabel: string;
};

export function TestnetGuestAccess({ idleLabel, busyLabel }: TestnetGuestAccessProps) {
  return (
    <div className="space-y-2">
      <form action="/api/auth/register?redirect=1" method="post">
        <button
          type="submit"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-5 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {idleLabel}
        </button>
      </form>
      <noscript>
        <p className="text-xs text-slate-400">{busyLabel}</p>
      </noscript>
    </div>
  );
}
