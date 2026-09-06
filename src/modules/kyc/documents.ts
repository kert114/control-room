import { eq } from "drizzle-orm";

import { assertPermission } from "@/modules/kyc/rules";
import { formatDate } from "@/modules/kyc/ui/presentation";
import type { Actor } from "@/platform/auth/session";
import { db } from "@/platform/db/client";
import { kycCaseDocuments, kycCases } from "@/platform/db/schema";

/** Route that streams a case document to an authorised reviewer. */
export function documentHref(documentId: string): string {
  return `/kyc/documents/${documentId}`;
}

export interface StoredDocument {
  body: ArrayBuffer;
  contentType: string;
  filename: string;
}

export interface DocumentRecord {
  id: string;
  caseId: string;
  caseReference: string;
  customerAlias: string;
  documentType: string;
  status: "received" | "verified" | "rejected" | "expired";
  receivedAt: Date;
}

/**
 * Storage backend for document objects. Production wires this to the blob
 * store; the demo backend renders a clearly
 * labelled synthetic PDF for each record so the flow is exercisable end to end.
 */
export interface DocumentStore {
  get(document: DocumentRecord): Promise<StoredDocument | null>;
}

function pdfEscape(text: string): string {
  return text.replace(/[\\()]/g, (match) => `\\${match}`);
}

/** Minimal single-page PDF 1.4 with Helvetica text; no external dependencies. */
export function renderTextPdf(lines: readonly string[]): ArrayBuffer {
  const content = [
    "BT",
    "/F1 18 Tf",
    "56 780 Td",
    "22 TL",
    ...lines.map((line, index) =>
      `(${pdfEscape(line)}) Tj T*${index === 0 ? " /F1 11 Tf" : ""}`,
    ),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1")).buffer;
}

const DOCUMENT_BODY: Readonly<Record<string, readonly string[]>> = {
  "certificate of incorporation": [
    "Registry extract confirming the entity is incorporated and active.",
    "Registered number: 00000000 (synthetic)",
    "Registered office: 1 Example Street, Demo City",
    "Directors: listed on the accompanying identity document.",
  ],
  "director identity document": [
    "Government-issued photo identity document for the named director.",
    "Document number: X0000000 (synthetic)",
    "Expiry: valid at the date of receipt.",
    "Photograph and MRZ withheld from this rendering.",
  ],
  "proof of registered address": [
    "Utility statement dated within the last three months.",
    "Address: 1 Example Street, Demo City (synthetic)",
    "Issuer: Demo Utilities Ltd.",
  ],
};

export const syntheticDocumentStore: DocumentStore = {
  async get(document) {
    const body =
      DOCUMENT_BODY[document.documentType.toLowerCase()] ?? [
        "Supporting document supplied by the customer.",
      ];
    const lines = [
      `${document.documentType} \u2014 ${document.caseReference}`,
      "SYNTHETIC DEMO DOCUMENT. Not a real record; all details are fictional.",
      "",
      `Customer: ${document.customerAlias}`,
      `Received: ${formatDate(document.receivedAt)}`,
      `Review status: ${document.status}`,
      `Document ID: ${document.id}`,
      "",
      ...body,
    ];
    return {
      body: renderTextPdf(lines),
      contentType: "application/pdf",
      filename: `${document.caseReference}-${document.documentType
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}.pdf`,
    };
  },
};

/** The document row with its case context; null when it does not exist. */
export async function loadDocument(
  actor: Actor,
  documentId: string,
): Promise<DocumentRecord | null> {
  assertPermission(actor, "kyc.read");
  const rows = await db
    .select({
      id: kycCaseDocuments.id,
      caseId: kycCaseDocuments.caseId,
      caseReference: kycCases.reference,
      customerAlias: kycCases.customerAlias,
      documentType: kycCaseDocuments.documentType,
      status: kycCaseDocuments.status,
      receivedAt: kycCaseDocuments.receivedAt,
    })
    .from(kycCaseDocuments)
    .innerJoin(kycCases, eq(kycCases.id, kycCaseDocuments.caseId))
    .where(eq(kycCaseDocuments.id, documentId))
    .limit(1);
  return rows[0] ?? null;
}

/** Fetches a document for an authorised actor from the configured store. */
export async function openDocument(
  actor: Actor,
  documentId: string,
  store: DocumentStore = syntheticDocumentStore,
): Promise<StoredDocument | null> {
  const record = await loadDocument(actor, documentId);
  return record ? store.get(record) : null;
}
