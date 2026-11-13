import { expect, it } from 'vitest';
import {
  LeaseAction,
  LeasePhase,
  transitionLease,
} from '../../src/domain/lease';
const first = { sessionId: 'session-a', leaseId: 'lease-a' };
const second = { sessionId: 'session-b', leaseId: 'lease-b' };
it('keeps authorization exclusive until the matching cleanup acknowledgement', () => {
  const held = transitionLease(null, LeaseAction.Acquire, first);
  expect(held).toEqual({ owner: first, phase: LeasePhase.Held });
  expect(transitionLease(held, LeaseAction.Acquire, second)).toEqual(held);
  expect(transitionLease(held, LeaseAction.AcknowledgeCleanup, first)).toEqual(
    held,
  );
  const stopping = transitionLease(held, LeaseAction.Stop, first);
  expect(stopping).toEqual({ owner: first, phase: LeasePhase.Cleaning });
  expect(transitionLease(stopping, LeaseAction.Acquire, second)).toEqual(
    stopping,
  );
  expect(
    transitionLease(stopping, LeaseAction.AcknowledgeCleanup, first),
  ).toBeNull();
  expect(transitionLease(null, LeaseAction.Acquire, second)).toEqual({
    owner: second,
    phase: LeasePhase.Held,
  });
});
it('ignores stale sessions, wrong leases and idle acknowledgements', () => {
  for (const action of [LeaseAction.Stop, LeaseAction.AcknowledgeCleanup]) {
    expect(transitionLease(null, action, first)).toBeNull();
    for (const phase of [LeasePhase.Held, LeasePhase.Cleaning]) {
      const state = { owner: first, phase };
      for (const owner of [
        second,
        { ...first, sessionId: 'old' },
        { ...first, leaseId: 'old' },
      ])
        expect(transitionLease(state, action, owner)).toEqual(state);
    }
  }
});
