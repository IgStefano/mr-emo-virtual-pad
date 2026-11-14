import { randomUUID } from 'node:crypto';
import {
  attemptIdSchema,
  leaseIdSchema,
  sessionIdSchema,
} from '../../contracts/catalog';
import type { AttemptId, SessionId } from '../../contracts/catalog';
import { ErrorCode, LeaseKind } from '../../contracts/operations';
import type { Lease } from '../../contracts/operations';
import { CatalogFault } from '../storage/catalog-store';

export class SessionAuthority {
  private session: SessionId | null = null;
  private held: Lease | null = null;

  async open(recover: (lease: Lease) => Promise<void>): Promise<SessionId> {
    if (this.session !== null) throw new CatalogFault(ErrorCode.Busy);
    const sessionId = sessionIdSchema.parse(randomUUID());
    this.session = sessionId;
    const lease = this.reserve(
      sessionId,
      LeaseKind.Recovery,
      attemptIdSchema.parse(1),
    );
    try {
      await recover(lease);
      this.held = null;
      return sessionId;
    } catch (error) {
      this.session = null;
      this.held = null;
      throw error;
    }
  }

  reserve(
    sessionId: SessionId,
    kind: Lease['kind'],
    attemptId: AttemptId,
  ): Lease {
    if (sessionId !== this.session)
      throw new CatalogFault(ErrorCode.Unauthorized);
    if (this.held !== null) throw new CatalogFault(ErrorCode.Busy);
    const lease = {
      sessionId,
      leaseId: leaseIdSchema.parse(randomUUID()),
      kind,
      attemptId,
    };
    this.held = lease;
    return lease;
  }

  assert(lease: Lease): void {
    if (
      lease.sessionId !== this.session ||
      this.held?.leaseId !== lease.leaseId ||
      this.held.kind !== lease.kind ||
      this.held.attemptId !== lease.attemptId
    )
      throw new CatalogFault(ErrorCode.Unauthorized);
  }

  release(lease: Lease): void {
    this.assert(lease);
    this.held = null;
  }

  close(sessionId: SessionId): void {
    if (sessionId !== this.session)
      throw new CatalogFault(ErrorCode.Unauthorized);
    if (this.held?.kind === LeaseKind.Recovery)
      throw new CatalogFault(ErrorCode.Busy);
    this.session = null;
    this.held = null;
  }
}
