import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function fixtures(directory) {
  await mkdir(directory, { recursive: true });
  const rate = 48000;
  const frames = rate;
  const bytes = Buffer.alloc(44 + frames * 4);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 4, 28);
  bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(frames * 4, 40);
  for (let frame = 0; frame < frames; frame++) {
    bytes.writeInt16LE(
      frame < rate / 2 ? (frame % 48 < 24 ? 8192 : -8192) : 0,
      44 + frame * 4,
    );
    bytes.writeInt16LE(
      frame >= rate / 2 ? (frame % 24 < 12 ? 4096 : -4096) : 0,
      46 + frame * 4,
    );
  }
  const manifest = {
    file: 'stereo.wav',
    license: 'CC0-1.0',
    format: 'PCM signed 16-bit little-endian stereo',
    rate,
    frames,
    channels: [
      'Left only 1 kHz square wave, first half second',
      'Right only 2 kHz square wave, second half second',
    ],
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  await writeFile(path.join(directory, manifest.file), bytes);
  await writeFile(
    path.join(directory, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  return manifest;
}
