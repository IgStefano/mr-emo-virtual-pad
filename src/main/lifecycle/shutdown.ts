export interface ShutdownPorts {
  closeWindows: () => void;
  hasWindows: () => boolean;
  drain: () => Promise<void>;
  quit: () => void;
  report: (error: unknown) => void;
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
