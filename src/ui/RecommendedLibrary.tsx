import React from "react";
import type { ActivitiesDoc } from "../types";

type Props = {
  activities: ActivitiesDoc | null;
  frontierIds: string[];             // your nextMilestones ids
  onAdd: (activityId: string, targetNodeId: string) => void;
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export default function RecommendedLibrary({ activities, frontierIds, onAdd }: Props) {
  const frontier = new Set(frontierIds);

  const scored = React.useMemo(() => {
    if (!activities || !Array.isArray(activities.activities)) {
      console.warn("[Recommend] No activities loaded. Expected /data/activities/activities.json");
      return [];
    }
    // score activities: how many links hit the frontier (next milestones)
    return activities.activities
      .map((a: any) => {
        const links = asArray<{ nodeId: string; meetsExit?: boolean }>(a.links);
        const hits = links.filter(l => frontier.has(l.nodeId));
        const score = hits.length + (hits.some(h => h.meetsExit) ? 0.25 : 0); // tiny boost if marks exit
        return { a, score, firstHit: hits[0]?.nodeId || null };
      })
      .filter(x => x.score > 0)
      .sort((x, y) => y.score - x.score);
  }, [activities, frontierIds.join("|")]);

  if (frontier.size === 0) {
    return (
      <div style={{ color: "#6b7280", fontSize: 13 }}>
        No frontier milestones found yet. Check your completed state or pick a node to progress.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {scored.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          No activities match the current frontier. Adjust filters or add more activities.
        </div>
      ) : (
        scored.slice(0, 20).map(({ a, score, firstHit }) => (
          <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>
                {a.emoji ? a.emoji + " " : ""}
                {a.title}
              </div>
              <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>score {score.toFixed(2)}</div>
            </div>
            {a.links?.length ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                Targets:&nbsp;
                {a.links
                  .filter((l: any) => frontier.has(l.nodeId))
                  .map((l: any) => l.nodeId)
                  .join(", ")}
              </div>
            ) : null}
            <div style={{ marginTop: 8 }}>
              <button
                className="btn"
                onClick={() => {
                  const target = firstHit || frontierIds[0]; // fall back to first frontier id
                  if (!target) {
                    console.warn("[Recommend] Could not infer target node for activity", a.id);
                    alert("Could not add: no matching target for this activity in current frontier.");
                    return;
                  }
                  onAdd(a.id, target);
                }}
              >
                + Add to Today’s Plan
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}