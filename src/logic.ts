/**
 * Tiny gate evaluator to power cross-domain readiness.
 * Expression DSL supports:
 *  - level('NODE_ID') : number in [0,2]  (0=not started, 1=emerging, 2=mastered)
 *  - confidence('NODE_ID') : number (0..1)
 *  - age() : months (number)
 * Operators: > >= < <= && || ( ) and numbers
 *
 * You can wire real child data here. For now we expose a default state provider
 * that marks mastered when exit criteria met in a portfolio, or all zeros if none.
 */

import { Gate } from "./types";

export type StateProvider = {
  level: (nodeId: string) => number;
  confidence: (nodeId: string) => number;
  ageMonths: () => number;
};

// naive default: everything 0, age unknown -> 0
export const makeDefaultState = (ageM = 0): StateProvider => ({
  level: () => 0,
  confidence: () => 0,
  ageMonths: () => ageM,
});

// very small expression evaluator (safe subset)
export function evalGateExpr(expr: string, state: StateProvider): boolean {
  // token replacement
  const replaced = expr
    .replace(/age\(\)/g, String(state.ageMonths()))
    .replace(/level\(\s*'([^']+)'\s*\)/g, (_, id) => String(state.level(id)))
    .replace(/confidence\(\s*'([^']+)'\s*\)/g, (_, id) =>
      String(state.confidence(id))
    );

  // whitelist check (only numbers, operators, parentheses, spaces, dots)
  if (!/^[\d\s\.\+\-\*\/\(\)<>=&|!]+$/.test(replaced)) {
    // Allow && and || explicitly
    const allowed = replaced.replace(/&&/g, "").replace(/\|\|/g, "");
    if (!/^[\d\s\.\+\-\*\/\(\)<>=!]+$/.test(allowed)) {
      console.warn("Blocked unsafe expr:", expr, "->", replaced);
      return false;
    }
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${replaced});`);
    const out = fn();
    return Boolean(out);
  } catch (e) {
    console.warn("Gate eval error:", e, { expr, replaced });
    return false;
  }
}

// Decide readiness score for a node (0..1); include gates as boosts/blocks.
export function readinessScore(
  nodeId: string,
  gates: Gate[] | undefined,
  state: StateProvider
): number {
  if (!gates || gates.length === 0) return 0.5; // neutral default
  let score = 0.5;
  for (const g of gates) {
    const passed = evalGateExpr(g.expr, state);
    if (g.kind === "prereq") {
      if (!passed) return 0; // hard stop
      score = Math.max(score, 0.6);
    } else if (g.kind === "block") {
      if (passed) return 0; // blocked
    } else if (g.kind === "boost") {
      if (passed) score = Math.min(1, score + 0.2);
    }
  }
  return score;
}