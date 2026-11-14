import { mkdtemp, writeFile, rm, symlink, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof fs>()),
}));
import { ManagedMediaProtocol } from '../../src/main/storage/media-protocol';
import { ApplicationProtocol } from '../../src/main/storage/application-protocol';
import { leaseIdSchema } from '../../src/contracts/catalog';

const id = 'b91324d5-07bf-4cd5-b110-bd78d68b9778';
const lease = leaseIdSchema.parse('b91324d5-07bf-4cd5-b110-bd78d68b9779');
const url = `pad-media://media/${id}?lease=${lease}`;
let root: string;
let media: ManagedMediaProtocol;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pad-protocol-'));
  await writeFile(join(root, id), '0123456789');
  media = new ManagedMediaProtocol({
    mediaRoot: root,
    authorize: () => Promise.resolve(),
  });
});
afterEach(async () => {
  media.dispose();
  await rm(root, { recursive: true, force: true });
});
it.each([
  [undefined, 200, '0123456789'],
  ['bytes=2-4', 206, '234'],
  ['bytes=7-', 206, '789'],
  ['bytes=-3', 206, '789'],
  ['bytes=0-99', 206, '0123456789'],
  ['bytes=-99', 206, '0123456789'],
])('serves exact bytes for %s', async (range, status, bytes) => {
  const response = await media.handle(
    new Request(url, { headers: range ? { Range: range } : {} }),
  );
  expect(response.status).toBe(status);
  expect(response.headers.get('content-length')).toBe(String(bytes.length));
  expect(response.headers.get('accept-ranges')).toBe('bytes');
  expect(response.headers.get('content-type')).toBe('application/octet-stream');
  expect(response.headers.get('content-range')).toBe(
    range
      ? `bytes ${bytes === '234' ? '2-4' : bytes === '789' ? '7-9' : '0-9'}/10`
      : null,
  );
  expect(await response.text()).toBe(bytes);
});
it.each([
  'bytes=',
  'bytes=-',
  'bytes=-0',
  'bytes=10-',
  'bytes=5-4',
  'bytes=0-1,3-4',
  'items=0-2',
  'bytes=999999999999999999999-',
  'bytes=0-999999999999999999999',
])('rejects invalid range %s', async (range) => {
  const response = await media.handle(new Request(url, { headers: { range } }));
  // Oversized end bounds are clamped to the file size.
  expect(response.status).toBe(
    range === 'bytes=0-999999999999999999999' ? 206 : 416,
  );
  expect(response.headers.get('content-range')).toBe(
    response.status === 416 ? 'bytes */10' : 'bytes 0-9/10',
  );
  await response.body?.cancel();
});
it('supports HEAD and rejects other methods and malformed URLs', async () => {
  const response = await media.handle(new Request(url, { method: 'HEAD' }));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('');
  expect(
    (await media.handle(new Request(url, { method: 'POST' }))).status,
  ).toBe(405);
  for (const bad of [
    url + '&extra=1',
    url + '#x',
    url.replace('media/', 'evil/'),
    url.replace(id, '%2e%2e'),
    url.replace(lease, 'invalid'),
  ])
    expect((await media.handle(new Request(bad))).status).toBe(400);
});
it('rejects expired authorization, absent files and symlinks', async () => {
  const denied = new ManagedMediaProtocol({
    mediaRoot: root,
    authorize: () => Promise.reject(new Error('expired')),
  });
  expect((await denied.handle(new Request(url))).status).toBe(403);
  await rm(join(root, id));
  expect((await media.handle(new Request(url))).status).toBe(404);
  await symlink('/etc/passwd', join(root, id));
  expect((await media.handle(new Request(url))).status).toBe(404);
});
it.each(['revoke', 'dispose', 'abort', 'cancel'])(
  'cleans up active bodies on %s',
  async (action) => {
    const controller = new AbortController();
    const response = await media.handle(
      new Request(url, { signal: controller.signal }),
    );
    if (action === 'cancel') {
      await response.body?.cancel();
      return;
    }
    if (action === 'revoke') {
      media.revoke(lease);
      media.revoke(lease);
    }
    if (action === 'dispose') {
      media.dispose();
      media.dispose();
    }
    if (action === 'abort') controller.abort();
    await expect(response.text()).rejects.toThrow();
  },
);
it.each(['revoke', 'dispose', 'abort'])(
  'prevents late authorization after %s',
  async (action) => {
    let release = () => {};
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const adapter = new ManagedMediaProtocol({
      mediaRoot: root,
      authorize: () => wait,
    });
    const controller = new AbortController();
    const pending = adapter.handle(
      new Request(url, { signal: controller.signal }),
    );
    if (action === 'revoke') adapter.revoke(lease);
    if (action === 'dispose') adapter.dispose();
    if (action === 'abort') controller.abort();
    release();
    expect((await pending).status).toBe(403);
    adapter.dispose();
  },
);
it('surfaces a real truncated stream failure', async () => {
  const response = await media.handle(new Request(url));
  await truncate(join(root, id), 0);
  await expect(response.text()).rejects.toThrow('Unexpected end');
});
it('serves bundled application bytes, HEAD, MIME and restrictive CSP', async () => {
  await writeFile(join(root, 'index.html'), '<h1>pad</h1>');
  const app = new ApplicationProtocol(root);
  const response = await app.handle(new Request('pad-app://app/index.html'));
  expect(await response.text()).toBe('<h1>pad</h1>');
  expect(response.headers.get('content-type')).toBe('text/html');
  expect(response.headers.get('content-length')).toBe('12');
  expect(response.headers.get('content-security-policy')).toContain(
    'media-src pad-media:',
  );
  expect(response.headers.get('content-security-policy')).toContain(
    "connect-src 'none'",
  );
  expect(
    await (
      await app.handle(
        new Request('pad-app://app/index.html', { method: 'HEAD' }),
      )
    ).text(),
  ).toBe('');
  expect(
    (
      await app.handle(
        new Request('pad-app://app/index.html', { method: 'POST' }),
      )
    ).status,
  ).toBe(405);
  await symlink('/etc/passwd', join(root, 'escape'));
  expect((await app.handle(new Request('pad-app://app/escape'))).status).toBe(
    403,
  );
  for (const bad of [
    'pad-app://evil/index.html',
    'pad-app://app/%2e%2e%2fsecret',
    'pad-app://app/%zz',
    'pad-app://app/missing',
  ])
    expect((await app.handle(new Request(bad))).status).toBeGreaterThanOrEqual(
      400,
    );
});

