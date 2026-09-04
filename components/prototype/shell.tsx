"use client";

// Prototype chrome: variant switcher, scenario/role controls, keyboard shortcuts
// and the small presentational atoms shared by all three variants.

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import {
  CaseStatus,
  DocumentResult,
  KycCase,
  RISK_LABEL,
  RiskLevel,
  STATUS_LABEL,
  SignalSeverity,
} from "@/lib/prototype/data";
import {
  ACTION_LABEL,
  KycPrototypeModel,
  ROLES,
  ROLE_LABEL,
  ROLE_SCOPE,
  SCENARIOS,
  Scenario,
  VARIANTS,
  VARIANT_NAME,
} from "@/lib/prototype/model";

const SCENARIO_LABEL: Record<Scenario, string> = {
  default: "Default",
  loading: "Loading",
  empty: "Empty results",
  validation: "Validation errors",
  forbidden: "Permission denied",
  completed: "Action completed",
};

/* ---------------------------------------------------------------- atoms -- */

export function RiskTag({ level, score }: { level: RiskLevel; score?: number }) {
  const style: Record<RiskLevel, string> = {
    high: "border-red-700 bg-red-50 text-red-800",
    medium: "border-amber-700 bg-amber-50 text-amber-900",
    low: "border-slate-400 bg-slate-50 text-slate-700",
  };
  const glyph: Record<RiskLevel, string> = { high: "▲", medium: "◆", low: "●" };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium ${style[level]}`}
    >
      <span aria-hidden>{glyph[level]}</span>
      {RISK_LABEL[level]}
      {score !== undefined && <span className="font-mono">{score}</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const style: Record<CaseStatus, string> = {
    pending_review: "border-slate-300 bg-white text-slate-700",
    awaiting_information: "border-sky-300 bg-sky-50 text-sky-900",
    escalated: "border-violet-300 bg-violet-50 text-violet-900",
    approved: "border-emerald-400 bg-emerald-50 text-emerald-900",
    rejected: "border-red-400 bg-red-50 text-red-900",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] ${style[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SlaTag({ hours }: { hours: number }) {
  const breached = hours <= 0;
  const tight = hours > 0 && hours <= 4;
  return (
    <span
      className={`whitespace-nowrap font-mono text-[11px] ${
        breached ? "font-semibold text-red-800" : tight ? "text-amber-900" : "text-slate-600"
      }`}
    >
      {breached ? `SLA breached ${Math.abs(hours)}h` : `SLA ${hours}h left`}
    </span>
  );
}

export function DocResultTag({ result }: { result: DocumentResult }) {
  const map: Record<DocumentResult, { label: string; cls: string; glyph: string }> = {
    pass: { label: "Pass", cls: "border-emerald-400 text-emerald-900 bg-emerald-50", glyph: "✓" },
    fail: { label: "Fail", cls: "border-red-500 text-red-900 bg-red-50", glyph: "✕" },
    manual: { label: "Manual review", cls: "border-amber-500 text-amber-900 bg-amber-50", glyph: "!" },
  };
  const m = map[result];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${m.cls}`}>
      <span aria-hidden>{m.glyph}</span>
      {m.label}
    </span>
  );
}

export function SeverityMark({ severity }: { severity: SignalSeverity }) {
  const map: Record<SignalSeverity, { label: string; cls: string; glyph: string }> = {
    critical: { label: "Critical", cls: "border-red-600 text-red-900 bg-red-50", glyph: "▲" },
    warning: { label: "Warning", cls: "border-amber-600 text-amber-900 bg-amber-50", glyph: "◆" },
    info: { label: "Info", cls: "border-slate-400 text-slate-700 bg-slate-50", glyph: "●" },
  };
  const m = map[severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${m.cls}`}>
      <span aria-hidden>{m.glyph}</span>
      {m.label}
    </span>
  );
}

export function MaskedValue({ label, value }: { label: string; value: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[13px] text-slate-900">
          {revealed ? value : value.replace(/[A-Za-z0-9]/g, "•")}
        </span>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
      </span>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-[13px] text-slate-900">{value}</span>
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-700">{children}</h3>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  );
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="p-6" role="status" aria-live="polite">
      <span className="sr-only">Loading {label}</span>
      <div className="mb-4 h-6 w-56 animate-pulse rounded bg-slate-200" />
      <div className="mb-6 h-4 w-80 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded border border-slate-200 bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function EmptyQueue({ model }: { model: KycPrototypeModel }) {
  return (
    <div className="m-6 rounded border border-slate-300 bg-white p-8 text-center">
      <p className="text-[15px] font-semibold text-slate-900">No cases match these filters</p>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-600">
        Review queues are populated by onboarding. Adjust the filters to find work.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={model.clearFilters}
          className="min-h-[40px] rounded border border-slate-800 bg-slate-900 px-3 text-[13px] font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          Clear filters
        </button>
        <button
          type="button"
          onClick={model.returnToAllCases}
          className="min-h-[40px] rounded border border-slate-300 bg-white px-3 text-[13px] text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          Return to all cases
        </button>
      </div>
    </div>
  );
}

export function ResultNotice({ model }: { model: KycPrototypeModel }) {
  if (!model.result) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border border-emerald-500 bg-emerald-50 px-3 py-2"
      role="status"
      aria-live="polite"
    >
      <p className="text-[13px] text-emerald-950">
        <span className="font-semibold">{ACTION_LABEL[model.result.kind]} applied</span> to{" "}
        {model.result.caseId} — {model.result.message}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={model.goToNextCase}
          className="min-h-[36px] rounded border border-emerald-700 bg-white px-2.5 text-[12px] font-medium text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800"
        >
          Next case
        </button>
        <button
          type="button"
          onClick={model.dismissResult}
          className="min-h-[36px] rounded px-2 text-[12px] text-emerald-900 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function ActionButtons({
  model,
  size = "md",
  layout = "row",
}: {
  model: KycPrototypeModel;
  size?: "sm" | "md";
  layout?: "row" | "column";
}) {
  const base =
    size === "sm"
      ? "min-h-[36px] px-2.5 text-[12px]"
      : "min-h-[40px] px-3 text-[13px]";
  const disabled = !model.selectedCase;
  return (
    <div className={`flex gap-2 ${layout === "column" ? "flex-col" : "flex-wrap items-center"}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => model.openAction("approve")}
        className={`${base} rounded border border-slate-900 bg-slate-900 font-medium text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1`}
      >
        Approve <span className="opacity-70">A</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => model.openAction("reject")}
        className={`${base} rounded border border-red-700 bg-white font-medium text-red-800 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-1`}
      >
        Reject <span className="opacity-70">R</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => model.openAction("request-info")}
        className={`${base} rounded border border-slate-400 bg-white text-slate-800 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1`}
      >
        Request info <span className="opacity-70">I</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => model.openAction("reassign")}
        className={`${base} rounded border border-slate-400 bg-white text-slate-800 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1`}
      >
        Reassign <span className="opacity-70">S</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------- scenario/role control -- */

