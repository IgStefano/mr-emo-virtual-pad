import { z } from 'zod';

export const assetIdSchema = z.uuid().brand<'AssetId'>();
export const padIdSchema = z.uuid().brand<'PadId'>();
export const repertoireIdSchema = z.uuid().brand<'RepertoireId'>();
export const sessionIdSchema = z.uuid().brand<'SessionId'>();
export const leaseIdSchema = z.uuid().brand<'LeaseId'>();
export const attemptIdSchema = z.number().int().positive().brand<'AttemptId'>();
export const revisionSchema = z.number().int().nonnegative();
export const PadColor = {
  Slate: 'slate',
  Red: 'red',
  Blue: 'blue',
  Green: 'green',
  Amber: 'amber',
} as const;
export const assetSchema = z.strictObject({
  id: assetIdSchema,
  name: z.string().min(1),
  durationSeconds: z.number().positive(),
});
export const padSchema = z.strictObject({
  id: padIdSchema,
  assetId: assetIdSchema,
  label: z.string().min(1),
  color: z.enum(PadColor),
});
export const repertoireSchema = z.strictObject({
  id: repertoireIdSchema,
  name: z.string().min(1),
  padIds: z.array(padIdSchema),
});
export const catalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revision: revisionSchema,
  assets: z.array(assetSchema),
  pads: z.array(padSchema),
  repertoire: repertoireSchema,
});
export type AssetId = z.infer<typeof assetIdSchema>;
export type RepertoireId = z.infer<typeof repertoireIdSchema>;
export type PadId = z.infer<typeof padIdSchema>;
export type SessionId = z.infer<typeof sessionIdSchema>;
export type LeaseId = z.infer<typeof leaseIdSchema>;
export type AttemptId = z.infer<typeof attemptIdSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Pad = z.infer<typeof padSchema>;
export type Repertoire = z.infer<typeof repertoireSchema>;
