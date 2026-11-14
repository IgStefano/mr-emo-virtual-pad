import { expect, it } from 'vitest';
import {
  attemptIdSchema,
  leaseIdSchema,
  sessionIdSchema,
} from '../../src/contracts/catalog';
import { LeaseKind } from '../../src/contracts/operations';
import { SessionAuthority } from '../../src/main/ipc/authority';

const attempt = attemptIdSchema.parse(2);
const stranger = sessionIdSchema.parse('00000000-0000-4000-8000-000000000001');
it('reserves recovery before granting a session and excludes simultaneous acquisition', async () => {
  const authority = new SessionAuthority();
  const session = await authority.open(async (lease) => {
    expect(lease.kind).toBe(LeaseKind.Recovery);
    expect(lease.attemptId).toBe(1);
    expect(() =>
      authority.reserve(lease.sessionId, LeaseKind.Playback, attempt),
    ).toThrow();
    await expect(authority.open(() => Promise.resolve())).rejects.toThrow();
  });
  const playing = authority.reserve(session, LeaseKind.Playback, attempt);
  expect(playing).toMatchObject({
    sessionId: session,
    kind: LeaseKind.Playback,
    attemptId: 2,
  });
  expect(() => authority.reserve(session, LeaseKind.Edit, attempt)).toThrow();
  authority.release(playing);
  const editing = authority.reserve(session, LeaseKind.Edit, attempt);
  expect(editing.leaseId).not.toBe(playing.leaseId);
  expect(() => {
    authority.release(playing);
  }).toThrow();
  authority.assert(editing);
});
it('rejects forged lease fields and revoked sessions', async () => {
  const authority = new SessionAuthority();
  const session = await authority.open(() => Promise.resolve());
  expect(() =>
    authority.reserve(stranger, LeaseKind.Playback, attempt),
  ).toThrow();
  const lease = authority.reserve(session, LeaseKind.Edit, attempt);
  for (const forged of [
    { ...lease, sessionId: stranger },
    { ...lease, leaseId: leaseIdSchema.parse(stranger) },
    { ...lease, kind: LeaseKind.Playback },
    { ...lease, attemptId: attemptIdSchema.parse(3) },
  ])
    expect(() => {
      authority.assert(forged);
    }).toThrow();
  expect(() => {
    authority.close(stranger);
  }).toThrow();
  authority.assert(lease);
  authority.close(session);
  expect(() => {
    authority.assert(lease);
  }).toThrow();
  expect(() => authority.reserve(session, LeaseKind.Edit, attempt)).toThrow();
  const next = await authority.open(() => Promise.resolve());
  expect(next).not.toBe(session);
  authority.reserve(next, LeaseKind.Playback, attempt);
});
it('keeps recovery failures closed and permits a later recovery retry', async () => {
  const authority = new SessionAuthority();
  await expect(
    authority.open(() => Promise.reject(new Error('disk'))),
  ).rejects.toThrow('disk');
  const next = await authority.open(() => Promise.resolve());
  authority.reserve(next, LeaseKind.Edit, attempt);
});
it('prevents replacement authority until pending recovery completes', async () => {
  const authority = new SessionAuthority();
  const session = await authority.open(async (lease) => {
    expect(() => {
      authority.close(lease.sessionId);
    }).toThrow();
    await expect(authority.open(() => Promise.resolve())).rejects.toThrow();
  });
  const lease = authority.reserve(session, LeaseKind.Playback, attempt);
  authority.assert(lease);
});

it('rejects a released lease with an authorization fault and closes an idle session', async () => {
  const authority = new SessionAuthority();
  const session = await authority.open(() => Promise.resolve());
  const lease = authority.reserve(session, LeaseKind.Playback, attempt);
  authority.release(lease);
  expect(() => {
    authority.assert(lease);
  }).toThrow('unauthorized');
  authority.close(session);
  const next = await authority.open(() => Promise.resolve());
  authority.reserve(next, LeaseKind.Edit, attempt);
});
