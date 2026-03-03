/**
 * Type definitions for the window.electron API
 * exposed by Electron's preload script via contextBridge.
 */

interface Window {
  electron?: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
  };
}
