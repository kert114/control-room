"use client";

// Canonical prototype state. Variants A, B and C all consume this single model
// and differ only in layout and information hierarchy.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ActivityEvent,
  CASES,
  CaseStatus,
  DEFAULT_CASE_ID,
  KycCase,
  RiskLevel,
} from "./data";

export type Variant = "A" | "B" | "C";
export type Role = "operator" | "approver" | "auditor";
export type Scenario =
  | "default"
  | "loading"
  | "empty"
  | "validation"
  | "forbidden"
  | "completed";
export type ActionKind = "approve" | "reject" | "request-info" | "reassign";
export type SortKey = "risk" | "sla" | "submitted" | "applicant";

export const VARIANTS: Variant[] = ["A", "B", "C"];
export const ROLES: Role[] = ["operator", "approver", "auditor"];
export const SCENARIOS: Scenario[] = [
  "default",
  "loading",
  "empty",
  "validation",
  "forbidden",
  "completed",
];

export const ACTION_LABEL: Record<ActionKind, string> = {
  approve: "Approve",
  reject: "Reject",
  "request-info": "Request information",
  reassign: "Reassign",
};

export const VARIANT_NAME: Record<Variant, string> = {
  A: "Operations workstation",
  B: "Risk dossier",
  C: "Command center",
};

export const ROLE_LABEL: Record<Role, string> = {
  operator: "Operator",
  approver: "Approver",
  auditor: "Auditor",
};

const PERMISSIONS: Record<Role, Record<ActionKind, boolean>> = {
  operator: { approve: false, reject: false, "request-info": true, reassign: true },
  approver: { approve: true, reject: true, "request-info": true, reassign: true },
  auditor: { approve: false, reject: false, "request-info": false, reassign: false },
};

export const ROLE_SCOPE: Record<Role, string> = {
  operator: "Can request information and reassign. Approval and rejection need an approver.",
  approver: "Can approve, reject, request information and reassign.",
  auditor: "Read-only. No case actions are permitted.",
};

export const REJECT_REASONS = [
  "Beneficial owner not verified",
  "Sanctions or screening hit",
  "Source of funds unsupported",
  "Documents not authentic",
];

export const INFO_ITEMS = [
  "Updated ownership declaration",
  "Share transfer deed",
  "Source of funds evidence",
  "Re-capture of identity document",
];

export interface Filters {
  risk: RiskLevel | "all";
  status: CaseStatus | "all";
  country: string;
  assignee: string;
  sla: "all" | "breached" | "under4h" | "over8h";
}

export const EMPTY_FILTERS: Filters = {
  risk: "all",
  status: "all",
  country: "all",
  assignee: "all",
  sla: "all",
};

export interface DialogFields {
  reason: string;
  note: string;
  assignee: string;
  items: string[];
  confirmed: boolean;
}

export interface DialogState {
  kind: ActionKind;
  denied: boolean;
  fields: DialogFields;
  errors: Partial<Record<keyof DialogFields, string>>;
}

export interface ActionResult {
  kind: ActionKind;
  caseId: string;
  applicant: string;
  message: string;
}

interface CaseOverride {
  status?: CaseStatus;
  assignee?: string;
}

export interface KycPrototypeModel {
  variant: Variant;
  role: Role;
  scenario: Scenario;
  filters: Filters;
  query: string;
  sort: SortKey;
  cases: KycCase[];
  visibleCases: KycCase[];
  selectedCaseId: string | null;
  selectedCase: KycCase | null;
  activity: ActivityEvent[];
  dialog: DialogState | null;
  result: ActionResult | null;
  isLoading: boolean;
  isEmpty: boolean;
  filtersActive: boolean;
  inspectorOpen: boolean;
  permissions: Record<ActionKind, boolean>;
  counts: { total: number; high: number; breached: number; awaiting: number };
  setVariant: (v: Variant) => void;
  cycleVariant: (direction: 1 | -1) => void;
  setRole: (r: Role) => void;
  setScenario: (s: Scenario) => void;
  setQuery: (q: string) => void;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  setSort: (s: SortKey) => void;
  clearFilters: () => void;
  returnToAllCases: () => void;
  selectCase: (id: string) => void;
  stepCase: (direction: 1 | -1) => void;
  closeInspector: () => void;
  openAction: (kind: ActionKind) => void;
  closeDialog: () => void;
  setDialogField: <K extends keyof DialogFields>(key: K, value: DialogFields[K]) => void;
  toggleDialogItem: (item: string) => void;
  submitDialog: () => void;
  dismissResult: () => void;
  goToNextCase: () => void;
  resetScenario: () => void;
  variantHref: (v: Variant) => string;
}

