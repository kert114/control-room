"use client";

import { Suspense } from "react";
import { ActionDialog } from "@/components/prototype/dialogs";
import { PrototypeShell } from "@/components/prototype/shell";
import { VariantA } from "@/components/prototype/variant-a";
import { VariantB } from "@/components/prototype/variant-b";
import { VariantC } from "@/components/prototype/variant-c";
import { useKycPrototypeModel } from "@/lib/prototype/model";

function KycPrototype() {
  const model = useKycPrototypeModel();
  return (
    <PrototypeShell model={model}>
      {model.variant === "A" && <VariantA model={model} />}
      {model.variant === "B" && <VariantB model={model} />}
      {model.variant === "C" && <VariantC model={model} />}
      <ActionDialog model={model} />
    </PrototypeShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading prototype…</div>}>
      <KycPrototype />
    </Suspense>
  );
}
