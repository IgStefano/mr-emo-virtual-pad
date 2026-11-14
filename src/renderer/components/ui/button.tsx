import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// shadcn/ui Button composition, with this shell's CSS replacing utility classes.
const buttonVariants = cva('button');
export function Button({
  className,
  asChild = false,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      type={type}
      data-slot="button"
      className={cn(buttonVariants(), className)}
      {...props}
    />
  );
}
