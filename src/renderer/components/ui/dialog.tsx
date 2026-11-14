import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  restoreFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  restoreFocus: () => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
          className="dialog-content"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
