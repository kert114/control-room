import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/platform/auth";
import { DEMO_PASSWORD, DEMO_USERS } from "@/platform/auth/demo";
import { currentActor } from "@/platform/auth/session";
import { env, isEntraConfigured } from "@/platform/config/env";
import { Button } from "@/platform/ui/button";
import { Panel } from "@/platform/ui/panel";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<React.ReactElement> {
  const actor = await currentActor();
  if (actor) {
    redirect("/overview");
  }

  const { error } = await searchParams;
  const config = env();
  const entraReady = isEntraConfigured(config);

  async function signInWithDemo(formData: FormData): Promise<void> {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await signIn("demo-credentials", {
        email,
        password,
        redirectTo: "/overview",
      });
    } catch (caught: unknown) {
      if (caught instanceof AuthError) {
        redirect("/signin?error=invalid_credentials");
      }
      throw caught;
    }
  }

  async function signInWithEntra(): Promise<void> {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: "/overview" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-[min(94vw,520px)] flex-col justify-center gap-4 py-8">
      <div>
        <h1 className="text-title font-medium text-ink">Control Room</h1>
        <p className="text-body text-muted">
          Internal operations platform. Access is granted per provisioned
          account and role.
        </p>
      </div>

      {config.DEMO_MODE ? (
        <Panel
          title="Demo sign-in"
          description="DEMO_MODE is on. These synthetic accounts and their data exist only for demonstration."
        >
          <form action={signInWithDemo} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-meta font-medium text-muted">
                Demo account
              </label>
              <select
                id="email"
                name="email"
                defaultValue={DEMO_USERS[0]?.email}
                className="h-11 rounded-control border border-line bg-panel px-2 text-body text-ink"
              >
                {DEMO_USERS.map((user) => (
                  <option key={user.email} value={user.email}>
                    {user.name} — {user.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="password"
                className="text-meta font-medium text-muted"
              >
                Demo password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                defaultValue={DEMO_PASSWORD}
                className="h-11 rounded-control border border-line bg-panel px-2 text-body text-ink"
              />
            </div>
            {error ? (
              <p role="alert" className="text-body text-danger">
                That demo account and password did not match. Try again.
              </p>
            ) : null}
            <Button type="submit" size="narrow">
              Sign in to Control Room
            </Button>
          </form>
        </Panel>
      ) : null}

      {entraReady ? (
        <Panel
          title="Single sign-on"
          description="Use your organisation account."
        >
          <form action={signInWithEntra}>
            <Button type="submit" size="narrow" variant="secondary">
              Continue with Microsoft Entra ID
            </Button>
          </form>
        </Panel>
      ) : null}
    </main>
  );
}
