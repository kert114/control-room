// Synthetic, in-memory KYC data for the disposable UI direction prototype.

export type RiskLevel = "high" | "medium" | "low";

export type CaseStatus =
  | "pending_review"
  | "awaiting_information"
  | "escalated"
  | "approved"
  | "rejected";

export type SignalSeverity = "critical" | "warning" | "info";

export type DocumentResult = "pass" | "fail" | "manual";

export interface RiskSignal {
  id: string;
  label: string;
  severity: SignalSeverity;
  detail: string;
  source: string;
}

export interface DocumentCheck {
  id: string;
  name: string;
  result: DocumentResult;
  detail: string;
  checkedAt: string;
}

export interface CaseNote {
  id: string;
  author: string;
  at: string;
  text: string;
}

export interface ActivityEvent {
  id: string;
  caseId: string;
  at: string;
  actor: string;
  text: string;
}

export interface KycCase {
  id: string;
  applicant: string;
  entityType: "Individual" | "Business";
  country: string;
  countryCode: string;
  riskLevel: RiskLevel;
  riskScore: number;
  status: CaseStatus;
  assignee: string;
  slaHoursRemaining: number;
  submittedAt: string;
  product: string;
  expectedMonthlyVolume: string;
  riskThesis: string;
  identity: {
    legalName: string;
    dateOfBirth: string;
    nationalId: string;
    email: string;
    phone: string;
    address: string;
    occupation: string;
  };
  signals: RiskSignal[];
  documents: DocumentCheck[];
  notes: CaseNote[];
  activity: ActivityEvent[];
}

export const ASSIGNEES = [
  "M. Duarte",
  "J. Okafor",
  "L. Bergman",
  "S. Petrova",
  "Unassigned",
] as const;

export const COUNTRIES = [
  "Estonia",
  "Nigeria",
  "United Kingdom",
  "Cyprus",
  "Germany",
  "United Arab Emirates",
  "Brazil",
  "Singapore",
] as const;

export const STATUS_LABEL: Record<CaseStatus, string> = {
  pending_review: "Pending review",
  awaiting_information: "Awaiting information",
  escalated: "Escalated",
  approved: "Approved",
  rejected: "Rejected",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
};

export const DEFAULT_CASE_ID = "KYC-4821";

function note(id: string, author: string, at: string, text: string): CaseNote {
  return { id, author, at, text };
}

function event(
  id: string,
  caseId: string,
  at: string,
  actor: string,
  text: string,
): ActivityEvent {
  return { id, caseId, at, actor, text };
}

