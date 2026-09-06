import { z } from "zod";

import { openDocument } from "@/modules/kyc/documents";
import { kycModule } from "@/modules/kyc/module";
import { currentActor } from "@/platform/auth/session";
import { can } from "@/platform/authz/policy";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ documentId: z.string().uuid() });

/**
 * Streams a case document to a signed-in reviewer with `kyc.read`. Responses
 * are never cached so a revoked session cannot keep serving the file.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const actor = await currentActor();
  if (!actor) {
    return new Response("Sign in to view case documents.", { status: 401 });
  }
  if (!can(actor.role, kycModule.readPermission)) {
    return new Response("Your role cannot view case documents.", { status: 403 });
  }
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return new Response("Document not found.", { status: 404 });
  }
  const document = await openDocument(actor, parsed.data.documentId);
  if (!document) {
    return new Response("Document not found.", { status: 404 });
  }
  return new Response(document.body, {
    status: 200,
    headers: {
      "Content-Type": document.contentType,
      "Content-Length": String(document.body.byteLength),
      "Content-Disposition": `inline; filename="${document.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
