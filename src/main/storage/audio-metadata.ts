import { parseFile } from 'music-metadata';
import { z } from 'zod';
import { CatalogFault } from './catalog-store';
import { ErrorCode } from '../../contracts/operations';

const durationSchema = z.number().positive();

export async function validateAudio(
  stagedPath: string,
): Promise<{ durationSeconds: number }> {
  const metadata = await parseFile(stagedPath).catch(() => {
    throw new CatalogFault(ErrorCode.UnsupportedFormat);
  });
  const duration = durationSchema.safeParse(metadata.format.duration);
  if (!duration.success) throw new CatalogFault(ErrorCode.UnsupportedFormat);
  return { durationSeconds: duration.data };
}
