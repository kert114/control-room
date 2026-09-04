"use client";

// Variant C — Command center: queue-first. Top navigation, restrained
// operational summary, full-width table, slide-over inspector, keyboard-first.

import { useState } from "react";
import { ASSIGNEES, COUNTRIES, STATUS_LABEL } from "@/lib/prototype/data";
import { KycPrototypeModel, SortKey } from "@/lib/prototype/model";
import {
  ActionButtons,
  CaseSummaryLine,
  DocResultTag,
  EmptyQueue,
  Field,
  MaskedValue,
  PageSkeleton,
  ResultNotice,
  RiskTag,
  RoleNotice,
  ScenarioControls,
  SectionTitle,
  SeverityMark,
  SlaTag,
  StatusBadge,
} from "./shell";

const selectCls =
  "min-h-[36px] rounded border border-slate-300 bg-white px-2 text-[12px] text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900";

export function VariantC({ model }: { model: KycPrototypeModel }) {
  const c = model.selectedCase;
  const [mobileInspector, setMobileInspector] = useState(false);
  const openCase = (id: string) => {
    model.selectCase(id);
    setMobileInspector(true);
  };
  const closeInspector = () => {
    setMobileInspector(false);
    model.closeInspector();
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 text-slate-100">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2">
          <span className="text-[13px] font-semibold text-white">Control Room</span>
          <nav aria-label="Primary" className="flex gap-1 text-[12px]">
            {["KYC review", "Transactions", "Sanctions", "Reports"].map((item, i) => (
              <button
                key={item}
                type="button"
                className={`min-h-[32px] rounded px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  i === 0 ? "bg-slate-800 font-medium text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
          <span className="text-[11px] text-slate-400">Synthetic demo data</span>
          <div className="ml-auto">
            <ScenarioControls model={model} tone="dark" />
          </div>
        </div>
      </header>

      {model.isLoading ? (
        <PageSkeleton label="case queue" />
      ) : (
        <main className="px-3 py-3">
          {/* restrained operational summary */}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-300 pb-2 text-[12px]">
            {[
              ["Open cases", String(model.counts.total)],
              ["High risk", String(model.counts.high)],
              ["SLA breached", String(model.counts.breached)],
              ["Awaiting info", String(model.counts.awaiting)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dt className="uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="font-mono text-[13px] font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
            <p className="ml-auto text-[11px] text-slate-500">
              ↑ ↓ move · Enter-free actions: A approve, R reject, I info, S reassign
            </p>
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex min-w-[240px] flex-1 items-center">
              <span className="sr-only">Search cases</span>
              <input
                value={model.query}
                onChange={(e) => model.setQuery(e.target.value)}
                placeholder="Search case, applicant, country, assignee"
                className="min-h-[36px] w-full rounded border border-slate-300 px-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              />
            </label>
            <select
              aria-label="Filter by risk"
              className={selectCls}
              value={model.filters.risk}
              onChange={(e) => model.setFilter("risk", e.target.value as never)}
            >
              <option value="all">Risk: all</option>
              <option value="high">Risk: high</option>
              <option value="medium">Risk: medium</option>
              <option value="low">Risk: low</option>
            </select>
            <select
              aria-label="Filter by status"
              className={selectCls}
              value={model.filters.status}
              onChange={(e) => model.setFilter("status", e.target.value as never)}
            >
              <option value="all">Status: all</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by country"
              className={selectCls}
              value={model.filters.country}
              onChange={(e) => model.setFilter("country", e.target.value)}
            >
              <option value="all">Country: all</option>
              {COUNTRIES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by assignee"
              className={selectCls}
              value={model.filters.assignee}
              onChange={(e) => model.setFilter("assignee", e.target.value)}
            >
              <option value="all">Assignee: all</option>
              {ASSIGNEES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by SLA"
              className={selectCls}
              value={model.filters.sla}
              onChange={(e) => model.setFilter("sla", e.target.value as never)}
            >
              <option value="all">SLA: all</option>
              <option value="breached">SLA: breached</option>
              <option value="under4h">SLA: under 4h</option>
              <option value="over8h">SLA: over 8h</option>
            </select>
            <label className="flex items-center gap-1">
              <span className="text-[11px] uppercase text-slate-500">Sort</span>
              <select className={selectCls} value={model.sort} onChange={(e) => model.setSort(e.target.value as SortKey)}>
                <option value="risk">Risk</option>
                <option value="sla">SLA</option>
                <option value="submitted">Submitted</option>
                <option value="applicant">Applicant</option>
              </select>
            </label>
            {model.filtersActive && (
              <button
                type="button"
                onClick={model.clearFilters}
                className="min-h-[36px] rounded border border-slate-300 bg-white px-2 text-[12px] underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="mt-2">
            <ResultNotice model={model} />
          </div>

          {model.isEmpty ? (
            <EmptyQueue model={model} />
          ) : (
            <>
              {/* desktop full-width table */}
              <table className="mt-2 hidden w-full border-collapse bg-white text-left md:table">
                <thead className="border-y border-slate-300 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Case</th>
                    <th className="px-3 py-2 font-medium">Applicant</th>
                    <th className="px-3 py-2 font-medium">Country</th>
                    <th className="px-3 py-2 font-medium">Risk</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Assignee</th>
                    <th className="px-3 py-2 font-medium">SLA</th>
                    <th className="px-3 py-2 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {model.visibleCases.map((k) => (
                    <tr
                      key={k.id}
                      onClick={() => openCase(k.id)}
                      className={`cursor-pointer border-b border-slate-200 text-[13px] hover:bg-slate-50 ${
                        k.id === model.selectedCaseId ? "bg-sky-50 ring-1 ring-inset ring-sky-600" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-[12px] text-slate-600">{k.id}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{k.applicant}</td>
                      <td className="px-3 py-2 text-slate-700">{k.country}</td>
                      <td className="px-3 py-2">
                        <RiskTag level={k.riskLevel} score={k.riskScore} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={k.status} />
                      </td>
                      <td className="px-3 py-2 text-slate-700">{k.assignee}</td>
                      <td className="px-3 py-2">
                        <SlaTag hours={k.slaHoursRemaining} />
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{k.submittedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* mobile compact list */}
              <ul className="mt-2 divide-y divide-slate-200 border-y border-slate-200 bg-white md:hidden">
                {model.visibleCases.map((k) => (
                  <li key={k.id}>
                    <button
                      type="button"
                      onClick={() => openCase(k.id)}
                      className="flex min-h-[56px] w-full flex-col items-start gap-1 p-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      <span className="flex w-full items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">{k.id}</span>
                        <RiskTag level={k.riskLevel} score={k.riskScore} />
                        <span className="ml-auto">
                          <SlaTag hours={k.slaHoursRemaining} />
                        </span>
                      </span>
                      <span className="text-[13px] font-medium text-slate-900">{k.applicant}</span>
                      <span className="flex items-center gap-2 text-[11px] text-slate-600">
                        {k.country} · {k.assignee}
                        <StatusBadge status={k.status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
      )}

      {/* slide-over inspector */}
      {c && model.inspectorOpen && !model.isLoading && (
        <>
          <div
            className="fixed inset-0 z-30 hidden bg-slate-900/20 md:block"
            onClick={closeInspector}
            aria-hidden
          />
          <aside
            aria-label="Case inspector"
            className={`fixed inset-0 z-40 flex-col bg-white md:inset-y-0 md:left-auto md:right-0 md:flex md:w-[440px] md:border-l md:border-slate-300 md:shadow-xl ${
              mobileInspector ? "flex" : "hidden"
            }`}
          >
            <header className="space-y-2 border-b border-slate-300 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-slate-500">{c.id}</span>
                <button
                  type="button"
                  onClick={closeInspector}
                  className="ml-auto min-h-[36px] rounded border border-slate-300 bg-white px-2 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  Close (Esc)
                </button>
              </div>
              <h2 className="text-[16px] font-semibold text-slate-900">{c.applicant}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <RiskTag level={c.riskLevel} score={c.riskScore} />
                <StatusBadge status={c.status} />
                <SlaTag hours={c.slaHoursRemaining} />
              </div>
              <CaseSummaryLine kycCase={c} />
              <p className="text-[13px] leading-relaxed text-slate-800">{c.riskThesis}</p>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 pb-24 md:pb-3">
              <div>
                <SectionTitle hint="Sensitive fields masked">Identity</SectionTitle>
                <div className="divide-y divide-slate-200 rounded border border-slate-200 px-2">
                  <Field label="Legal name" value={c.identity.legalName} />
                  <MaskedValue label="Date of birth" value={c.identity.dateOfBirth} />
                  <MaskedValue label="National ID" value={c.identity.nationalId} />
                  <MaskedValue label="Email" value={c.identity.email} />
                  <MaskedValue label="Phone" value={c.identity.phone} />
                  <Field label="Address" value={c.identity.address} />
                  <Field label="Occupation" value={c.identity.occupation} />
                  <Field label="Expected volume" value={c.expectedMonthlyVolume} />
                </div>
              </div>
              <div>
                <SectionTitle>Risk signals</SectionTitle>
                <ul className="space-y-1">
                  {c.signals.map((s) => (
                    <li key={s.id} className="rounded border border-slate-200 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityMark severity={s.severity} />
                        <span className="text-[13px] font-medium text-slate-900">{s.label}</span>
                      </div>
                      <p className="mt-1 text-[12px] text-slate-700">{s.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <SectionTitle>Document checks</SectionTitle>
                <ul className="divide-y divide-slate-200 rounded border border-slate-200">
                  {c.documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 p-2 text-[13px]">
                      <span className="text-slate-900">{d.name}</span>
                      <DocResultTag result={d.result} />
                      <span className="w-full text-[12px] text-slate-600">{d.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <SectionTitle>Notes</SectionTitle>
                {c.notes.length === 0 ? (
                  <p className="text-[12px] text-slate-600">No notes on this case.</p>
                ) : (
                  <ul className="space-y-1">
                    {c.notes.map((n) => (
                      <li key={n.id} className="rounded border border-slate-200 p-2 text-[12px]">
                        <span className="font-medium text-slate-900">{n.author}</span>{" "}
                        <span className="font-mono text-[11px] text-slate-500">{n.at}</span>
                        <p className="mt-0.5 text-slate-700">{n.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <SectionTitle>Activity</SectionTitle>
                <ol className="space-y-1">
                  {model.activity
                    .filter((a) => a.caseId === c.id)
                    .map((a) => (
                      <li key={a.id} className="text-[12px]">
                        <span className="font-mono text-[11px] text-slate-500">{a.at}</span>{" "}
                        <span className="font-medium text-slate-900">{a.actor}</span>{" "}
                        <span className="text-slate-700">{a.text}</span>
                      </li>
                    ))}
                </ol>
              </div>
            </div>

            <footer className="space-y-2 border-t border-slate-300 bg-slate-50 p-3">
              <ActionButtons model={model} size="sm" />
              <RoleNotice model={model} />
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}
