"use client";

// Variant B — Risk dossier: decision-first. Case identity and risk thesis on
// top, evidence in a readable sequence, activity below, fixed decision rail.

import { ASSIGNEES, COUNTRIES, STATUS_LABEL } from "@/lib/prototype/data";
import { KycPrototypeModel, SortKey } from "@/lib/prototype/model";
import {
  ActionButtons,
  DocResultTag,
  EmptyQueue,
  Field,
  MaskedValue,
  PageSkeleton,
  ResultNotice,
  RiskTag,
  RoleNotice,
  ScenarioControls,
  SeverityMark,
  SlaTag,
  StatusBadge,
} from "./shell";

const selectCls =
  "min-h-[36px] rounded border border-slate-300 bg-white px-2 text-[12px] text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900";

export function VariantB({ model }: { model: KycPrototypeModel }) {
  const c = model.selectedCase;

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-24 md:pb-6">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-300 py-2">
        <span className="text-[13px] font-semibold text-slate-900">Control Room · Risk dossier</span>
        <span className="text-[11px] text-slate-500">Synthetic demo data</span>
        <div className="ml-auto">
          <ScenarioControls model={model} />
        </div>
      </header>

      {/* case navigator: search, filters, sorting, queue */}
      <section aria-label="Case navigator" className="border-b border-slate-300 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[220px] flex-1 items-center">
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
            <select className={selectCls} value={model.sort} onChange={(e) => model.setSort(e.target.value as SortKey)}>
              <option value="risk">Risk</option>
              <option value="sla">SLA</option>
              <option value="submitted">Submitted</option>
              <option value="applicant">Applicant</option>
            </select>
          </label>
          <span className="text-[11px] text-slate-600">
            {model.visibleCases.length} of {model.counts.total} cases
          </span>
        </div>
        <details className="mt-2" open>
          <summary className="cursor-pointer text-[12px] font-medium text-slate-800">Filters</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
        </details>
        {!model.isEmpty && (
          <ul className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {model.visibleCases.map((k) => (
              <li key={k.id}>
                <button
                  type="button"
                  onClick={() => model.selectCase(k.id)}
                  aria-current={k.id === model.selectedCaseId ? "true" : undefined}
                  className={`min-h-[40px] whitespace-nowrap rounded border px-2 py-1 text-left text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    k.id === model.selectedCaseId
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span className="block font-mono">{k.id}</span>
                  <span className="block max-w-[160px] truncate">{k.applicant}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {model.isLoading ? (
        <PageSkeleton label="case dossier" />
      ) : model.isEmpty ? (
        <EmptyQueue model={model} />
      ) : c ? (
        <div className="mt-3 flex gap-4">
          {/* dossier column */}
          <article className="min-w-0 flex-1 space-y-5">
            <div className="border-b border-slate-300 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] text-slate-500">{c.id}</span>
                <RiskTag level={c.riskLevel} score={c.riskScore} />
                <StatusBadge status={c.status} />
                <SlaTag hours={c.slaHoursRemaining} />
              </div>
              <h1 className="mt-1 text-[22px] font-semibold leading-tight text-slate-900">{c.applicant}</h1>
              <p className="text-[12px] text-slate-600">
                {c.entityType} · {c.country} · {c.product} · assigned to {c.assignee} · submitted {c.submittedAt}
              </p>
              <p className="mt-3 max-w-[70ch] border-l-2 border-slate-900 pl-3 text-[15px] leading-relaxed text-slate-900">
                {c.riskThesis}
              </p>
            </div>

            <ResultNotice model={model} />

            <section>
              <h2 className="text-[14px] font-semibold text-slate-900">1. Risk signals</h2>
              <ol className="mt-2 space-y-2">
                {c.signals.map((s) => (
                  <li key={s.id} className="border-l-2 border-slate-300 pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityMark severity={s.severity} />
                      <span className="text-[14px] font-medium text-slate-900">{s.label}</span>
                      <span className="text-[11px] text-slate-500">{s.source}</span>
                    </div>
                    <p className="max-w-[75ch] text-[13px] leading-relaxed text-slate-700">{s.detail}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h2 className="text-[14px] font-semibold text-slate-900">2. Identity evidence</h2>
              <p className="text-[12px] text-slate-500">Sensitive fields are masked until revealed.</p>
              <div className="mt-2 max-w-[70ch] divide-y divide-slate-200 border-y border-slate-200">
                <Field label="Legal name" value={c.identity.legalName} />
                <MaskedValue label="Date of birth" value={c.identity.dateOfBirth} />
                <MaskedValue label="National ID" value={c.identity.nationalId} />
                <MaskedValue label="Email" value={c.identity.email} />
                <MaskedValue label="Phone" value={c.identity.phone} />
                <Field label="Address" value={c.identity.address} />
                <Field label="Occupation" value={c.identity.occupation} />
                <Field label="Expected monthly volume" value={c.expectedMonthlyVolume} />
              </div>
            </section>

            <section>
              <h2 className="text-[14px] font-semibold text-slate-900">3. Document checks</h2>
              <ul className="mt-2 max-w-[80ch] divide-y divide-slate-200 border-y border-slate-200">
                {c.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-baseline gap-2 py-2">
                    <span className="text-[13px] font-medium text-slate-900">{d.name}</span>
                    <DocResultTag result={d.result} />
                    <span className="w-full text-[13px] text-slate-700 sm:w-auto">{d.detail}</span>
                    <span className="ml-auto font-mono text-[11px] text-slate-500">{d.checkedAt}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-[14px] font-semibold text-slate-900">4. Reviewer notes</h2>
              {c.notes.length === 0 ? (
                <p className="mt-1 text-[13px] text-slate-600">No notes on this case.</p>
              ) : (
                <ul className="mt-2 max-w-[75ch] space-y-2">
                  {c.notes.map((n) => (
                    <li key={n.id} className="border-l-2 border-slate-300 pl-3">
                      <p className="text-[12px] text-slate-500">
                        <span className="font-medium text-slate-800">{n.author}</span> · {n.at}
                      </p>
                      <p className="text-[13px] leading-relaxed text-slate-800">{n.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-[14px] font-semibold text-slate-900">5. Activity timeline</h2>
              <ol className="mt-2 max-w-[75ch] border-l border-slate-300 pl-3">
                {model.activity
                  .filter((a) => a.caseId === c.id)
                  .map((a) => (
                    <li key={a.id} className="relative py-1.5 text-[13px]">
                      <span className="absolute -left-[17px] top-3 h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden />
                      <span className="font-mono text-[11px] text-slate-500">{a.at}</span>{" "}
                      <span className="font-medium text-slate-900">{a.actor}</span>{" "}
                      <span className="text-slate-700">{a.text}</span>
                    </li>
                  ))}
              </ol>
            </section>
          </article>

          {/* fixed decision rail */}
          <aside className="hidden w-72 shrink-0 lg:block" aria-label="Decision rail">
            <div className="sticky top-3 space-y-3 rounded border border-slate-300 bg-white p-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Decision</p>
                <p className="text-[13px] font-medium text-slate-900">{c.id}</p>
                <p className="text-[12px] text-slate-600">{c.applicant}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RiskTag level={c.riskLevel} score={c.riskScore} />
                <StatusBadge status={c.status} />
              </div>
              <ActionButtons model={model} layout="column" />
              <RoleNotice model={model} />
              <div className="border-t border-slate-200 pt-2 text-[12px] text-slate-600">
                <p>
                  Critical signals:{" "}
                  <span className="font-medium text-slate-900">
                    {c.signals.filter((s) => s.severity === "critical").length}
                  </span>
                </p>
                <p>
                  Failed documents:{" "}
                  <span className="font-medium text-slate-900">
                    {c.documents.filter((d) => d.result === "fail").length}
                  </span>
                </p>
              </div>
            </div>
          </aside>

          {/* mobile sticky action bar */}
          <div className="fixed inset-x-0 bottom-12 z-30 border-t border-slate-300 bg-white p-2 lg:hidden">
            <ActionButtons model={model} size="sm" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
