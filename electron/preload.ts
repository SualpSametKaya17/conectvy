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
  dbConfig: {
    read: (): Promise<Record<string, string>> => ipcRenderer.invoke("db-config:read"),
    write: (config: Record<string, string>): Promise<void> =>
      ipcRenderer.invoke("db-config:write", config),
  },
  relaunch: (): void => ipcRenderer.send("app:relaunch"),
});
