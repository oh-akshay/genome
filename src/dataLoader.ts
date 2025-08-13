import { ActivitiesDoc, Genome } from "./types";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

export async function loadGenome(): Promise<Genome> {
  // Your app serves files under /data/...
  return fetchJSON<Genome>("/data/genome.json");
}

export async function loadActivities(): Promise<ActivitiesDoc | null> {
  // Try nested path first, then flat fallback
  try {
    return await fetchJSON<ActivitiesDoc>("/data/activities/activities.json");
  } catch {
    try {
      return await fetchJSON<ActivitiesDoc>("/data/activities.json");
    } catch {
      return null;
    }
  }
}

export async function loadIcons(): Promise<Record<string, string>> {
  try {
    const data = await fetchJSON<{ defaults: Record<string, string> }>(
      "/data/metadata/icons.json"
    );
    return data.defaults || {};
  } catch {
    return {};
  }
}

export async function loadDomainOrder(): Promise<string[]> {
  try {
    const data = await fetchJSON<{ domains: Array<{ id: string }> }>(
      "/data/domains.json"
    );
    return (data.domains || []).map((d) => d.id);
  } catch {
    return [];
  }
}

export type DomainMeta = { id: string; name: string; emoji?: string };
export async function loadDomains(): Promise<DomainMeta[]> {
  try {
    const data = await fetchJSON<{ domains: DomainMeta[] }>(
      "/data/domains.json"
    );
    return data.domains || [];
  } catch {
    return [];
  }
}
