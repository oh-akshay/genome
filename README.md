# Learning Genome - Pro Visualizer

Run:
  npm i
  npm run dev   # http://localhost:5180

Features: D3 pan/zoom, ladders, gate-aware next steps, node detail panel (level/confidence/evidence), age slider, import/export.

Templates:
- Genome template: `public/data/templates/genome.template.json`
- Activities template: `public/data/templates/activities.template.json`

Icons / emojis:
- Emoji for nodes are inferred from `tags` (fallback to `domain`) via `public/data/metadata/icons.json`.
