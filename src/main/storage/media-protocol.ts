import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { assetIdSchema, leaseIdSchema } from '../../contracts/catalog';
import type { AssetId, LeaseId } from '../../contracts/catalog';

export class ManagedMediaProtocol {
  private disposed = false;
  private readonly active = new Set<{
    leaseId: LeaseId;
    controller: AbortController;
  }>();
  constructor(
    private readonly options: {
      mediaRoot: string;
      authorize: (assetId: AssetId, leaseId: LeaseId) => Promise<void>;
    },
  ) {
    if (!isAbsolute(options.mediaRoot))
      throw new Error('Absolute media root required');
  }
  revoke(leaseId: LeaseId): void {
    for (const entry of this.active) {
      if (entry.leaseId === leaseId) entry.controller.abort();
    }
  }
  dispose(): void {
    this.disposed = true;
    for (const entry of this.active) entry.controller.abort();
  }
  async handle(request: Request): Promise<Response> {
    const match = /^pad-media:\/\/media\/([^/?#]+)\?lease=([^&#]+)$/.exec(
      request.url,
    );
    const asset = assetIdSchema.safeParse(match?.[1]);
    const lease = leaseIdSchema.safeParse(match?.[2]);
    if (!asset.success || !lease.success)
      return new Response(null, { status: 400 });
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response(null, { status: 405 });
    if (this.disposed) return new Response(null, { status: 403 });
    const controller = new AbortController();
    const entry = { leaseId: lease.data, controller };
    this.active.add(entry);
    let file: FileHandle | undefined;
    const cleanup = async () => {
      request.signal.removeEventListener('abort', abort);
      this.active.delete(entry);
      await file?.close();
    };
    const abort = () => {
      controller.abort();
    };
    request.signal.addEventListener('abort', abort);
    if (request.signal.aborted) abort();
    try {
      try {
        await this.options.authorize(asset.data, lease.data);
      } catch {
        await cleanup();
        return new Response(null, { status: 403 });
      }
      controller.signal.throwIfAborted();
      file = await open(
        join(this.options.mediaRoot, asset.data),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      controller.signal.throwIfAborted();
      const stat = await file.stat();
      controller.signal.throwIfAborted();
      if (!stat.isFile()) throw new Error();
      let start = 0;
      let end = stat.size - 1;
      const range = request.headers.get('range');
      if (range !== null) {
        if (!/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
          await cleanup();
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${String(stat.size)}` },
          });
        }
        const dash = range.indexOf('-', 6);
        const first = range.slice(6, dash);
        const last = range.slice(dash + 1);
        start =
          first === '' ? Math.max(0, stat.size - Number(last)) : Number(first);
        end =
          first === '' || last === ''
            ? stat.size - 1
            : Math.min(Number(last), stat.size - 1);
        if (start > end) {
          await cleanup();
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${String(stat.size)}` },
          });
        }
      }
      const headers = new Headers({
        'Content-Type': 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
      });
      if (range !== null)
        headers.set(
          'Content-Range',
          `bytes ${String(start)}-${String(end)}/${String(stat.size)}`,
        );
      if (request.method === 'HEAD') {
        await cleanup();
        return new Response(null, {
          status: range === null ? 200 : 206,
          headers,
        });
      }
      const handle = file;
      let position = start;
      const body = new ReadableStream<Uint8Array>(
        {
          start(stream) {
            controller.signal.addEventListener('abort', () => {
              stream.error(new Error());
              void cleanup().catch(() => {});
            });
          },
          async pull(stream) {
            try {
              if (position > end) {
                stream.close();
                await cleanup();
                return;
              }
              const buffer = Buffer.alloc(Math.min(65536, end - position + 1));
              const { bytesRead } = await handle.read(
                buffer,
                0,
                buffer.length,
                position,
              );
              if (bytesRead === 0) throw new Error('Unexpected end of media');
              position += bytesRead;
              stream.enqueue(buffer.subarray(0, bytesRead));
            } catch (error) {
              stream.error(error);
              await cleanup();
            }
          },
          cancel: cleanup,
        },
        { highWaterMark: 0 },
      );
      return new Response(body, {
        status: range === null ? 200 : 206,
        headers,
      });
    } catch {
      await cleanup();
      return new Response(null, {
        status: controller.signal.aborted ? 403 : 404,
      });
    }
  }
}
