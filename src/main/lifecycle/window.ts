export interface WindowLifecyclePorts {
  isPlaying: () => boolean;
  confirmClose: () => boolean;
  destroy: () => void;
}

export class WindowLifecycle {
  constructor(private readonly ports: WindowLifecyclePorts) {}
  requestClose(): boolean {
    return !this.ports.isPlaying() || this.ports.confirmClose();
  }
  suspend(): void {
    this.ports.destroy();
  }
}
