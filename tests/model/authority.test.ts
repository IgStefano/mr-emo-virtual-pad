import assert from 'node:assert/strict';
import { expect, it } from 'vitest';
import { attemptIdSchema } from '../../src/contracts/catalog';
import type { Lease } from '../../src/contracts/operations';
import { LeaseKind } from '../../src/contracts/operations';
import { SessionAuthority } from '../../src/main/ipc/authority';

it('excludes edits and playback using an independent single-token model', async () => {
  for (const seed of [1, 42, 806, 65537]) {
    const authority = new SessionAuthority();
    const session = await authority.open(() => Promise.resolve());
    let token: Lease | undefined;
    let stale: Lease | undefined;
    let random = seed;
    const trace: number[] = [];
    for (let index = 0; index < 100; index++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const command = (random >>> 16) % 4;
      trace.push(command);
      const attempt = attemptIdSchema.parse(index + 1);
      const context = JSON.stringify({ seed, trace });
      if (command < 2) {
        const reserve = () =>
          authority.reserve(
            session,
            command === 0 ? LeaseKind.Edit : LeaseKind.Playback,
            attempt,
          );
        if (token) assert.throws(reserve, /busy/, context);
        else token = reserve();
      } else if (command === 2 && token) {
        authority.release(token);
        stale = token;
        token = undefined;
      } else if (stale) {
        const released = stale;
        assert.throws(
          () => {
            authority.release(released);
          },
          /unauthorized/,
          context,
        );
      }
      if (token) {
        const held = token;
        assert.doesNotThrow(() => {
          authority.assert(held);
        }, context);
      }
    }
    authority.close(session);
    expect(() =>
      authority.reserve(
        session,
        LeaseKind.Playback,
        attemptIdSchema.parse(101),
      ),
    ).toThrow('unauthorized');
  }
});
