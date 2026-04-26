import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>){return <button {...props} className={cn("rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50",props.className)} />;}
