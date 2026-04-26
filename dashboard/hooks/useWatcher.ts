"use client";
import { useEffect, useState } from "react";
import { getWatcherStatus } from "@/lib/watcher";
export function useWatcher(){const [data,setData]=useState<any>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); useEffect(()=>{getWatcherStatus().then(setData).catch((e)=>setError(e.message)).finally(()=>setLoading(false));},[]); return {data,loading,error};}
