const label = process.env.NEXT_PUBLIC_BPVP_CHAIN_LABEL?.trim();

export function DeploymentBanner() {
  if (!label) {
    return null;
  }
  return (
    <div className="border-b border-amber-700/60 bg-amber-950/80 px-4 py-2 text-center text-sm text-amber-100">
      {label}
    </div>
  );
}
