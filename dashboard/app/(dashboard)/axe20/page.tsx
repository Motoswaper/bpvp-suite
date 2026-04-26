import { Navbar } from "@/components/layout/Navbar";
import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
export default function Page(){const rows=[["AXE","1,000,000","500 wallets"]]; return <section className="space-y-4"><Navbar title="AXE20" /><Card title="Tokens, Balances, Supply"><Table headers={["Token","Supply","Holders"]} rows={rows.map((r)=>r.map((v)=><span key={v}>{v}</span>))} /></Card></section>;}
