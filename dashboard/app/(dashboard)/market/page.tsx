import { Navbar } from "@/components/layout/Navbar";
import { Card } from "@/components/ui/card";
import { DepthChart } from "@/components/charts/DepthChart";
export default function Page(){const data=[{price:1,bid:30,ask:20},{price:2,bid:42,ask:26},{price:3,bid:28,ask:31},{price:4,bid:18,ask:37}]; return <section className="space-y-4"><Navbar title="Market" /><Card title="Orderbooks, Trades, Depth"><DepthChart data={data} /></Card></section>;}
