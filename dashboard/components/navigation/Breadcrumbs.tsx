export function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <p className="text-xs text-slate-400">
      {items.join(" / ")}
    </p>
  );
}