function emptyFields(assignee: string): DialogFields {
  return { reason: "", note: "", assignee, items: [], confirmed: false };
}

function parseVariant(v: string | null): Variant {
  return v === "B" || v === "C" ? v : "A";
}

function parseRole(r: string | null): Role {
  return r === "operator" || r === "auditor" || r === "approver" ? r : "approver";
}

function parseScenario(s: string | null): Scenario {
  return (SCENARIOS as string[]).includes(s ?? "") ? (s as Scenario) : "default";
}

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

export function useKycPrototypeModel(): KycPrototypeModel {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const variant = parseVariant(params.get("variant"));
  const scenario = parseScenario(params.get("state"));
  const roleParam = params.get("role");
  const role = parseRole(
    roleParam ?? (scenario === "forbidden" ? "operator" : null),
  );
  const caseParam = params.get("case");

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [query, setQueryState] = useState("");
  const [sort, setSortState] = useState<SortKey>("risk");
  const [overrides, setOverrides] = useState<Record<string, CaseOverride>>({});
  const [extraActivity, setExtraActivity] = useState<ActivityEvent[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [manualSelection, setManualSelection] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const cases = useMemo(
    () =>
      CASES.map((c) => {
        const o = overrides[c.id];
        return o ? { ...c, status: o.status ?? c.status, assignee: o.assignee ?? c.assignee } : c;
      }),
    [overrides],
  );

  const selectedCaseId =
    manualSelection ??
    (caseParam && CASES.some((c) => c.id === caseParam) ? caseParam : DEFAULT_CASE_ID);

  const visibleCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = cases.filter((c) => {
      if (filters.risk !== "all" && c.riskLevel !== filters.risk) return false;
      if (filters.status !== "all" && c.status !== filters.status) return false;
      if (filters.country !== "all" && c.country !== filters.country) return false;
      if (filters.assignee !== "all" && c.assignee !== filters.assignee) return false;
      if (filters.sla === "breached" && c.slaHoursRemaining > 0) return false;
      if (filters.sla === "under4h" && !(c.slaHoursRemaining > 0 && c.slaHoursRemaining <= 4))
        return false;
      if (filters.sla === "over8h" && c.slaHoursRemaining <= 8) return false;
      if (q && !`${c.id} ${c.applicant} ${c.country} ${c.assignee}`.toLowerCase().includes(q))
        return false;
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "risk") return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] || b.riskScore - a.riskScore;
      if (sort === "sla") return a.slaHoursRemaining - b.slaHoursRemaining;
      if (sort === "applicant") return a.applicant.localeCompare(b.applicant);
      return b.submittedAt.localeCompare(a.submittedAt);
    });
    return sorted;
  }, [cases, filters, query, sort]);

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) ?? null,
    [cases, selectedCaseId],
  );

  const activity = useMemo(() => {
    const base = cases.flatMap((c) => c.activity);
    return [...base, ...extraActivity].sort((a, b) => b.at.localeCompare(a.at));
  }, [cases, extraActivity]);

  const permissions = PERMISSIONS[role];
  const isLoading = scenario === "loading";
  const isEmpty = visibleCases.length === 0;
  const filtersActive =
    query.trim().length > 0 ||
    (Object.keys(filters) as (keyof Filters)[]).some((k) => filters[k] !== EMPTY_FILTERS[k]);

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      });
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const applyResult = useCallback(
    (kind: ActionKind, target: KycCase, fields: DialogFields) => {
      const statusByKind: Record<ActionKind, CaseStatus | null> = {
        approve: "approved",
        reject: "rejected",
        "request-info": "awaiting_information",
        reassign: null,
      };
      const nextStatus = statusByKind[kind];
      setOverrides((prev) => ({
        ...prev,
        [target.id]: {
          ...prev[target.id],
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(kind === "reassign" ? { assignee: fields.assignee } : {}),
        },
      }));
      const text =
        kind === "approve"
          ? "Case approved after evidence review."
          : kind === "reject"
            ? `Case rejected. Reason: ${fields.reason || REJECT_REASONS[0]}.`
            : kind === "request-info"
              ? `Information requested: ${(fields.items.length ? fields.items : [INFO_ITEMS[0]]).join(", ")}.`
              : `Case reassigned to ${fields.assignee}.`;
      setExtraActivity((prev) => [
        ...prev,
        {
          id: `local-${target.id}-${prev.length + 1}`,
          caseId: target.id,
          at: "2026-08-31 12:00",
          actor: ROLE_LABEL[role],
          text,
        },
      ]);
      setResult({
        kind,
        caseId: target.id,
        applicant: target.applicant,
        message: text,
      });
      setDialog(null);
    },
    [role],
  );

  // Scenario application. Each scenario is applied once when it becomes active.
  const appliedScenario = useRef<string>("");
  useEffect(() => {
    const key = `${scenario}:${selectedCaseId}:${role}`;
    if (appliedScenario.current === key) return;
    appliedScenario.current = key;

    if (scenario === "default" || scenario === "loading") {
      setDialog(null);
      setResult(null);
      setInspectorOpen(true);
      return;
    }
    if (scenario === "empty") {
      setDialog(null);
      setResult(null);
      setFilters({ ...EMPTY_FILTERS, risk: "high", country: "Germany" });
      return;
    }
    if (scenario === "validation") {
      setResult(null);
      setInspectorOpen(true);
      setDialog({
        kind: "reject",
        denied: false,
        fields: emptyFields(selectedCase?.assignee ?? ""),
        errors: {
          reason: "Select a rejection reason.",
          note: "Add a decision note of at least 20 characters.",
        },
      });
      return;
    }
    if (scenario === "forbidden") {
      setResult(null);
      setInspectorOpen(true);
      setDialog({
        kind: "approve",
        denied: true,
        fields: emptyFields(selectedCase?.assignee ?? ""),
        errors: {},
      });
      return;
    }
    if (scenario === "completed" && selectedCase) {
      setInspectorOpen(true);
      applyResult("approve", selectedCase, emptyFields(selectedCase.assignee));
    }
  }, [scenario, selectedCase, selectedCaseId, role, applyResult]);

  const setVariant = useCallback(
    (v: Variant) => setParams({ variant: v }),
    [setParams],
  );

  const variantHref = useCallback(
    (v: Variant) => {
      const sp = new URLSearchParams(params.toString());
      sp.set("variant", v);
      return `${pathname}?${sp.toString()}`;
    },
    [params, pathname],
  );

  const cycleVariant = useCallback(
    (direction: 1 | -1) => {
      const i = VARIANTS.indexOf(variant);
      setVariant(VARIANTS[(i + direction + VARIANTS.length) % VARIANTS.length]);
    },
    [variant, setVariant],
  );

  const selectCase = useCallback(
    (id: string) => {
      setManualSelection(id);
      setInspectorOpen(true);
      setParams({ case: id });
    },
    [setParams],
  );

  const stepCase = useCallback(
    (direction: 1 | -1) => {
      if (visibleCases.length === 0) return;
      const i = visibleCases.findIndex((c) => c.id === selectedCaseId);
      const next = visibleCases[(i + direction + visibleCases.length) % visibleCases.length];
      selectCase(next.id);
    },
    [visibleCases, selectedCaseId, selectCase],
  );

  const openAction = useCallback(
    (kind: ActionKind) => {
      if (!selectedCase) return;
      setResult(null);
      setDialog({
        kind,
        denied: !permissions[kind],
        fields: emptyFields(selectedCase.assignee),
        errors: {},
      });
    },
    [permissions, selectedCase],
  );

  const submitDialog = useCallback(() => {
    if (!dialog || !selectedCase || dialog.denied) return;
    const { kind, fields } = dialog;
    const errors: DialogState["errors"] = {};
    if (kind === "approve" && !fields.confirmed)
      errors.confirmed = "Confirm that identity and ownership evidence was reviewed.";
    if (kind === "reject" && !fields.reason) errors.reason = "Select a rejection reason.";
    if ((kind === "reject" || kind === "request-info") && fields.note.trim().length < 20)
      errors.note = "Add a decision note of at least 20 characters.";
    if (kind === "request-info" && fields.items.length === 0)
      errors.items = "Select at least one item to request.";
    if (kind === "reassign" && (!fields.assignee || fields.assignee === selectedCase.assignee))
      errors.assignee = "Choose a different assignee.";
    if (Object.keys(errors).length > 0) {
      setDialog({ ...dialog, errors });
      return;
    }
    applyResult(kind, selectedCase, fields);
  }, [dialog, selectedCase, applyResult]);

  const resetScenario = useCallback(() => {
    setOverrides({});
    setExtraActivity([]);
    setDialog(null);
    setResult(null);
    setFilters(EMPTY_FILTERS);
    setQueryState("");
    setSortState("risk");
    setManualSelection(null);
    setInspectorOpen(true);
    appliedScenario.current = `default:${DEFAULT_CASE_ID}:approver`;
    setParams({ state: null, role: null, case: null });
  }, [setParams]);

  const counts = useMemo(
    () => ({
      total: cases.length,
      high: cases.filter((c) => c.riskLevel === "high").length,
      breached: cases.filter((c) => c.slaHoursRemaining <= 0).length,
      awaiting: cases.filter((c) => c.status === "awaiting_information").length,
    }),
    [cases],
  );

  return {
    variant,
    role,
    scenario,
    filters,
    query,
    sort,
    cases,
    visibleCases,
    selectedCaseId,
    selectedCase,
    activity,
    dialog,
    result,
    isLoading,
    isEmpty,
    filtersActive,
    inspectorOpen,
    permissions,
    counts,
    setVariant,
    cycleVariant,
    setRole: (r) => setParams({ role: r }),
    setScenario: (s) => setParams({ state: s === "default" ? null : s }),
    setQuery: setQueryState,
    setFilter: (key, value) => setFilters((prev) => ({ ...prev, [key]: value })),
    setSort: setSortState,
    clearFilters: () => {
      setFilters(EMPTY_FILTERS);
      setQueryState("");
    },
    returnToAllCases: () => {
      setFilters(EMPTY_FILTERS);
      setQueryState("");
      setParams({ state: null });
    },
    selectCase,
    stepCase,
    closeInspector: () => setInspectorOpen(false),
    openAction,
    closeDialog: () => setDialog(null),
    setDialogField: (key, value) =>
      setDialog((prev) =>
        prev ? { ...prev, fields: { ...prev.fields, [key]: value }, errors: { ...prev.errors, [key]: undefined } } : prev,
      ),
    toggleDialogItem: (item) =>
      setDialog((prev) =>
        prev
          ? {
              ...prev,
              errors: { ...prev.errors, items: undefined },
              fields: {
                ...prev.fields,
                items: prev.fields.items.includes(item)
                  ? prev.fields.items.filter((i) => i !== item)
                  : [...prev.fields.items, item],
              },
            }
          : prev,
      ),
    submitDialog,
    dismissResult: () => setResult(null),
    goToNextCase: () => {
      setResult(null);
      stepCase(1);
    },
    resetScenario,
    variantHref,
  };
}
