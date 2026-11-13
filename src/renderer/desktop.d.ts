import type { DesktopApi } from '../contracts/app-info';
declare global {
  interface Window {
    readonly pad: DesktopApi;
  }
}
