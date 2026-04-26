"use client";
import { useEffect, useState } from "react";
import { getEngineStatus } from "@/lib/engine";
export function useEngine(){const [data,setData]=useState<any>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); useEffect(()=>{getEngineStatus().then(setData).catch((e)=>setError(e.message)).finally(()=>setLoading(false));},[]); return {data,loading,error};}
