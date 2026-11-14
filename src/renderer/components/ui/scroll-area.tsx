import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import type { ReactNode } from 'react';
export function ScrollArea({ children }: { children: ReactNode }) {
  return (
    <ScrollAreaPrimitive.Root className="scroll-area">
      <ScrollAreaPrimitive.Viewport className="scroll-viewport">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="scrollbar"
      >
        <ScrollAreaPrimitive.Thumb className="scroll-thumb" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}
