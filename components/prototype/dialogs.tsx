"use client";

// Single dialog module shared by all variants: approve, reject, request
// information, reassign, plus the permission-denied state.

import { useEffect, useRef } from "react";
import { ASSIGNEES } from "@/lib/prototype/data";
import {
  ACTION_LABEL,
  INFO_ITEMS,
  KycPrototypeModel,
  REJECT_REASONS,
  ROLE_LABEL,
  ROLE_SCOPE,
} from "@/lib/prototype/model";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 flex items-start gap-1 text-[12px] font-medium text-red-800">
      <span aria-hidden>✕</span>
      {message}
    </p>
  );
}

export function ActionDialog({ model }: { model: KycPrototypeModel }) {
  const dialog = model.dialog;
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogKey = dialog ? `${dialog.kind}:${dialog.denied ? "denied" : "form"}` : null;

  useEffect(() => {
    if (!dialogKey) return;
    const el = panelRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    el?.focus();
  }, [dialogKey]);

  if (!dialog || !model.selectedCase) return null;
  const kycCase = model.selectedCase;
  const { kind, fields, errors, denied } = dialog;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-lg border border-slate-300 bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-lg"
      >
        {denied ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Permission check
            </p>
            <h2 id="dialog-title" className="mt-1 flex items-center gap-2 text-[16px] font-semibold text-slate-900">
              <span aria-hidden>🔒</span> {ROLE_LABEL[model.role]} cannot {ACTION_LABEL[kind].toLowerCase()} this case
            </h2>
            <p className="mt-2 text-[13px] text-slate-700">
              This is an access restriction, not a KYC decision. {kycCase.id} remains in its current
              status and no decision was recorded.
            </p>
            <div className="mt-3 rounded border border-slate-300 bg-slate-50 p-3 text-[13px] text-slate-800">
              <p className="font-medium">Your role scope</p>
              <p className="mt-1 text-slate-700">{ROLE_SCOPE[model.role]}</p>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={model.closeDialog}
                className="min-h-[40px] rounded border border-slate-300 bg-white px-3 text-[13px] text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  model.setRole("approver");
                  model.closeDialog();
                }}
                className="min-h-[40px] rounded border border-slate-900 bg-slate-900 px-3 text-[13px] font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Switch to an approver role
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              model.submitDialog();
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {kycCase.id} · {kycCase.applicant}
            </p>
            <h2 id="dialog-title" className="mt-1 text-[16px] font-semibold text-slate-900">
              {ACTION_LABEL[kind]}
            </h2>

            {kind === "approve" && (
              <div className="mt-3 space-y-3">
                <p className="text-[13px] text-slate-700">
                  Approving records an onboarding decision for this applicant and closes the review.
                </p>
                <label className="flex items-start gap-2 text-[13px] text-slate-900">
                  <input
                    type="checkbox"
                    checked={fields.confirmed}
                    onChange={(e) => model.setDialogField("confirmed", e.target.checked)}
                    aria-describedby={errors.confirmed ? "err-confirmed" : undefined}
                    className="mt-0.5 h-5 w-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  />
                  I reviewed identity, ownership and source-of-funds evidence.
                </label>
                <FieldError id="err-confirmed" message={errors.confirmed} />
                <label className="block">
                  <span className="text-[12px] font-medium text-slate-800">Decision note (optional)</span>
                  <textarea
                    value={fields.note}
                    onChange={(e) => model.setDialogField("note", e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded border border-slate-300 p-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  />
                </label>
              </div>
            )}

            {kind === "reject" && (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-[12px] font-medium text-slate-800">Rejection reason</span>
                  <select
                    value={fields.reason}
                    onChange={(e) => model.setDialogField("reason", e.target.value)}
                    aria-invalid={Boolean(errors.reason)}
                    aria-describedby={errors.reason ? "err-reason" : undefined}
                    className={`mt-1 min-h-[40px] w-full rounded border p-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      errors.reason ? "border-red-700" : "border-slate-300"
                    }`}
                  >
                    <option value="">Select a reason</option>
                    {REJECT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <FieldError id="err-reason" message={errors.reason} />
                <label className="block">
                  <span className="text-[12px] font-medium text-slate-800">Decision note</span>
                  <textarea
                    value={fields.note}
                    onChange={(e) => model.setDialogField("note", e.target.value)}
                    rows={3}
                    aria-invalid={Boolean(errors.note)}
                    aria-describedby={errors.note ? "err-note" : undefined}
                    className={`mt-1 w-full rounded border p-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      errors.note ? "border-red-700" : "border-slate-300"
                    }`}
                  />
                </label>
                <FieldError id="err-note" message={errors.note} />
              </div>
            )}

            {kind === "request-info" && (
              <div className="mt-3 space-y-3">
                <fieldset>
                  <legend className="text-[12px] font-medium text-slate-800">Items to request</legend>
                  <div className="mt-1 space-y-1">
                    {INFO_ITEMS.map((item) => (
                      <label key={item} className="flex items-start gap-2 text-[13px] text-slate-900">
                        <input
                          type="checkbox"
                          checked={fields.items.includes(item)}
                          onChange={() => model.toggleDialogItem(item)}
                          className="mt-0.5 h-5 w-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <FieldError id="err-items" message={errors.items} />
                <label className="block">
                  <span className="text-[12px] font-medium text-slate-800">Message to applicant</span>
                  <textarea
                    value={fields.note}
                    onChange={(e) => model.setDialogField("note", e.target.value)}
                    rows={3}
                    aria-invalid={Boolean(errors.note)}
                    aria-describedby={errors.note ? "err-note" : undefined}
                    className={`mt-1 w-full rounded border p-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      errors.note ? "border-red-700" : "border-slate-300"
                    }`}
                  />
                </label>
                <FieldError id="err-note" message={errors.note} />
              </div>
            )}

            {kind === "reassign" && (
              <div className="mt-3 space-y-3">
                <p className="text-[13px] text-slate-700">
                  Currently assigned to <span className="font-medium">{kycCase.assignee}</span>.
                </p>
                <label className="block">
                  <span className="text-[12px] font-medium text-slate-800">New assignee</span>
                  <select
                    value={fields.assignee}
                    onChange={(e) => model.setDialogField("assignee", e.target.value)}
                    aria-invalid={Boolean(errors.assignee)}
                    aria-describedby={errors.assignee ? "err-assignee" : undefined}
                    className={`mt-1 min-h-[40px] w-full rounded border p-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      errors.assignee ? "border-red-700" : "border-slate-300"
                    }`}
                  >
                    {ASSIGNEES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <FieldError id="err-assignee" message={errors.assignee} />
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={model.closeDialog}
                className="min-h-[40px] rounded border border-slate-300 bg-white px-3 text-[13px] text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`min-h-[40px] rounded border px-3 text-[13px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  kind === "reject"
                    ? "border-red-800 bg-red-800 text-white focus-visible:ring-red-800"
                    : "border-slate-900 bg-slate-900 text-white focus-visible:ring-slate-900"
                }`}
              >
                {ACTION_LABEL[kind]}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
