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

/** Regions an operator can restrict a rollout to. ISO 3166-1 alpha-2 codes. */
export const REGIONS = [
  { code: "EE", label: "Estonia" },
  { code: "FI", label: "Finland" },
  { code: "LV", label: "Latvia" },
  { code: "LT", label: "Lithuania" },
  { code: "SE", label: "Sweden" },
  { code: "DE", label: "Germany" },
  { code: "NL", label: "Netherlands" },
  { code: "GB", label: "United Kingdom" },
] as const;

export type RegionCode = (typeof REGIONS)[number]["code"];

export const REGION_CODES = REGIONS.map((region) => region.code) as [RegionCode, ...RegionCode[]];

export const regionCodesSchema = z.array(z.enum(REGION_CODES)).max(REGIONS.length);

const COUNTRY_ATTRIBUTE = "country";

/** Countries the flag is restricted to; empty means every region in the rollout. */
export function regionsFromTargeting(rules: readonly TargetingRule[]): RegionCode[] {
  const rule = rules.find(
    (candidate) => candidate.attribute === COUNTRY_ATTRIBUTE && candidate.operator === "in",
  );
  if (!rule) {
    return [];
  }
  return REGION_CODES.filter((code) => rule.values.includes(code));
}

/** Replaces the country rule while leaving any other targeting rules untouched. */
export function withRegions(
  rules: readonly TargetingRule[],
  regions: readonly RegionCode[],
): TargetingRule[] {
  const others = rules.filter(
    (rule) => !(rule.attribute === COUNTRY_ATTRIBUTE && rule.operator === "in"),
  );
  if (regions.length === 0) {
    return others;
  }
  const ordered = REGION_CODES.filter((code) => regions.includes(code));
  return [...others, { attribute: COUNTRY_ATTRIBUTE, operator: "in", values: ordered }];
}

export function sameRegions(a: readonly RegionCode[], b: readonly RegionCode[]): boolean {
  return a.length === b.length && a.every((code) => b.includes(code));
}
