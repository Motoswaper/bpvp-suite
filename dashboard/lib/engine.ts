import { fetchJSON } from "@/lib/api";
export async function getEngineStatus(){return fetchJSON<{engine:{height:number;version:string;modules:string[]}}>("/api/engine?path=/status");}
