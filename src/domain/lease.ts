export const LeasePhase = { Held: 'held', Cleaning: 'cleaning' } as const;
export interface Reservation {
  readonly sessionId: string;
  readonly leaseId: string;
}
export type LeaseState = null | {
  readonly owner: Reservation;
  readonly phase: (typeof LeasePhase)[keyof typeof LeasePhase];
};
export const LeaseAction = {
  Acquire: 'acquire',
  Stop: 'stop',
  AcknowledgeCleanup: 'acknowledge-cleanup',
} as const;
export function transitionLease(
  state: LeaseState,
  action: (typeof LeaseAction)[keyof typeof LeaseAction],
  owner: Reservation,
): LeaseState {
  if (action === LeaseAction.Acquire)
    return state ?? { owner, phase: LeasePhase.Held };
  if (
    state === null ||
    state.owner.sessionId !== owner.sessionId ||
    state.owner.leaseId !== owner.leaseId
  )
    return state;
  if (action === LeaseAction.Stop)
    return { owner: state.owner, phase: LeasePhase.Cleaning };
  return state.phase === LeasePhase.Cleaning ? null : state;
}
