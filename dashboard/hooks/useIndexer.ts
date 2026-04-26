"use client";
import { useEffect, useState } from "react";
import { getIndexerStatus } from "@/lib/indexer";
export function useIndexer(){const [data,setData]=useState<any>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); useEffect(()=>{getIndexerStatus().then(setData).catch((e)=>setError(e.message)).finally(()=>setLoading(false));},[]); return {data,loading,error};}
