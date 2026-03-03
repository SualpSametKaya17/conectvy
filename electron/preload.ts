/**
 * Electron Preload Script
 *
 * contextIsolation=true, sandbox=true → window.electron API'si
 * güvenli şekilde renderer'a expose edilir.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:version"),
  getPlatform: (): Promise<string> => ipcRenderer.invoke("app:platform"),
});
