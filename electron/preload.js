"use strict";
/**
 * Electron Preload Script
 *
 * contextIsolation=true, sandbox=true → window.electron API'si
 * güvenli şekilde renderer'a expose edilir.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electron", {
    getVersion: () => electron_1.ipcRenderer.invoke("app:version"),
    getPlatform: () => electron_1.ipcRenderer.invoke("app:platform"),
});
