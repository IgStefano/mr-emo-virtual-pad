import { z } from 'zod';
import { attemptIdSchema, catalogSchema, sessionIdSchema } from './catalog';
import {
  deletePadSchema,
  editRequestSchema,
  leaseSchema,
  LeaseKind,
  operationErrorSchema,
  reorderPadsSchema,
  updatePadSchema,
} from './operations';

export const appInfoSchema = z.strictObject({ version: z.string() });
export type AppInfo = z.infer<typeof appInfoSchema>;

const session = z.strictObject({ sessionId: sessionIdSchema });
const clientLease = leaseSchema.extend({
  kind: z.enum([LeaseKind.Edit, LeaseKind.Playback]),
});
const result = <T extends z.ZodType>(value: T) =>
  z.union([
    z.strictObject({ ok: z.literal(true), value }),
    z.strictObject({ ok: z.literal(false), error: operationErrorSchema }),
  ]);
export const desktopOperations = {
  openSession: {
    channel: 'catalog:open',
    request: z.null(),
    response: result(sessionIdSchema),
  },
  getCatalog: {
    channel: 'catalog:read',
    request: session,
    response: result(catalogSchema),
  },
  acquire: {
    channel: 'catalog:acquire',
    request: z.strictObject({
      sessionId: sessionIdSchema,
      kind: z.enum([LeaseKind.Edit, LeaseKind.Playback]),
      attemptId: attemptIdSchema,
    }),
    response: result(clientLease),
  },
  release: {
    channel: 'catalog:release',
    request: clientLease,
    response: result(z.null()),
  },
  disposeSession: {
    channel: 'catalog:dispose',
    request: session,
    response: result(z.null()),
  },
  importAudio: {
    channel: 'catalog:import',
    request: editRequestSchema,
    response: result(catalogSchema),
  },
  updatePad: {
    channel: 'catalog:update',
    request: updatePadSchema,
    response: result(catalogSchema),
  },
  reorderPads: {
    channel: 'catalog:reorder',
    request: reorderPadsSchema,
    response: result(catalogSchema),
  },
  deletePad: {
    channel: 'catalog:delete',
    request: deletePadSchema,
    response: result(catalogSchema),
  },
} as const;
export type DesktopOperations = typeof desktopOperations;
export type DesktopApi = {
  [K in keyof DesktopOperations]: (
    request: z.input<DesktopOperations[K]['request']>,
  ) => Promise<z.output<DesktopOperations[K]['response']>>;
} & { getAppInfo: () => Promise<z.infer<typeof appInfoSchema>> };
