import { fetchJSON } from "@/lib/api";
export async function getIndexerStatus(){return fetchJSON<{indexer:{height:number;processedBlocks:number}}>("/api/indexer?path=/status");}
