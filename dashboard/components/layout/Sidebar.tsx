import { Menu } from "@/components/navigation/Menu";

export function Sidebar() {
  return (
    <aside className="border-r border-slate-800 p-4">
      <h1 className="mb-6 text-xl font-bold">AXE Market Suite</h1>
      <Menu />
    </aside>
  );
}