export function ScenarioControls({
  model,
  tone = "light",
}: {
  model: KycPrototypeModel;
  tone?: "light" | "dark";
}) {
  const selectCls =
    tone === "dark"
      ? "min-h-[36px] rounded border border-slate-600 bg-slate-800 px-2 text-[12px] text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      : "min-h-[36px] rounded border border-slate-300 bg-white px-2 text-[12px] text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900";
  const labelCls =
    tone === "dark"
      ? "text-[11px] uppercase tracking-wide text-slate-400"
      : "text-[11px] uppercase tracking-wide text-slate-500";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5">
        <span className={labelCls}>Role</span>
        <select
          className={selectCls}
          value={model.role}
          onChange={(e) => model.setRole(e.target.value as never)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className={labelCls}>Scenario</span>
        <select
          className={selectCls}
          value={model.scenario}
          onChange={(e) => model.setScenario(e.target.value as never)}
        >
          {SCENARIOS.map((s) => (
            <option key={s} value={s}>
              {SCENARIO_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={model.resetScenario}
        className={
          tone === "dark"
            ? "min-h-[36px] rounded border border-slate-600 px-2 text-[12px] text-slate-100 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            : "min-h-[36px] rounded border border-slate-300 bg-white px-2 text-[12px] text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        }
      >
        Reset
      </button>
    </div>
  );
}

export function RoleNotice({ model }: { model: KycPrototypeModel }) {
  return (
    <p className="text-[11px] text-slate-500">
      {ROLE_LABEL[model.role]}: {ROLE_SCOPE[model.role]}
    </p>
  );
}

export function CaseSummaryLine({ kycCase }: { kycCase: KycCase }) {
  return (
    <p className="text-[12px] text-slate-600">
      {kycCase.entityType} · {kycCase.country} · {kycCase.product} · submitted {kycCase.submittedAt}
    </p>
  );
}

/* -------------------------------------------------------- shell wrapper -- */

export function VariantSwitcher({ model }: { model: KycPrototypeModel }) {
  return (
    <nav
      aria-label="Prototype variant switcher"
      className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
    >
      <div className="flex items-center gap-2">
        {VARIANTS.map((v) => (
          <Link
            key={v}
            href={model.variantHref(v)}
            aria-current={model.variant === v ? "page" : undefined}
            className={`min-h-[36px] rounded border px-2.5 py-1 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              model.variant === v
                ? "border-sky-400 bg-sky-950 font-semibold text-white"
                : "border-slate-600 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {v} · {VARIANT_NAME[v]}
          </Link>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        Synthetic demo data · ← → switch variant · A / R / I / S actions · Esc close
      </p>
    </nav>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    tag === "button" ||
    tag === "option" ||
    target.isContentEditable
  );
}

export function PrototypeShell({
  model,
  children,
}: {
  model: KycPrototypeModel;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (model.dialog) model.closeDialog();
        else model.closeInspector();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (model.dialog) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        model.cycleVariant(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        model.cycleVariant(1);
        return;
      }
      if (model.variant === "C" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        model.stepCase(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      const actionKey: Record<string, "approve" | "reject" | "request-info" | "reassign"> = {
        a: "approve",
        r: "reject",
        i: "request-info",
        s: "reassign",
      };
      const action = actionKey[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        model.openAction(action);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [model]);

  return (
    <div className="min-h-screen bg-slate-100 pb-16 text-slate-900">
      {children}
      <VariantSwitcher model={model} />
    </div>
  );
}
