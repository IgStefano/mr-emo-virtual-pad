import { describe, expect, it } from 'vitest';
import {
  assetIdSchema,
  padIdSchema,
  repertoireIdSchema,
  sessionIdSchema,
  leaseIdSchema,
  attemptIdSchema,
  catalogSchema,
  assetSchema,
  padSchema,
  repertoireSchema,
  revisionSchema,
} from '../../src/contracts/catalog';
import {
  operationErrorSchema,
  leaseSchema,
  editRequestSchema,
  updatePadSchema,
  reorderPadsSchema,
  deletePadSchema,
  playbackRequestSchema,
} from '../../src/contracts/operations';

const id = '00000000-0000-4000-8000-000000000001';
const asset = { id, name: 'Track', durationSeconds: 12 };
const pad = { id, assetId: id, label: 'Track', color: 'blue' };
const repertoire = { id, name: 'Set', padIds: [id] };
const lease = { sessionId: id, leaseId: id, kind: 'edit', attemptId: 1 };
const edit = { lease, expectedRevision: 0 };

describe('catalog wire contracts', () => {
  it('accepts a versioned catalog without a thirty pad limit', () => {
    const catalog = {
      schemaVersion: 1,
      revision: 0,
      assets: [asset],
      pads: [pad],
      repertoire,
    };
    expect(catalogSchema.parse(catalog)).toEqual(catalog);
    expect(
      catalogSchema.safeParse({
        ...catalog,
        pads: Array.from({ length: 31 }, () => pad),
      }).success,
    ).toBe(true);
    for (const patch of [
      { schemaVersion: 2 },
      { revision: -1 },
      { extra: true },
      { pads: [{}] },
      { assets: [{}] },
      { repertoire: {} },
    ]) {
      expect(catalogSchema.safeParse({ ...catalog, ...patch }).success).toBe(
        false,
      );
    }
  });
  it('rejects invalid identifiers and nonintegral attempts/revisions', () => {
    for (const schema of [
      assetIdSchema,
      padIdSchema,
      repertoireIdSchema,
      sessionIdSchema,
      leaseIdSchema,
    ]) {
      expect(schema.parse(id)).toBe(id);
      for (const value of ['', '../file', 1])
        expect(schema.safeParse(value).success).toBe(false);
    }
    expect(attemptIdSchema.parse(1)).toBe(1);
    expect(revisionSchema.parse(0)).toBe(0);
    for (const value of [-1, 1.5, Infinity, '1']) {
      expect(attemptIdSchema.safeParse(value).success).toBe(false);
      expect(revisionSchema.safeParse(value).success).toBe(false);
    }
    expect(attemptIdSchema.safeParse(0).success).toBe(false);
  });
  it('validates every catalog record and rejects unknown fields', () => {
    for (const [schema, value, patches] of [
      [
        assetSchema,
        asset,
        [
          { name: '' },
          { durationSeconds: 0 },
          { durationSeconds: -1 },
          { id: '' },
        ],
      ],
      [
        padSchema,
        pad,
        [{ label: '' }, { color: 'pink' }, { assetId: '' }, { id: '' }],
      ],
      [
        repertoireSchema,
        repertoire,
        [{ name: '' }, { padIds: ['bad'] }, { id: '' }],
      ],
    ] as const) {
      expect(schema.parse(value)).toEqual(value);
      for (const patch of [...patches, { extra: true }])
        expect(schema.safeParse({ ...value, ...patch }).success).toBe(false);
    }
  });
});
describe('operation ingress', () => {
  it('validates session-bound leases and finite errors', () => {
    expect(leaseSchema.parse(lease)).toEqual(lease);
    for (const patch of [
      { sessionId: '' },
      { leaseId: '' },
      { kind: 'other' },
      { attemptId: 0 },
      { extra: true },
    ])
      expect(leaseSchema.safeParse({ ...lease, ...patch }).success).toBe(false);
    const codes = [
      'invalid-request',
      'unauthorized',
      'busy',
      'stale-revision',
      'not-found',
      'unsupported-format',
      'storage-failure',
      'cleanup-required',
      'future-schema',
      'corrupt-catalog',
      'audio-failure',
    ];
    for (const code of codes)
      expect(operationErrorSchema.parse({ code })).toEqual({ code });
    expect(operationErrorSchema.safeParse({ code: 'other' }).success).toBe(
      false,
    );
    expect(
      operationErrorSchema.safeParse({ code: 'busy', extra: true }).success,
    ).toBe(false);
  });
  it('requires an edit lease and expected revision for catalog writes', () => {
    const cases = [
      [editRequestSchema, edit],
      [updatePadSchema, { ...edit, padId: id, label: 'New', color: 'red' }],
      [reorderPadsSchema, { ...edit, padIds: [id] }],
      [deletePadSchema, { ...edit, padId: id }],
    ] as const;
    for (const [schema, value] of cases) {
      expect(schema.parse(value)).toEqual(value);
      for (const patch of [
        { lease: { ...lease, kind: 'playback' } },
        { expectedRevision: -1 },
        { extra: true },
      ])
        expect(schema.safeParse({ ...value, ...patch }).success).toBe(false);
    }
    for (const patch of [{ padId: '' }, { label: '' }, { color: 'pink' }])
      expect(
        updatePadSchema.safeParse({
          ...edit,
          padId: id,
          label: 'New',
          color: 'red',
          ...patch,
        }).success,
      ).toBe(false);
    expect(
      reorderPadsSchema.safeParse({ ...edit, padIds: ['bad'] }).success,
    ).toBe(false);
    expect(deletePadSchema.safeParse({ ...edit, padId: '' }).success).toBe(
      false,
    );
  });
  it('correlates playback requests without accepting paths', () => {
    const request = { sessionId: id, attemptId: 1, padId: id };
    expect(playbackRequestSchema.parse(request)).toEqual(request);
    for (const patch of [
      { sessionId: '' },
      { attemptId: 0 },
      { padId: '../audio' },
      { path: '/tmp/audio' },
    ])
      expect(
        playbackRequestSchema.safeParse({ ...request, ...patch }).success,
      ).toBe(false);
  });
});
