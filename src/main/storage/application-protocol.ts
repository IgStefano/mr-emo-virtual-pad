import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { extname, isAbsolute, join, relative, sep } from 'node:path';

const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};
export class ApplicationProtocol {
  constructor(private readonly rendererRoot: string) {
    if (!isAbsolute(rendererRoot))
      throw new Error('Absolute renderer root required');
  }
  async handle(request: Request): Promise<Response> {
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response(null, { status: 405 });
    const match = /^pad-app:\/\/app\/([^?#]+)$/.exec(request.url);
    if (!match) return new Response(null, { status: 400 });
    try {
      const name = decodeURIComponent(
        request.url.slice('pad-app://app/'.length),
      );
      if (
        name
          .split(/[\\/]/)
          .some((part) => part === '..' || part === '.' || part === '')
      )
        return new Response(null, { status: 400 });
      const root = await realpath(this.rendererRoot);
      const path = await realpath(join(root, name));
      const child = relative(root, path);
      if (isAbsolute(child) || child.startsWith(`..${sep}`))
        return new Response(null, { status: 403 });
      const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await file.stat();
        if (!stat.isFile()) return new Response(null, { status: 404 });
        const headers = {
          'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
          'Content-Length': String(stat.size),
          'Content-Security-Policy':
            "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; media-src pad-media:; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        };
        return new Response(
          request.method === 'HEAD'
            ? null
            : new Uint8Array(await file.readFile()),
          { headers },
        );
      } finally {
        await file.close();
      }
    } catch {
      return new Response(null, { status: 404 });
    }
  }
}
