import type { DecisionMode, Guardian } from "@/lib/types";

export interface DecisionChoice {
  mode: DecisionMode;
  guardian: Guardian | null;
}

/** Valid when "self", or when the supporter/guardian is named (and a guardian has attested). */
export function decisionReady(c: DecisionChoice): boolean {
  if (c.mode === "self") return true;
  if (!c.guardian?.name.trim() || !c.guardian.relationship.trim()) return false;
  return c.mode === "supported" || c.guardian.attested;
}
