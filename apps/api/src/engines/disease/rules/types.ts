// Shared result shape for condition rules added with the 10-condition expansion.
// The two original rules (diabetes.ts, hypertension.ts) predate this file and keep their own
// structurally-identical result interfaces — untouched for backward compatibility.

export interface ConditionRuleResult {
  triggered: boolean;
  severity: 'warning' | 'caution' | null;
  message: string | null;
  citationIds: string[];
}

export const NOT_TRIGGERED: ConditionRuleResult = {
  triggered: false,
  severity: null,
  message: null,
  citationIds: [],
};
