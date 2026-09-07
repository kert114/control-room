import { describe, expect, it } from "vitest";

import { databaseSsl, poolConfig } from "@/platform/db/client";

describe("database TLS defaults", () => {
  it("requires verified TLS for a remote server", () => {
    expect(databaseSsl("postgresql://u:p@db.internal.example:5432/app")).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("leaves local development connections in cleartext", () => {
    expect(databaseSsl("postgresql://u:p@localhost:5432/app")).toBe(false);
    expect(databaseSsl("postgresql://u:p@127.0.0.1:5433/app")).toBe(false);
  });

  it("defers to an explicit sslmode in the connection string", () => {
    expect(databaseSsl("postgresql://u:p@db.example.com/app?sslmode=require")).toBeUndefined();
    expect(poolConfig("postgresql://u:p@db.example.com/app?sslmode=require", 2)).toEqual({
      connectionString: "postgresql://u:p@db.example.com/app?sslmode=require",
      max: 2,
    });
  });
});
