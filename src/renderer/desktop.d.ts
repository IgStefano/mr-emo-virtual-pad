import type { DesktopApi } from '../contracts/desktop';
declare global {
  interface Window {
    readonly pad: DesktopApi;
  }
}