it.each(['revoke', 'dispose'])(
  'closes a late file open after %s',
  async (action) => {
    const opened = await fs.open(join(root, id), 'r');
    let release = () => {};
    let notify = () => {};
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      notify = resolve;
    });
    const stat = vi.spyOn(opened, 'stat');
    const spy = vi.spyOn(fs, 'open').mockImplementationOnce(async () => {
      notify();
      await waiting;
      return opened;
    });
    try {
      const pending = media.handle(new Request(url));
      await reached;
      if (action === 'revoke') media.revoke(lease);
      else media.dispose();
      release();
      expect((await pending).status).toBe(403);
      expect(stat).not.toHaveBeenCalled();
      await expect(opened.stat()).rejects.toThrow();
    } finally {
      spy.mockRestore();
      await opened.close();
    }
  },
);
it('rejects relative roots', () => {
  expect(() => new ApplicationProtocol('relative')).toThrow(
    'Absolute renderer root required',
  );
  expect(
    () =>
      new ManagedMediaProtocol({
        mediaRoot: '.',
        authorize: () => Promise.resolve(),
      }),
  ).toThrow('Absolute media root required');
});
it('does not authorize malformed URLs or disposed requests', async () => {
  const authorize = vi.fn(() => Promise.resolve());
  const adapter = new ManagedMediaProtocol({ mediaRoot: root, authorize });
  expect(
    (await adapter.handle(new Request('pad-media://media/no'))).status,
  ).toBe(400);
  adapter.dispose();
  expect((await adapter.handle(new Request(url))).status).toBe(403);
  expect(authorize).not.toHaveBeenCalled();
});
it('serves empty files and rejects ranges on them', async () => {
  await truncate(join(root, id), 0);
  const response = await media.handle(new Request(url));
  expect(response.headers.get('content-length')).toBe('0');
  expect(await response.text()).toBe('');
  expect(
    (await media.handle(new Request(url, { headers: { range: 'bytes=0-' } })))
      .status,
  ).toBe(416);
});
it('rejects an already aborted request', async () => {
  const signal = AbortSignal.abort();
  expect((await media.handle(new Request(url, { signal }))).status).toBe(403);
});
it('serves a bounded range of a sparse long track', async () => {
  await truncate(join(root, id), 2 ** 32);
  const response = await media.handle(
    new Request(url, { headers: { range: 'bytes=4294967293-' } }),
  );
  expect(response.status).toBe(206);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(
    new Uint8Array(3),
  );
});
it.each(['.js', '.css', '.svg', '.png', '.woff2', '.json', '.ico', '.bin'])(
  'serves bundled %s assets',
  async (extension) => {
    const name = 'asset' + extension;
    await writeFile(join(root, name), 'asset');
    const response = await new ApplicationProtocol(root).handle(
      new Request('pad-app://app/' + name),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('asset');
    expect(response.headers.get('content-type')).toBe(
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.woff2': 'font/woff2',
        '.json': 'application/json',
        '.ico': 'image/x-icon',
        '.bin': 'application/octet-stream',
      }[extension],
    );
  },
);
it.each([
  'pad-app://app/%2e%2e%2fsecret',
  'pad-app://app/%2e%2findex.html',
  'pad-app://app//index.html',
  'pad-app://app/index.html?x=1',
  'pad-app://app/index.html#x',
  'evilpad-app://app/index.html',
  'pad-app://app/',
])('rejects complete malformed app URL %s', async (bad) => {
  expect(
    (await new ApplicationProtocol(root).handle(new Request(bad))).status,
  ).toBe(400);
});
it.each(['evilpad-media://media/' + id + '?lease=' + lease, url + '?x=1'])(
  'rejects malformed media URL %s',
  async (bad) => {
    expect((await media.handle(new Request(bad))).status).toBe(400);
  },
);
it.each(['garbagebytes=0-2', 'bytes=0-2garbage', 'bytes=-', 'bytes='])(
  'rejects malformed range %s',
  async (range) => {
    const response = await media.handle(
      new Request(url, { headers: { range } }),
    );
    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */10');
  },
);
it('serves one byte and HEAD ranges', async () => {
  const response = await media.handle(
    new Request(url, { headers: { range: 'bytes=9-9' } }),
  );
  expect(await response.text()).toBe('9');
  const head = await media.handle(
    new Request(url, { method: 'HEAD', headers: { range: 'bytes=1-3' } }),
  );
  expect(head.status).toBe(206);
  expect(head.headers.get('content-range')).toBe('bytes 1-3/10');
  expect(head.headers.get('content-length')).toBe('3');
  expect(await head.text()).toBe('');
});
it('rejects directories for both protocols', async () => {
  expect(
    (
      await new ApplicationProtocol(root).handle(
        new Request('pad-app://app/subdir'),
      )
    ).status,
  ).toBe(404);
  await rm(join(root, id));
  await fs.mkdir(join(root, id));
  expect((await media.handle(new Request(url))).status).toBe(404);
  expect(
    (
      await new ApplicationProtocol(root).handle(
        new Request('pad-app://app/' + id),
      )
    ).status,
  ).toBe(404);
});
it('revokes only the selected lease', async () => {
  const secondLease = leaseIdSchema.parse(
    'b91324d5-07bf-4cd5-b110-bd78d68b9780',
  );
  const first = await media.handle(new Request(url));
  const second = await media.handle(
    new Request(url.replace(lease, secondLease)),
  );
  media.revoke(lease);
  await expect(first.text()).rejects.toThrow();
  expect(await second.text()).toBe('0123456789');
});
it('releases completed requests from the cancellation registry', async () => {
  const Original = AbortController;
  const controllers: AbortController[] = [];
  const spy = vi
    .spyOn(globalThis, 'AbortController')
    .mockImplementation(function () {
      const controller = new Original();
      controllers.push(controller);
      return controller;
    });
  try {
    const response = await media.handle(new Request(url));
    expect(await response.text()).toBe('0123456789');
    media.revoke(lease);
    media.dispose();
    expect(controllers.every((controller) => !controller.signal.aborted)).toBe(
      true,
    );
  } finally {
    spy.mockRestore();
  }
});
it('removes request cancellation listeners after completion', async () => {
  const request = new Request(url);
  const remove = vi.spyOn(request.signal, 'removeEventListener');
  expect(await (await media.handle(request)).text()).toBe('0123456789');
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
});
it.each(['revoke', 'dispose'])(
  'closes a file when cancelled during stat by %s',
  async (action) => {
    const opened = await fs.open(join(root, id), 'r');
    const originalStat = opened.stat.bind(opened);
    let release = () => {};
    let notify = () => {};
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      notify = resolve;
    });
    vi.spyOn(opened, 'stat').mockImplementationOnce(async () => {
      notify();
      await wait;
      return originalStat();
    });
    const spy = vi.spyOn(fs, 'open').mockResolvedValueOnce(opened);
    try {
      const pending = media.handle(new Request(url));
      await reached;
      if (action === 'revoke') media.revoke(lease);
      else media.dispose();
      release();
      expect((await pending).status).toBe(403);
      await expect(opened.stat()).rejects.toThrow();
    } finally {
      spy.mockRestore();
      await opened.close();
    }
  },
);
it.each(['HEAD', 'range', 'cancel', 'revoke', 'dispose', 'abort'])(
  'closes the real descriptor on %s',
  async (action) => {
    const opened = await fs.open(join(root, id), 'r');
    const originalClose = opened.close.bind(opened);
    let notify = () => {};
    const closed = new Promise<void>((resolve) => {
      notify = resolve;
    });
    vi.spyOn(opened, 'close').mockImplementation(async () => {
      await originalClose();
      notify();
    });
    const spy = vi.spyOn(fs, 'open').mockResolvedValueOnce(opened);
    try {
      const controller = new AbortController();
      const response = await media.handle(
        new Request(url, {
          method: action === 'HEAD' ? 'HEAD' : 'GET',
          signal: controller.signal,
          headers: action === 'range' ? { range: 'bytes=20-' } : {},
        }),
      );
      if (action === 'cancel') await response.body?.cancel();
      if (action === 'revoke') media.revoke(lease);
      if (action === 'dispose') media.dispose();
      if (action === 'abort') controller.abort();
      await closed;
      await expect(opened.stat()).rejects.toThrow();
    } finally {
      spy.mockRestore();
      await originalClose();
    }
  },
);

