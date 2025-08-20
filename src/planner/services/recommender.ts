import type { Activity, Achievement } from './index';
import { deriveStateForChild } from './genomeEngine';
import { getGenomeIndex } from './index';

export function recommendForChild(activities: Activity[], childAchievements: Achievement[]) {
  try {
    const idx = getGenomeIndex();
    const derived = deriveStateForChild(idx, childAchievements);
    const frontier = new Set(derived.frontierAll);

    return activities
      .map(a => {
        const lvl = a.levels?.[1] ?? a.levels?.[0]; // prefer core, fallback to first level
        const targets = lvl?.targets || [];
        const frontierHits = targets.filter(t => frontier.has(t)).length;
        return { a, score: frontierHits };
      })
      .sort((x,y) => y.score - x.score)
      .map(x => x.a);
  } catch (e) {
    console.warn('[recommender] genome index missing, returning unranked activities');
    return activities;
  }
}
