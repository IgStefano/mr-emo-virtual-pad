export async function probeAudioProtocol(url, mime, expectedPrefix) {
  const audio = new globalThis.Audio();
  const report = {
    userAgent: globalThis.navigator.userAgent,
    url,
    mime,
    canPlayType: audio.canPlayType(mime),
    physicalLatency: 'BLOCKED: requires loopback measurement',
  };
  const response = await globalThis.fetch(url, {
    headers: { Range: 'bytes=0-15' },
    signal: globalThis.AbortSignal.timeout(15000),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  report.range = {
    status: response.status,
    contentRange: response.headers.get('content-range'),
    contentType: response.headers.get('content-type'),
    bytes: Array.from(bytes),
  };
  if (
    response.status !== 206 ||
    !/^bytes 0-15\/\d+$/.test(report.range.contentRange ?? '') ||
    bytes.length !== 16 ||
    bytes.some((byte, index) => byte !== expectedPrefix[index]) ||
    expectedPrefix.length !== 16
  ) {
    throw new Error(`Range probe failed: ${JSON.stringify(report)}`);
  }
  try {
    await new Promise((resolve, reject) => {
      const timeout = globalThis.setTimeout(
        () => reject(new Error('Metadata timeout')),
        15000,
      );
      audio.onloadedmetadata = () => {
        globalThis.clearTimeout(timeout);
        resolve();
      };
      audio.onerror = () => {
        globalThis.clearTimeout(timeout);
        reject(new Error(`Media error ${audio.error?.code}`));
      };
      audio.preload = 'metadata';
      audio.src = url;
    });
    report.duration = audio.duration;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0)
      throw new Error('Invalid duration');
    report.status = 'METADATA_AND_RANGE_ONLY';
    return report;
  } finally {
    audio.onloadedmetadata = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}
