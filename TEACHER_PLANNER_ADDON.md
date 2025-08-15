
# Teacher Planner Add-on

This adds a minimal **Today · Plan · Review** workflow to your existing Vite + React genome visualizer.

## Run
```bash
npm install
npm run dev
# open http://localhost:5173/planner.html
```

## What’s included
- `src/planner/PlannerApp.tsx` – shell + tabs
- `src/planner/state/PlannerStore.tsx` – simple store with sample children, activities, schedule
- `src/planner/views/Today.tsx` – roster + schedule
- `src/planner/views/Plan.tsx` – activity library + schedule editing
- `src/planner/views/Review.tsx` – evidence draft stub

This is intentionally small and safe to drop in. It **does not modify** your main visualizer entry point.
