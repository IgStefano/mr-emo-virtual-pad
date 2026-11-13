import { z } from 'zod';
import {
  attemptIdSchema,
  leaseIdSchema,
  sessionIdSchema,
  padIdSchema,
  revisionSchema,
  PadColor,
} from './catalog';
import type {
  AssetId,
  AttemptId,
  Catalog,
  LeaseId,
  SessionId,
} from './catalog';

export const ErrorCode = {
  InvalidRequest: 'invalid-request',
  Unauthorized: 'unauthorized',
  Busy: 'busy',
  StaleRevision: 'stale-revision',
  NotFound: 'not-found',
  UnsupportedFormat: 'unsupported-format',
  StorageFailure: 'storage-failure',
  CleanupRequired: 'cleanup-required',
  FutureSchema: 'future-schema',
  CorruptCatalog: 'corrupt-catalog',
  AudioFailure: 'audio-failure',
} as const;
export const operationErrorSchema = z.strictObject({ code: z.enum(ErrorCode) });
export type OperationError = z.infer<typeof operationErrorSchema>;
export const LeaseKind = {
  Playback: 'playback',
  Edit: 'edit',
  Recovery: 'recovery',
} as const;
export const leaseSchema = z.strictObject({
  sessionId: sessionIdSchema,
  leaseId: leaseIdSchema,
  kind: z.enum(LeaseKind),
  attemptId: attemptIdSchema,
});
export type Lease = z.infer<typeof leaseSchema>;
export const editRequestSchema = z.strictObject({
  lease: leaseSchema.extend({ kind: z.literal(LeaseKind.Edit) }),
  expectedRevision: revisionSchema,
});
export const updatePadSchema = editRequestSchema.extend({
  padId: padIdSchema,
  label: z.string().min(1),
  color: z.enum(PadColor),
});
export const reorderPadsSchema = editRequestSchema.extend({
  padIds: z.array(padIdSchema),
});
export const deletePadSchema = editRequestSchema.extend({ padId: padIdSchema });
export const playbackRequestSchema = z.strictObject({
  sessionId: sessionIdSchema,
  attemptId: attemptIdSchema,
  padId: padIdSchema,
});
export type Unsubscribe = () => void;
export interface LeaseAuthority {
  acquire: (request: Omit<Lease, 'leaseId'>) => Promise<Lease>;
  release: (lease: Lease) => Promise<void>;
  disposeSession: (sessionId: SessionId) => Promise<void>;
}
export interface CatalogOperations {
  getCatalog: () => Promise<Catalog>;
  importAudio: (request: z.infer<typeof editRequestSchema>) => Promise<Catalog>;
  updatePad: (request: z.infer<typeof updatePadSchema>) => Promise<Catalog>;
  reorderPads: (request: z.infer<typeof reorderPadsSchema>) => Promise<Catalog>;
  deletePad: (request: z.infer<typeof deletePadSchema>) => Promise<Catalog>;
}
export const AudioEventKind = {
  Started: 'started',
  Ended: 'ended',
  Failed: 'failed',
  Progress: 'progress',
} as const;
export interface AudioEvent {
  readonly kind: (typeof AudioEventKind)[keyof typeof AudioEventKind];
  readonly attemptId: AttemptId;
  readonly positionSeconds: number;
  readonly durationSeconds: number;
}
export interface AudioExecutor {
  start: (request: {
    readonly assetId: AssetId;
    readonly leaseId: LeaseId;
    readonly attemptId: AttemptId;
    readonly offset: 0;
  }) => Promise<void>;
  stop: (attemptId: AttemptId) => Promise<void>;
  subscribe: (listener: (event: AudioEvent) => void) => Unsubscribe;
  dispose: () => Promise<void>;
}
