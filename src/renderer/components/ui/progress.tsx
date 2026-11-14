import * as ProgressPrimitive from '@radix-ui/react-progress';
export function Progress({ value }: { value: number }) {
  return (
    <ProgressPrimitive.Root
      className="progress"
      value={value}
      aria-label="Progresso"
    >
      <ProgressPrimitive.Indicator
        className="progress-fill"
        style={{ transform: `translateX(-${String(100 - value)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