it('returns application HEAD metadata and rejects directory HEAD', async () => {
  await writeFile(join(root, 'index.html'), 'pad');
  const adapter = new ApplicationProtocol(root);
  const head = await adapter.handle(
    new Request('pad-app://app/index.html', { method: 'HEAD' }),
  );
  expect(head.status).toBe(200);
  expect(head.headers.get('content-length')).toBe('3');
  await fs.mkdir(join(root, 'directory'));
  expect(
    (
      await adapter.handle(
        new Request('pad-app://app/directory', { method: 'HEAD' }),
      )
    ).status,
  ).toBe(404);
});
it('closes bundled files after HEAD', async () => {
  const opened = await fs.open(join(root, id), 'r');
  const spy = vi.spyOn(fs, 'open').mockResolvedValueOnce(opened);
  try {
    expect(
      (
        await new ApplicationProtocol(root).handle(
          new Request('pad-app://app/' + id, { method: 'HEAD' }),
        )
      ).status,
    ).toBe(200);
    await expect(opened.stat()).rejects.toThrow();
  } finally {
    spy.mockRestore();
    await opened.close();
  }
});
it('does not open a file after pending authorization is revoked', async () => {
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const adapter = new ManagedMediaProtocol({
    mediaRoot: root,
    authorize: () => wait,
  });
  const spy = vi.spyOn(fs, 'open');
  try {
    const response = adapter.handle(new Request(url));
    adapter.revoke(lease);
    release();
    expect((await response).status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
    adapter.dispose();
  }
});
it('rejects a pending reader immediately on revoke while a read is in flight', async () => {
  const opened = await fs.open(join(root, id), 'r');
  const originalRead = opened.read.bind(opened);
  let release = () => {};
  let notify = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    notify = resolve;
  });
  vi.spyOn(opened, 'read').mockImplementationOnce(async () => {
    notify();
    await wait;
    return originalRead(Buffer.alloc(1), 0, 1, 0);
  });
  const spy = vi.spyOn(fs, 'open').mockResolvedValueOnce(opened);
  try {
    const response = await media.handle(new Request(url));
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Expected media body');
    const pending = reader.read();
    await reached;
    media.revoke(lease);
    await expect(pending).rejects.toThrow();
  } finally {
    release();
    spy.mockRestore();
    await opened.close();
  }
});
