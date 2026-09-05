import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  DEMO_MODE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  AUTH_MICROSOFT_ENTRA_ID_ID: z.string().min(1).optional(),
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().min(1).optional(),
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(
  source: Readonly<Record<string, string | undefined>> = process.env,
): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")} ${issue.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

export function isEntraConfigured(env: Env): boolean {
  return Boolean(
    env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
      env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  );
}

export function assertAuthProviderAvailable(env: Env): void {
  if (!env.DEMO_MODE && !isEntraConfigured(env)) {
    throw new Error(
      "No authentication provider available: set DEMO_MODE=true for synthetic sign-in or configure Microsoft Entra ID.",
    );
  }
}

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    cached = readEnv();
  }
  return cached;
}
