"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as React from "react";

import { Button } from "@/platform/ui/button";

export interface ActionDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  errorMessage?: string;
  pending?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Review-before-submit dialog for consequential actions. The confirm label must
 * name the outcome rather than say "Confirm".
 */
export function ActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Keep editing",
  errorMessage,
  pending = false,
  children,
  onConfirm,
  open,
  onOpenChange,
}: ActionDialogProps): React.ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-panel p-4 text-ink shadow-lg">
          <Dialog.Title className="text-section font-medium">{title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-body text-muted">
            {description}
          </Dialog.Description>
          {children ? <div className="mt-3">{children}</div> : null}
          {errorMessage ? (
            <p role="alert" className="mt-3 text-body text-danger">
              {errorMessage}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" type="button">
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                void onConfirm();
              }}
            >
              {pending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
