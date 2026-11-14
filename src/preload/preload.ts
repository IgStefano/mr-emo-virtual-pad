import { contextBridge, ipcRenderer } from 'electron';
import { createDesktopApi } from './desktop-bridge';
contextBridge.exposeInMainWorld(
  'pad',
  createDesktopApi((channel, payload) => ipcRenderer.invoke(channel, payload)),
);
