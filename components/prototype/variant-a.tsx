"use client";

// Variant A — Operations workstation: triage-first, compact left navigation,
// persistent filters, dense queue, split-pane detail, actions in detail header.

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

export function VariantA({ model }: { model: KycPrototypeModel }) {
  const [mobileDetail, setMobileDetail] = useState(false);
  const c = model.selectedCase;

  return (
    <div className="flex min-h-[calc(100vh-3rem)]">
      {/* left navigation rail */}
      <aside className="hidden w-48 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900 p-3 text-slate-200 md:flex">
        <div>
          <p className="text-[13px] font-semibold text-white">Control Room</p>
          <p className="mb-4 text-[11px] text-slate-400">KYC operations</p>
          <ul className="space-y-0.5 text-[12px]">
            {[
              ["Review queue", model.counts.total],
              ["High risk", model.counts.high],
              ["SLA breached", model.counts.breached],
              ["Awaiting info", model.counts.awaiting],
            ].map(([label, count], i) => (
              <li key={label as string}>
                <button
                  type="button"
                  onClick={() => {
                    if (i === 1) model.setFilter("risk", "high");
                    else if (i === 2) model.setFilter("sla", "breached");
                    else if (i === 3) model.setFilter("status", "awaiting_information");
                    else model.clearFilters();
                  }}
                  className={`flex min-h-[32px] w-full items-center justify-between rounded px-2 text-left hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    i === 0 ? "bg-slate-800 text-white" : "text-slate-300"
                  }`}
                >
                  <span>{label}</span>
                  <span className="font-mono text-[11px] text-slate-400">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <ScenarioControls model={model} tone="dark" />
          <p className="text-[11px] text-slate-400">Synthetic demo data</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-slate-900 p-2 text-slate-100 md:hidden">
          <span className="text-[13px] font-semibold">Control Room · KYC</span>
          <div className="ml-auto">
            <ScenarioControls model={model} tone="dark" />
          </div>
        </div>

        {model.isLoading ? (
          <PageSkeleton label="review queue" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* queue column */}
            <section
              className={`flex min-w-0 flex-1 flex-col border-r border-slate-300 bg-white md:max-w-[60%] ${
                mobileDetail ? "hidden md:flex" : "flex"
              }`}
              aria-label="Case queue"
            >
              <div className="space-y-2 border-b border-slate-300 bg-slate-50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-[180px] flex-1 items-center gap-1.5">
                    <span className="sr-only">Search cases</span>
                    <input
                      value={model.query}
                      onChange={(e) => model.setQuery(e.target.value)}
                      placeholder="Search case, applicant, country"
                      className="min-h-[36px] w-full rounded border border-slate-300 px-2 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-[11px] uppercase text-slate-500">Sort</span>
                    <select
                      className={selectCls}
                      value={model.sort}
                      onChange={(e) => model.setSort(e.target.value as SortKey)}
                    >
                      <option value="risk">Risk</option>
                      <option value="sla">SLA</option>
                      <option value="submitted">Submitted</option>
                      <option value="applicant">Applicant</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
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
                <p className="text-[11px] text-slate-600">
                  {model.visibleCases.length} of {model.counts.total} cases
                </p>
              </div>

              {model.isEmpty ? (
                <EmptyQueue model={model} />
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2 py-1 font-medium">Case</th>
                        <th className="px-2 py-1 font-medium">Risk</th>
                        <th className="hidden px-2 py-1 font-medium lg:table-cell">Status</th>
                        <th className="hidden px-2 py-1 font-medium lg:table-cell">Assignee</th>
                        <th className="px-2 py-1 font-medium">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.visibleCases.map((k) => (
                        <tr
                          key={k.id}
                          className={`cursor-pointer border-b border-slate-200 align-top text-[12px] hover:bg-slate-50 ${
                            k.id === model.selectedCaseId ? "bg-sky-50 ring-1 ring-inset ring-sky-500" : ""
                          }`}
                          onClick={() => {
                            model.selectCase(k.id);
                            setMobileDetail(true);
                          }}
                        >
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                            >
                              <span className="font-mono text-[11px] text-slate-500">{k.id}</span>
                              <span className="block font-medium text-slate-900">{k.applicant}</span>
                              <span className="block text-[11px] text-slate-500">
                                {k.entityType} · {k.country}
                              </span>
                            </button>
                          </td>
                          <td className="px-2 py-1.5">
                            <RiskTag level={k.riskLevel} score={k.riskScore} />
                          </td>
                          <td className="hidden px-2 py-1.5 lg:table-cell">
                            <StatusBadge status={k.status} />
                          </td>
                          <td className="hidden px-2 py-1.5 text-slate-700 lg:table-cell">{k.assignee}</td>
                          <td className="px-2 py-1.5">
                            <SlaTag hours={k.slaHoursRemaining} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* detail pane */}
            <section
              className={`min-w-0 flex-1 flex-col bg-white ${
                mobileDetail ? "flex" : "hidden md:flex"
              } ${model.inspectorOpen ? "md:flex" : "md:hidden"}`}
              aria-label="Case detail"
            >
              {c ? (
                <>
                  <header className="space-y-2 border-b border-slate-300 bg-slate-50 p-3">
                    <button
                      type="button"
                      onClick={() => setMobileDetail(false)}
                      className="min-h-[36px] rounded border border-slate-300 bg-white px-2 text-[12px] md:hidden"
                    >
                      ← Back to queue
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500">{c.id}</span>
                      <RiskTag level={c.riskLevel} score={c.riskScore} />
                      <StatusBadge status={c.status} />
                      <SlaTag hours={c.slaHoursRemaining} />
                    </div>
                    <h2 className="text-[16px] font-semibold text-slate-900">{c.applicant}</h2>
                    <CaseSummaryLine kycCase={c} />
                    <ActionButtons model={model} size="sm" />
                    <RoleNotice model={model} />
                  </header>
                  <ResultNotice model={model} />
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
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
                      <SectionTitle hint={`${c.signals.length} signals`}>Risk signals</SectionTitle>
                      <ul className="space-y-1">
                        {c.signals.map((s) => (
                          <li key={s.id} className="rounded border border-slate-200 p-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <SeverityMark severity={s.severity} />
                              <span className="text-[13px] font-medium text-slate-900">{s.label}</span>
                              <span className="ml-auto text-[11px] text-slate-500">{s.source}</span>
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
                          <li key={d.id} className="flex flex-wrap items-center gap-2 p-2">
                            <span className="text-[13px] text-slate-900">{d.name}</span>
                            <DocResultTag result={d.result} />
                            <span className="w-full text-[12px] text-slate-600 sm:ml-auto sm:w-auto">{d.detail}</span>
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
                            <li key={a.id} className="flex gap-2 text-[12px]">
                              <span className="font-mono text-[11px] text-slate-500">{a.at}</span>
                              <span className="text-slate-800">
                                <span className="font-medium">{a.actor}</span> — {a.text}
                              </span>
                            </li>
                          ))}
                      </ol>
                    </div>
                  </div>
                </>
              ) : (
                <p className="p-4 text-[13px] text-slate-600">Select a case from the queue.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
