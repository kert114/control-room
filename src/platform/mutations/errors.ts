export class OptimisticConcurrencyError extends Error {
  readonly code = "version_conflict" as const;

  constructor(
    readonly entityType: string,
    readonly entityId: string,
    readonly expectedVersion: number,
  ) {
    super(
      `This record changed since you opened it. Review the latest version before submitting.`,
    );
    this.name = "OptimisticConcurrencyError";
  }
}

export class BusinessRuleError extends Error {
  readonly code = "business_rule" as const;

  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "forbidden" | "version_conflict" | "business_rule"; message: string };
