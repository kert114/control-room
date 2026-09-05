import { and, eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { db, type Transaction } from "@/platform/db/client";
import { recordAuditEvent } from "@/platform/audit/record";
import type { AuditEventInput } from "@/platform/audit/events";
import {
  BusinessRuleError,
  OptimisticConcurrencyError,
  type MutationResult,
} from "@/platform/mutations/errors";
import { AuthorizationError } from "@/platform/authz/errors";

export interface MutationContext {
  tx: Transaction;
  audit: (input: AuditEventInput) => Promise<void>;
}

/**
 * Runs a business mutation and its audit events inside one database
 * transaction. Audit rows may only be written through `context.audit`, so a
 * mutation can never commit without its trail.
 */
export async function withBusinessTransaction<T>(
  handler: (context: MutationContext) => Promise<T>,
): Promise<MutationResult<T>> {
  try {
    const data = await db.transaction(async (tx) =>
      handler({ tx, audit: (input) => recordAuditEvent(tx, input) }),
    );
    return { ok: true, data };
  } catch (error: unknown) {
    if (error instanceof OptimisticConcurrencyError) {
      return { ok: false, code: "version_conflict", message: error.message };
    }
    if (error instanceof AuthorizationError) {
      return { ok: false, code: "forbidden", message: error.message };
    }
    if (error instanceof BusinessRuleError) {
      return { ok: false, code: "business_rule", message: error.message };
    }
    throw error;
  }
}

export interface VersionedColumns {
  id: PgColumn;
  version: PgColumn;
}

/** Matches a row by id only when its stored version is the one the caller read. */
export function versionedWhere(
  table: VersionedColumns,
  id: string,
  expectedVersion: number,
): SQL {
  const predicate = and(
    eq(table.id, id),
    eq(table.version, expectedVersion),
  );
  if (!predicate) {
    throw new Error("Failed to build versioned predicate.");
  }
  return predicate;
}

/** The value to `set` for a versioned update. */
export function bumpVersion(table: VersionedColumns): SQL<number> {
  return sql<number>`${table.version} + 1`;
}

/**
 * Converts an empty update result into an optimistic concurrency error: no row
 * matched means another writer changed the record first.
 */
export function assertRowUpdated<T>(
  rows: readonly T[],
  entityType: string,
  id: string,
  expectedVersion: number,
): T {
  const row = rows[0];
  if (!row) {
    throw new OptimisticConcurrencyError(entityType, id, expectedVersion);
  }
  return row;
}

export type { Transaction };
