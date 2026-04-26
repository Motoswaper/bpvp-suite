import { Card } from "@/components/ui/card";
export function KpiCard({label,value}:{label:string;value:string|number}){return <Card title={label}><p className="text-2xl font-bold">{value}</p></Card>;}
