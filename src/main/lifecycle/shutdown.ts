export interface ShutdownPorts {
  closeWindows: () => void;
  hasWindows: () => boolean;
  drain: () => Promise<void>;
  quit: () => void;
  report: (error: unknown) => void;
}

export function retryableCleanup(
  action: () => Promise<void>,
): () => Promise<void> {
  let pending: Promise<void> | null = null;
  return () => {
    pending ??= Promise.resolve()
      .then(action)
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
    return pending;
  };
}

export class ApplicationShutdown {
  private ready = false;
  private pending = false;
  constructor(private readonly ports: ShutdownPorts) {}

  request(): boolean {
    if (this.ready) return true;
    if (this.pending) return false;
    this.pending = true;
    this.ports.closeWindows();
    if (this.ports.hasWindows()) {
      this.pending = false;
      return false;
    }
    void this.ports
      .drain()
      .then(() => {
        this.ready = true;
        this.ports.quit();
      })
      .catch((error: unknown) => {
        this.pending = false;
        this.ports.report(error);
      });
    return false;
  }
}
