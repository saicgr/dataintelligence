import "server-only";
import { GENERATED_PROMPTOPT } from "./promptopt-scenarios.generated.server";

/**
 * SERVER-ONLY answer key for the Prompt Optimization track ("promptlab").
 *
 * The labeled outputs live here and are resolved by problemId inside
 * /api/practice/prompt-opt. They are NEVER shipped to the client — the browser
 * only ever sees per-row correct/incorrect + an accuracy %, never the label
 * strings. The `import "server-only"` above is the enforcement boundary: any
 * client bundle that tries to import this module fails the build.
 *
 * `labels` is index-aligned to the matching item's `promptOpt.rows`.
 */
export interface PromptOptScenario {
  /** Expected output per row, aligned to item.promptOpt.rows[i]. */
  labels: string[];
  /** How a row is scored. "exact": trimmed/lowercased equality; "contains":
   *  label appears in output; "judge": a single batched LLM-as-judge call. */
  metric: "exact" | "contains" | "judge";
  /** Criteria for the judge metric. */
  judgeCriteria?: string;
  /** Accuracy % required to count as solved (mirrors the client `target`). */
  target: number;
}

const SEED: Record<string, PromptOptScenario> = {
  "pl-ticket-routing": {
    metric: "exact",
    target: 88,
    labels: [
      "billing", // duplicate charge refund
      "technical", // export spins forever
      "account", // password reset / locked out
      "billing", // invoice jumped in price
      "technical", // 500 error across team
      "account", // change email on account
      "billing", // annual billing / discount
      "account", // cancel + delete workspace
      "technical", // mobile app crashes
      "account", // teammate seat deactivated
    ],
  },
  "pl-intent-detect": {
    metric: "exact",
    target: 88,
    labels: [
      "track_order", // delivered but missing
      "refund", // money back broken blender
      "change_address", // update shipping address
      "cancel", // cancel order
      "other", // ship to Canada
      "refund", // damaged, demand money back
      "change_address", // change delivery address
      "cancel", // stop subscription
      "track_order", // when will it arrive
      "track_order", // furious but still wants item — where is it
    ],
  },
  "pl-toxicity-nuance": {
    metric: "exact",
    target: 88,
    labels: [
      "clean", // sarcastic but civil — sarcasm is not toxicity
      "toxic", // get lost nobody wants you — targeted
      "clean", // civil disagreement with data
      "clean", // harsh PRODUCT review (not a personal attack) — the key false-positive class
      "clean", // praise
      "toxic", // you people are idiots
      "clean", // asking for clarification
      "toxic", // veiled threat
      "clean", // frustrated product feedback
      "toxic", // targeted insult "moron", calls a person incompetent
    ],
  },
};

const ALL: Record<string, PromptOptScenario> = { ...GENERATED_PROMPTOPT, ...SEED };

export function getPromptOptScenario(problemId: string): PromptOptScenario | null {
  return ALL[problemId] ?? null;
}
