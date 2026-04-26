import { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function Card({title,children,className}:{title:string;children:ReactNode;className?:string}){return <section className={cn("rounded-xl border border-slate-800 bg-[#101523] p-4",className)}><h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>{children}</section>;}
