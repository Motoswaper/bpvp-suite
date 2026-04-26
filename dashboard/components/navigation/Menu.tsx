import Link from "next/link";
const items=[["Overview","/"],["AXE20","/axe20"],["AXE721","/axe721"],["Market","/market"],["Trust","/trust"],["Lend","/lend"],["Settle","/settle"],["Profile","/profile"]] as const;
export function Menu(){return <nav className="space-y-2">{items.map(([label,href])=><Link key={href} href={href} className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">{label}</Link>)}</nav>;}
