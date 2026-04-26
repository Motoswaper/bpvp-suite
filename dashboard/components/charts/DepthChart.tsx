"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
export function DepthChart({data}:{data:{price:number;bid:number;ask:number}[]}){return <div className="h-64 w-full"><ResponsiveContainer><AreaChart data={data}><XAxis dataKey="price" /><YAxis /><Tooltip /><Area dataKey="bid" stroke="#3b82f6" fill="#3b82f644" /><Area dataKey="ask" stroke="#ef4444" fill="#ef444444" /></AreaChart></ResponsiveContainer></div>;}
