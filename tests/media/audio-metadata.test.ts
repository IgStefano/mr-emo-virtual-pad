import { expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFile } from 'music-metadata';
import type * as MusicMetadata from 'music-metadata';
import { ManagedFiles } from '../../src/main/storage/managed-files';
import { validateAudio } from '../../src/main/storage/audio-metadata';

vi.mock('music-metadata', async (original) => {
  const actual = await original<typeof MusicMetadata>();
  return { ...actual, parseFile: vi.fn(actual.parseFile) };
});

it('reads duration from an extensionless copied stereo staging file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pad-metadata-'));
  try {
    const bytes = Buffer.alloc(44 + 48000 * 4);
    bytes.write('RIFF');
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(2, 22);
    bytes.writeUInt32LE(48000, 24);
    bytes.writeUInt32LE(192000, 28);
    bytes.writeUInt16LE(4, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36);
    bytes.writeUInt32LE(192000, 40);
    const source = join(directory, 'original.wav');
    await writeFile(source, bytes);
    const staged = await new ManagedFiles(directory).stage(
      source,
      'copied-staging-id',
    );
    await rm(source);
    await expect(validateAudio(staged)).resolves.toEqual({
      durationSeconds: 1,
    });
    await writeFile(staged, 'not audio');
    await expect(validateAudio(staged)).rejects.toThrow('unsupported-format');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it.each([undefined, NaN, Infinity, -Infinity, 0, -1])(
  'rejects unusable metadata duration %s',
  async (duration) => {
    vi.mocked(parseFile).mockResolvedValueOnce({
      format: {
        ...(duration === undefined ? {} : { duration }),
        tagTypes: [],
        trackInfo: [],
      },
      native: {},
      nativeTyped: {},
      common: {
        track: { no: null, of: null },
        disk: { no: null, of: null },
        movementIndex: { no: null, of: null },
      },
      quality: { warnings: [] },
    });
    await expect(validateAudio('copied-staging-id')).rejects.toThrow(
      'unsupported-format',
    );
  },
);
