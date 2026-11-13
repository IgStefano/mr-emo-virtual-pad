import { contextBridge, ipcRenderer } from 'electron';
import {
  appInfoChannel,
  appInfoSchema,
  type DesktopApi,
} from '../contracts/app-info';

const desktopApi: DesktopApi = {
  async getAppInfo() {
    const response: unknown = await ipcRenderer.invoke(appInfoChannel);
    return appInfoSchema.parse(response);
  },
};
contextBridge.exposeInMainWorld('pad', desktopApi);
