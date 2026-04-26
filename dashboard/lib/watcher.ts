import { fetchJSON } from "@/lib/api";
export async function getWatcherStatus(){return fetchJSON<{watcher:{lastSyncedHeight:number;actionsPushed:number}}>("/api/watcher?path=/status");}
