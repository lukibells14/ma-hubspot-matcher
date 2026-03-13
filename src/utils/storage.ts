import { get, set, del } from "idb-keyval";
import type { RowObject } from "../types";

const KEY = "hubspot_cache_v1";

export type HubspotCache = {
  savedAt: number;
  columns: string[];
  rows: RowObject[];
};

export async function loadHubspotCache(): Promise<HubspotCache | null> {
  return (await get(KEY)) ?? null;
}

export async function saveHubspotCache(cache: HubspotCache): Promise<void> {
  await set(KEY, cache);
}

export async function clearHubspotCache(): Promise<void> {
  await del(KEY);
}
