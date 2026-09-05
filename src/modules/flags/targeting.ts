import { z } from "zod";

export const TARGETING_OPERATORS = ["in", "not_in", "equals"] as const;

export type TargetingOperator = (typeof TARGETING_OPERATORS)[number];

const attributePattern = /^[a-z][a-z0-9_]{0,39}$/;

export const targetingRuleSchema = z.object({
  attribute: z
    .string()
    .regex(attributePattern, "Attribute must be a lower-case identifier."),
  operator: z.enum(TARGETING_OPERATORS),
  values: z.array(z.string().min(1).max(40)).min(1).max(20),
});

/** Shape of the `feature_flags.targeting` jsonb column. */
export const targetingSchema = z.array(targetingRuleSchema).max(20);

export type TargetingRule = z.infer<typeof targetingRuleSchema>;

export function parseTargeting(value: unknown): TargetingRule[] {
  return targetingSchema.parse(value);
}

const OPERATOR_LABEL: Record<TargetingOperator, string> = {
  in: "is one of",
  not_in: "is not one of",
  equals: "equals",
};

export function describeTargetingRule(rule: TargetingRule): string {
  return `${rule.attribute} ${OPERATOR_LABEL[rule.operator]} ${rule.values.join(", ")}`;
}