export const CASES: KycCase[] = [
  {
    id: "KYC-4821",
    applicant: "Northwind Payments OÜ",
    entityType: "Business",
    country: "Estonia",
    countryCode: "EE",
    riskLevel: "high",
    riskScore: 87,
    status: "pending_review",
    assignee: "M. Duarte",
    slaHoursRemaining: 3,
    submittedAt: "2026-08-31 09:14",
    product: "Business account + FX",
    expectedMonthlyVolume: "EUR 1.4M",
    riskThesis:
      "Newly registered payment intermediary with an undisclosed beneficial owner and inbound flows from two sanctioned-adjacent corridors. Ownership evidence does not match the registry extract.",
    identity: {
      legalName: "Northwind Payments OÜ",
      dateOfBirth: "1988-04-12",
      nationalId: "EE 386•••••42",
      email: "o.kask@northwind-pay.ee",
      phone: "+372 5•• ••• 18",
      address: "Tornimäe 5, 10145 Tallinn, Estonia",
      occupation: "Director, payment services",
    },
    signals: [
      {
        id: "s1",
        label: "Beneficial owner mismatch",
        severity: "critical",
        detail:
          "Registry extract lists a 34% holder who is absent from the submitted ownership declaration.",
        source: "Registry cross-check",
      },
      {
        id: "s2",
        label: "Sanctions-adjacent counterparty",
        severity: "critical",
        detail:
          "Two expected counterparties share a registered address with an entity delisted in 2024.",
        source: "Screening provider",
      },
      {
        id: "s3",
        label: "Volume inconsistent with filing",
        severity: "warning",
        detail:
          "Declared EUR 1.4M monthly against a last filed annual turnover of EUR 210k.",
        source: "Financial filings",
      },
      {
        id: "s4",
        label: "Device reused across applications",
        severity: "info",
        detail: "Same device fingerprint seen on 3 other applications since June.",
        source: "Device intelligence",
      },
    ],
    documents: [
      {
        id: "d1",
        name: "Certificate of incorporation",
        result: "pass",
        detail: "Matches registry record 14382910.",
        checkedAt: "2026-08-31 09:20",
      },
      {
        id: "d2",
        name: "Ownership declaration",
        result: "fail",
        detail: "Missing 34% shareholder disclosed in registry.",
        checkedAt: "2026-08-31 09:22",
      },
      {
        id: "d3",
        name: "Director passport",
        result: "manual",
        detail: "Liveness capture blurred; manual review requested.",
        checkedAt: "2026-08-31 09:25",
      },
      {
        id: "d4",
        name: "Proof of address",
        result: "pass",
        detail: "Utility statement dated within 90 days.",
        checkedAt: "2026-08-31 09:26",
      },
      {
        id: "d5",
        name: "Source of funds statement",
        result: "manual",
        detail: "Narrative provided, supporting bank statements not attached.",
        checkedAt: "2026-08-31 09:31",
      },
    ],
    notes: [
      note(
        "n1",
        "M. Duarte",
        "2026-08-31 10:02",
        "Called the director. He states the missing holder exited in July; no share transfer document supplied yet.",
      ),
      note(
        "n2",
        "L. Bergman",
        "2026-08-31 11:40",
        "Second-line view: do not approve without the transfer deed and updated registry extract.",
      ),
    ],
    activity: [
      event("a1", "KYC-4821", "2026-08-31 09:14", "System", "Case created from onboarding form."),
      event("a2", "KYC-4821", "2026-08-31 09:26", "System", "Screening returned 2 critical signals."),
      event("a3", "KYC-4821", "2026-08-31 10:05", "M. Duarte", "Case assigned to M. Duarte."),
      event("a4", "KYC-4821", "2026-08-31 11:41", "L. Bergman", "Second-line note added."),
    ],
  },
  {
    id: "KYC-4822",
    applicant: "Adaeze Nwosu",
    entityType: "Individual",
    country: "Nigeria",
    countryCode: "NG",
    riskLevel: "high",
    riskScore: 81,
    status: "escalated",
    assignee: "J. Okafor",
    slaHoursRemaining: 1,
    submittedAt: "2026-08-30 16:02",
    product: "Personal account",
    expectedMonthlyVolume: "USD 40k",
    riskThesis:
      "Politically exposed person by association; declared income does not support the expected transfer pattern.",
    identity: {
      legalName: "Adaeze Chidinma Nwosu",
      dateOfBirth: "1991-11-03",
      nationalId: "NG •••• ••41",
      email: "a.nwosu@•••••.com",
      phone: "+234 8•• ••• 907",
      address: "12 Bourdillon Road, Ikoyi, Lagos, Nigeria",
      occupation: "Logistics consultant",
    },
    signals: [
      {
        id: "s1",
        label: "PEP association",
        severity: "critical",
        detail: "Immediate family member holds a regional office since 2023.",
        source: "Screening provider",
      },
      {
        id: "s2",
        label: "Income vs. expected volume",
        severity: "warning",
        detail: "Declared USD 40k monthly against stated annual income of USD 90k.",
        source: "Application data",
      },
      {
        id: "s3",
        label: "Address unverified",
        severity: "info",
        detail: "No third-party source confirms the residential address.",
        source: "Address verification",
      },
    ],
    documents: [
      { id: "d1", name: "National ID", result: "pass", detail: "Matched against issuer database.", checkedAt: "2026-08-30 16:10" },
      { id: "d2", name: "Selfie liveness", result: "pass", detail: "Score 0.96.", checkedAt: "2026-08-30 16:11" },
      { id: "d3", name: "Proof of address", result: "fail", detail: "Document older than 12 months.", checkedAt: "2026-08-30 16:14" },
      { id: "d4", name: "Source of wealth", result: "manual", detail: "Consultancy contracts submitted, unverified counterparties.", checkedAt: "2026-08-30 16:20" },
    ],
    notes: [note("n1", "J. Okafor", "2026-08-30 17:05", "Escalated to second line because of the PEP link.")],
    activity: [
      event("a1", "KYC-4822", "2026-08-30 16:02", "System", "Case created from onboarding form."),
      event("a2", "KYC-4822", "2026-08-30 17:06", "J. Okafor", "Case escalated to second line."),
    ],
  },
  {
    id: "KYC-4823",
    applicant: "Harborline Freight Ltd",
    entityType: "Business",
    country: "United Kingdom",
    countryCode: "GB",
    riskLevel: "medium",
    riskScore: 58,
    status: "awaiting_information",
    assignee: "L. Bergman",
    slaHoursRemaining: 11,
    submittedAt: "2026-08-30 11:47",
    product: "Business account",
    expectedMonthlyVolume: "GBP 320k",
    riskThesis:
      "Established freight operator with one unresolved director discrepancy; otherwise consistent filings.",
    identity: {
      legalName: "Harborline Freight Limited",
      dateOfBirth: "1979-02-18",
      nationalId: "GB •••••• 20C",
      email: "finance@harborline.co.uk",
      phone: "+44 20 •••• 8842",
      address: "40 Dock Street, Liverpool L3 4AB, United Kingdom",
      occupation: "Managing director",
    },
    signals: [
      { id: "s1", label: "Director discrepancy", severity: "warning", detail: "One director resigned per registry but is listed as active.", source: "Registry cross-check" },
      { id: "s2", label: "Cash-intensive sector", severity: "info", detail: "Freight and haulage flagged as medium inherent risk.", source: "Risk policy" },
    ],
    documents: [
      { id: "d1", name: "Certificate of incorporation", result: "pass", detail: "Companies House match.", checkedAt: "2026-08-30 11:52" },
      { id: "d2", name: "Director passport", result: "pass", detail: "Chip verified.", checkedAt: "2026-08-30 11:55" },
      { id: "d3", name: "Ownership declaration", result: "manual", detail: "Awaiting updated director list.", checkedAt: "2026-08-30 12:03" },
    ],
    notes: [note("n1", "L. Bergman", "2026-08-30 13:10", "Requested an updated director list; response expected this week.")],
    activity: [
      event("a1", "KYC-4823", "2026-08-30 11:47", "System", "Case created from onboarding form."),
      event("a2", "KYC-4823", "2026-08-30 13:11", "L. Bergman", "Information requested from applicant."),
    ],
  },
  {
    id: "KYC-4824",
    applicant: "Meridian Holdings Ltd",
    entityType: "Business",
    country: "Cyprus",
    countryCode: "CY",
    riskLevel: "high",
    riskScore: 92,
    status: "pending_review",
    assignee: "Unassigned",
    slaHoursRemaining: -2,
    submittedAt: "2026-08-29 08:31",
    product: "Business account + FX",
    expectedMonthlyVolume: "EUR 3.1M",
    riskThesis:
      "Layered holding structure across three jurisdictions with a nominee director and no verifiable operating activity.",
    identity: {
      legalName: "Meridian Holdings Limited",
      dateOfBirth: "1984-07-22",
      nationalId: "CY ••••• 883",
      email: "admin@meridian-hold.cy",
      phone: "+357 22 ••• 410",
      address: "8 Stasinou Avenue, 1060 Nicosia, Cyprus",
      occupation: "Nominee director",
    },
    signals: [
      { id: "s1", label: "Nominee director", severity: "critical", detail: "Director serves on 41 other entities.", source: "Registry cross-check" },
      { id: "s2", label: "Layered ownership", severity: "critical", detail: "Three-tier structure ends in a trust with undisclosed settlor.", source: "Ownership analysis" },
      { id: "s3", label: "SLA breached", severity: "warning", detail: "Case is 2 hours past the review deadline.", source: "Queue policy" },
    ],
    documents: [
      { id: "d1", name: "Certificate of incorporation", result: "pass", detail: "Registry match.", checkedAt: "2026-08-29 08:40" },
      { id: "d2", name: "Ownership declaration", result: "fail", detail: "Ultimate beneficial owner not identified.", checkedAt: "2026-08-29 08:44" },
      { id: "d3", name: "Source of funds statement", result: "fail", detail: "No supporting evidence provided.", checkedAt: "2026-08-29 08:47" },
    ],
    notes: [],
    activity: [event("a1", "KYC-4824", "2026-08-29 08:31", "System", "Case created from onboarding form.")],
  },
  {
    id: "KYC-4825",
    applicant: "Jonas Weber",
    entityType: "Individual",
    country: "Germany",
    countryCode: "DE",
    riskLevel: "low",
    riskScore: 21,
    status: "pending_review",
    assignee: "M. Duarte",
    slaHoursRemaining: 22,
    submittedAt: "2026-08-31 07:55",
    product: "Personal account",
    expectedMonthlyVolume: "EUR 6k",
    riskThesis: "Salaried applicant with consistent documentation and no adverse screening results.",
    identity: {
      legalName: "Jonas Weber",
      dateOfBirth: "1990-01-30",
      nationalId: "DE •••••• 771",
      email: "j.weber@•••••.de",
      phone: "+49 30 •••• 221",
      address: "Kastanienallee 12, 10435 Berlin, Germany",
      occupation: "Software engineer",
    },
    signals: [{ id: "s1", label: "No adverse media", severity: "info", detail: "Screening returned no matches.", source: "Screening provider" }],
    documents: [
      { id: "d1", name: "National ID", result: "pass", detail: "Chip verified.", checkedAt: "2026-08-31 07:58" },
      { id: "d2", name: "Selfie liveness", result: "pass", detail: "Score 0.98.", checkedAt: "2026-08-31 07:58" },
      { id: "d3", name: "Proof of address", result: "pass", detail: "Bank statement dated August 2026.", checkedAt: "2026-08-31 08:01" },
    ],
    notes: [],
    activity: [event("a1", "KYC-4825", "2026-08-31 07:55", "System", "Case created from onboarding form.")],
  },
  {
    id: "KYC-4826",
    applicant: "Gulf Crest Trading FZE",
    entityType: "Business",
    country: "United Arab Emirates",
    countryCode: "AE",
    riskLevel: "high",
    riskScore: 76,
    status: "pending_review",
    assignee: "S. Petrova",
    slaHoursRemaining: 5,
    submittedAt: "2026-08-30 06:12",
    product: "Business account + FX",
    expectedMonthlyVolume: "USD 900k",
    riskThesis:
      "Free-zone trading company with dual-use goods in the declared product list and incomplete trade references.",
    identity: {
      legalName: "Gulf Crest Trading FZE",
      dateOfBirth: "1982-09-09",
      nationalId: "AE •••• ••• 118",
      email: "ops@gulfcrest.ae",
      phone: "+971 4 ••• 6620",
      address: "Warehouse 14, Jebel Ali Free Zone, Dubai, UAE",
      occupation: "General manager",
    },
    signals: [
      { id: "s1", label: "Dual-use goods declared", severity: "critical", detail: "Product list includes controlled electronics components.", source: "Application data" },
      { id: "s2", label: "Trade references incomplete", severity: "warning", detail: "One of three references unreachable.", source: "Manual outreach" },
    ],
    documents: [
      { id: "d1", name: "Trade licence", result: "pass", detail: "Valid until 2027.", checkedAt: "2026-08-30 06:20" },
      { id: "d2", name: "Ownership declaration", result: "pass", detail: "Single shareholder confirmed.", checkedAt: "2026-08-30 06:22" },
      { id: "d3", name: "Source of funds statement", result: "manual", detail: "Trade invoices under review.", checkedAt: "2026-08-30 06:30" },
    ],
    notes: [note("n1", "S. Petrova", "2026-08-30 09:00", "Awaiting export-control questionnaire.")],
    activity: [event("a1", "KYC-4826", "2026-08-30 06:12", "System", "Case created from onboarding form.")],
  },
  {
    id: "KYC-4827",
    applicant: "Camila Ferreira",
    entityType: "Individual",
    country: "Brazil",
    countryCode: "BR",
    riskLevel: "medium",
    riskScore: 49,
    status: "pending_review",
    assignee: "J. Okafor",
    slaHoursRemaining: 8,
    submittedAt: "2026-08-30 19:41",
    product: "Personal account",
    expectedMonthlyVolume: "BRL 55k",
    riskThesis: "Self-employed applicant with irregular income evidence and one address mismatch.",
    identity: {
      legalName: "Camila Ferreira Souza",
      dateOfBirth: "1994-06-15",
      nationalId: "BR •••.•••.•21-04",
      email: "c.ferreira@•••••.br",
      phone: "+55 11 ••••• 3390",
      address: "Rua Augusta 1200, São Paulo, Brazil",
      occupation: "Independent designer",
    },
    signals: [
      { id: "s1", label: "Address mismatch", severity: "warning", detail: "Application address differs from document address.", source: "Address verification" },
      { id: "s2", label: "Irregular income", severity: "info", detail: "Deposits vary by more than 60% month to month.", source: "Open banking" },
    ],
    documents: [
      { id: "d1", name: "National ID", result: "pass", detail: "Issuer match.", checkedAt: "2026-08-30 19:45" },
      { id: "d2", name: "Proof of address", result: "fail", detail: "Address differs from the application.", checkedAt: "2026-08-30 19:48" },
      { id: "d3", name: "Selfie liveness", result: "pass", detail: "Score 0.93.", checkedAt: "2026-08-30 19:49" },
    ],
    notes: [],
    activity: [event("a1", "KYC-4827", "2026-08-30 19:41", "System", "Case created from onboarding form.")],
  },
  {
    id: "KYC-4828",
    applicant: "Solstice Capital Pte Ltd",
    entityType: "Business",
    country: "Singapore",
    countryCode: "SG",
    riskLevel: "medium",
    riskScore: 54,
    status: "awaiting_information",
    assignee: "L. Bergman",
    slaHoursRemaining: 15,
    submittedAt: "2026-08-29 14:22",
    product: "Business account",
    expectedMonthlyVolume: "SGD 700k",
    riskThesis: "Licensed fund manager awaiting a current regulatory standing letter.",
    identity: {
      legalName: "Solstice Capital Pte. Ltd.",
      dateOfBirth: "1976-03-04",
      nationalId: "SG ••••• 33Z",
      email: "compliance@solstice.sg",
      phone: "+65 6••• 4410",
      address: "One Raffles Quay, Singapore 048583",
      occupation: "Chief compliance officer",
    },
    signals: [
      { id: "s1", label: "Regulatory letter outstanding", severity: "warning", detail: "Standing letter not yet provided.", source: "Manual outreach" },
      { id: "s2", label: "Regulated entity", severity: "info", detail: "Holds a capital markets services licence.", source: "Regulator registry" },
    ],
    documents: [
      { id: "d1", name: "Certificate of incorporation", result: "pass", detail: "ACRA match.", checkedAt: "2026-08-29 14:30" },
      { id: "d2", name: "Regulatory licence", result: "manual", detail: "Awaiting standing letter.", checkedAt: "2026-08-29 14:33" },
      { id: "d3", name: "Ownership declaration", result: "pass", detail: "Two shareholders verified.", checkedAt: "2026-08-29 14:35" },
    ],
    notes: [note("n1", "L. Bergman", "2026-08-29 15:10", "Applicant confirmed the letter is being issued.")],
    activity: [event("a1", "KYC-4828", "2026-08-29 14:22", "System", "Case created from onboarding form.")],
  },
  {
    id: "KYC-4829",
    applicant: "Priit Saar",
    entityType: "Individual",
    country: "Estonia",
    countryCode: "EE",
    riskLevel: "low",
    riskScore: 18,
    status: "approved",
    assignee: "M. Duarte",
    slaHoursRemaining: 30,
    submittedAt: "2026-08-28 10:05",
    product: "Personal account",
    expectedMonthlyVolume: "EUR 3k",
    riskThesis: "Straightforward retail applicant, all checks passed on first pass.",
    identity: {
      legalName: "Priit Saar",
      dateOfBirth: "1987-12-01",
      nationalId: "EE 387•••••11",
      email: "p.saar@•••••.ee",
      phone: "+372 5•• ••• 02",
      address: "Pärnu mnt 22, 10141 Tallinn, Estonia",
      occupation: "Teacher",
    },
    signals: [{ id: "s1", label: "No adverse media", severity: "info", detail: "Screening returned no matches.", source: "Screening provider" }],
    documents: [
      { id: "d1", name: "National ID", result: "pass", detail: "Chip verified.", checkedAt: "2026-08-28 10:08" },
      { id: "d2", name: "Proof of address", result: "pass", detail: "Utility bill dated July 2026.", checkedAt: "2026-08-28 10:10" },
    ],
    notes: [],
    activity: [
      event("a1", "KYC-4829", "2026-08-28 10:05", "System", "Case created from onboarding form."),
      event("a2", "KYC-4829", "2026-08-28 11:20", "M. Duarte", "Case approved."),
    ],
  },
  {
    id: "KYC-4830",
    applicant: "Vector Mining SA",
    entityType: "Business",
    country: "Brazil",
    countryCode: "BR",
    riskLevel: "high",
    riskScore: 84,
    status: "escalated",
    assignee: "S. Petrova",
    slaHoursRemaining: 0,
    submittedAt: "2026-08-29 21:18",
    product: "Business account + FX",
    expectedMonthlyVolume: "USD 2.2M",
    riskThesis:
      "Extractive-sector applicant with adverse environmental litigation and an unverified source of funds narrative.",
    identity: {
      legalName: "Vector Mining Sociedade Anônima",
      dateOfBirth: "1971-05-25",
      nationalId: "BR ••.•••.•••/0001-••",
      email: "diretoria@vectormining.br",
      phone: "+55 31 ••••• 7781",
      address: "Av. Afonso Pena 4000, Belo Horizonte, Brazil",
      occupation: "Chief executive",
    },
    signals: [
      { id: "s1", label: "Adverse media", severity: "critical", detail: "Three articles on environmental litigation since 2024.", source: "Adverse media" },
      { id: "s2", label: "Source of funds unverified", severity: "warning", detail: "Narrative references an unnamed private investor.", source: "Manual review" },
      { id: "s3", label: "SLA at deadline", severity: "warning", detail: "Review deadline reached.", source: "Queue policy" },
    ],
    documents: [
      { id: "d1", name: "Certificate of incorporation", result: "pass", detail: "Registry match.", checkedAt: "2026-08-29 21:25" },
      { id: "d2", name: "Source of funds statement", result: "fail", detail: "Investor identity withheld.", checkedAt: "2026-08-29 21:31" },
      { id: "d3", name: "Ownership declaration", result: "manual", detail: "Two holders pending verification.", checkedAt: "2026-08-29 21:33" },
    ],
    notes: [note("n1", "S. Petrova", "2026-08-30 08:15", "Second line asked for the investor identity before any decision.")],
    activity: [
      event("a1", "KYC-4830", "2026-08-29 21:18", "System", "Case created from onboarding form."),
      event("a2", "KYC-4830", "2026-08-30 08:16", "S. Petrova", "Case escalated to second line."),
    ],
  },
  {
    id: "KYC-4831",
    applicant: "Anna Lindqvist",
    entityType: "Individual",
    country: "Germany",
    countryCode: "DE",
    riskLevel: "medium",
    riskScore: 44,
    status: "pending_review",
    assignee: "Unassigned",
    slaHoursRemaining: 6,
    submittedAt: "2026-08-31 05:40",
    product: "Personal account",
    expectedMonthlyVolume: "EUR 18k",
    riskThesis: "Cross-border applicant with a recent country change and one document quality failure.",
    identity: {
      legalName: "Anna Lindqvist",
      dateOfBirth: "1993-08-19",
      nationalId: "DE •••••• 902",
      email: "a.lindqvist@•••••.de",
      phone: "+49 89 •••• 553",
      address: "Leopoldstraße 9, 80802 Munich, Germany",
      occupation: "Consultant",
    },
    signals: [
      { id: "s1", label: "Recent jurisdiction change", severity: "warning", detail: "Residence changed from Sweden three months ago.", source: "Application data" },
      { id: "s2", label: "Document quality", severity: "info", detail: "First upload rejected for glare.", source: "Document engine" },
    ],
    documents: [
      { id: "d1", name: "National ID", result: "manual", detail: "Second upload pending review.", checkedAt: "2026-08-31 05:50" },
      { id: "d2", name: "Proof of address", result: "pass", detail: "Rental contract provided.", checkedAt: "2026-08-31 05:52" },
    ],
    notes: [],
    activity: [event("a1", "KYC-4831", "2026-08-31 05:40", "System", "Case created from onboarding form.")],
  },
  {
    id: "KYC-4832",
    applicant: "Kestrel Logistics Ltd",
    entityType: "Business",
    country: "United Kingdom",
    countryCode: "GB",
    riskLevel: "low",
    riskScore: 26,
    status: "pending_review",
    assignee: "J. Okafor",
    slaHoursRemaining: 26,
    submittedAt: "2026-08-31 08:12",
    product: "Business account",
    expectedMonthlyVolume: "GBP 90k",
    riskThesis: "Small logistics firm with clean filings and verified directors.",
    identity: {
      legalName: "Kestrel Logistics Limited",
      dateOfBirth: "1980-10-11",
      nationalId: "GB •••••• 44A",
      email: "accounts@kestrel-log.co.uk",
      phone: "+44 161 ••• 2210",
      address: "3 Canal Street, Manchester M1 3HE, United Kingdom",
      occupation: "Director",
    },
    signals: [{ id: "s1", label: "Clean screening", severity: "info", detail: "No sanctions, PEP, or adverse media matches.", source: "Screening provider" }],
    documents: [
      { id: "d1", name: "Certificate of incorporation", result: "pass", detail: "Companies House match.", checkedAt: "2026-08-31 08:18" },
      { id: "d2", name: "Director passport", result: "pass", detail: "Chip verified.", checkedAt: "2026-08-31 08:19" },
      { id: "d3", name: "Ownership declaration", result: "pass", detail: "Single director and shareholder.", checkedAt: "2026-08-31 08:21" },
    ],
    notes: [],
    activity: [event("a1", "KYC-4832", "2026-08-31 08:12", "System", "Case created from onboarding form.")],
  },
  {
    id: "KYC-4833",
    applicant: "Ravi Menon",
    entityType: "Individual",
    country: "Singapore",
    countryCode: "SG",
    riskLevel: "medium",
    riskScore: 52,
    status: "pending_review",
    assignee: "M. Duarte",
    slaHoursRemaining: 4,
    submittedAt: "2026-08-30 22:03",
    product: "Personal account + FX",
    expectedMonthlyVolume: "SGD 120k",
    riskThesis: "High expected FX turnover for a private individual; employment evidence is thin.",
    identity: {
      legalName: "Ravi Menon",
      dateOfBirth: "1985-02-27",
      nationalId: "SG ••••• 71J",
      email: "r.menon@•••••.sg",
      phone: "+65 9••• 1180",
      address: "22 Tanjong Pagar Road, Singapore 088444",
      occupation: "Commodities trader",
    },
    signals: [
      { id: "s1", label: "High FX turnover", severity: "warning", detail: "Expected FX volume is 8x the peer median.", source: "Application data" },
      { id: "s2", label: "Employment unverified", severity: "warning", detail: "Employer letter not provided.", source: "Manual review" },
    ],
    documents: [
      { id: "d1", name: "National ID", result: "pass", detail: "Issuer match.", checkedAt: "2026-08-30 22:08" },
      { id: "d2", name: "Source of wealth", result: "manual", detail: "Broker statements under review.", checkedAt: "2026-08-30 22:12" },
    ],
    notes: [],
    activity: [event("a1", "KYC-4833", "2026-08-30 22:03", "System", "Case created from onboarding form.")],
  },
  {
    id: "KYC-4834",
    applicant: "Aegean Yield OÜ",
    entityType: "Business",
    country: "Cyprus",
    countryCode: "CY",
    riskLevel: "high",
    riskScore: 79,
    status: "pending_review",
    assignee: "Unassigned",
    slaHoursRemaining: 2,
    submittedAt: "2026-08-31 04:30",
    product: "Business account + FX",
    expectedMonthlyVolume: "EUR 640k",
    riskThesis:
      "Crypto-adjacent yield platform with unclear licensing and shared directors with a previously rejected applicant.",
    identity: {
      legalName: "Aegean Yield OÜ",
      dateOfBirth: "1989-03-16",
      nationalId: "CY ••••• 501",
      email: "hello@aegeanyield.io",
      phone: "+357 25 ••• 118",
      address: "Griva Digeni 81, 3101 Limassol, Cyprus",
      occupation: "Founder",
    },
    signals: [
      { id: "s1", label: "Licence status unclear", severity: "critical", detail: "No matching entry in the regulator registry.", source: "Regulator registry" },
      { id: "s2", label: "Director overlap with rejected case", severity: "critical", detail: "Shares a director with KYC-4102, rejected in March.", source: "Internal history" },
      { id: "s3", label: "Crypto exposure", severity: "warning", detail: "Majority of inbound flows expected from exchanges.", source: "Application data" },
    ],
    documents: [
      { id: "d1", name: "Certificate of incorporation", result: "pass", detail: "Registry match.", checkedAt: "2026-08-31 04:38" },
      { id: "d2", name: "Regulatory licence", result: "fail", detail: "No licence found for the declared activity.", checkedAt: "2026-08-31 04:41" },
      { id: "d3", name: "Ownership declaration", result: "manual", detail: "Two holders pending verification.", checkedAt: "2026-08-31 04:44" },
    ],
    notes: [],
    activity: [event("a1", "KYC-4834", "2026-08-31 04:30", "System", "Case created from onboarding form.")],
  },
];

export const ALL_ACTIVITY: ActivityEvent[] = CASES.flatMap((c) => c.activity);
