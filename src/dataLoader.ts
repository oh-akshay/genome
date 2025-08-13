// src/dataLoader.ts
import type { Genome, Activity, ActivityIndex } from './types'

function publicUrl(path: string) {
  // Works even if the app is deployed under a sub-path (e.g., GitHub Pages)
  const base = (import.meta as any)?.env?.BASE_URL || '/'
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = publicUrl(path)
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`)
  try {
    return await res.json()
  } catch (e: any) {
    throw new Error(`Invalid JSON at ${url}: ${e.message}`)
  }
}

export async function loadGenome(): Promise<Genome> {
  return fetchJson<Genome>('data/genome.json')
}

export async function loadActivities(): Promise<ActivityIndex> {
  // Try /data/activities/activities.json first, then fall back to /data/activities.json
  let data: { activities: Activity[] } | null = null
  let lastErr: any = null
  for (const p of ['data/activities/activities.json', 'data/activities.json']) {
    try {
      data = await fetchJson<{ activities: Activity[] }>(p)
      break
    } catch (e) { lastErr = e }
  }
  if (!data) throw lastErr || new Error('activities.json not found')
  const idx: ActivityIndex = {}
  for (const a of data.activities) idx[a.id] = a
  return idx
}