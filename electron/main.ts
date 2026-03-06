/**
 * Electron Main Process
 *
 * Dev mode  : Next.js dev server (localhost:3000) açık olmalı.
 *             `npm run electron:dev` komutu hem Next.js hem Electron'u başlatır.
 *
 * Prod mode : next build çıktısı (.next/standalone) ile next start çalışır.
 *             utilityProcess.fork() kullanılır — kullanıcı makinesinde
 *             Node.js kurulu olmasa bile çalışır (Electron'un Node.js'i kullanılır).
 */

import { app, BrowserWindow, shell, ipcMain, utilityProcess } from "electron";
import type { UtilityProcess } from "electron";
import path from "path";
import http from "http";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const DEV_SERVER_URL = "http://localhost:3000";
const PROD_PORT = 3001;

let mainWindow: BrowserWindow | null = null;
let nextServerProcess: UtilityProcess | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Dış linkleri varsayılan tarayıcıda aç
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadURL(`http://localhost:${PROD_PORT}`);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showError(message: string) {
  if (!mainWindow) {
    mainWindow = new BrowserWindow({
      width: 800,
      height: 500,
      show: true,
      webPreferences: { contextIsolation: true },
    });
  }
  mainWindow.loadURL(
    `data:text/html,<h2 style="font-family:sans-serif;padding:40px;color:#c00">` +
      `Uygulama ba&#351;lat&#305;lamad&#305;.<br><br>` +
      `<small>${message}</small>` +
      `</h2>`
  );
}

/**
 * Sunucunun gerçekten cevap verip vermediğini HTTP isteğiyle kontrol eder.
 * stdout parse yerine bu yöntem çok daha güvenilirdir.
 */
function waitForServer(port: number, timeout = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function tryConnect() {
      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        res.resume(); // yanıtı tüket
        resolve();
      });

      req.setTimeout(1000);
      req.on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Sunucu ${timeout / 1000} saniye içinde başlamadı`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });

      req.end();
    }

    tryConnect();
  });
}

/**
 * Üretim modunda Next.js standalone sunucusunu Electron'un kendi
 * Node.js runtime'ı ile başlatır (kullanıcı makinesinde Node.js gerekmez).
 */
function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const appRoot = path.join(process.resourcesPath, "app");
    const serverScript = path.join(appRoot, "server.js");

    nextServerProcess = utilityProcess.fork(serverScript, [], {
      cwd: appRoot,
      env: {
        ...process.env,
        PORT: String(PROD_PORT),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
      },
      stdio: "pipe",
    });

    nextServerProcess.stdout?.on("data", (data: Buffer) => {
      console.log("[next-server]", data.toString());
    });

    nextServerProcess.stderr?.on("data", (d: Buffer) =>
      console.error("[next-server:err]", d.toString())
    );

    nextServerProcess.on("exit", (code) => {
      console.error(`[next-server] çıktı (kod: ${code})`);
      reject(new Error(`Next.js sunucusu başlamadan çıktı (kod: ${code})`));
    });

    // Süreci başlat, ardından HTTP ile hazır olup olmadığını kontrol et
    waitForServer(PROD_PORT, 30_000)
      .then(resolve)
      .catch(reject);
  });
}

app.on("ready", async () => {
  if (!isDev) {
    try {
      await startNextServer();
    } catch (err) {
      console.error("[main] Sunucu hatası:", err);
      showError(String(err));
      return;
    }
  }
  createWindow();
});

app.on("window-all-closed", () => {
  nextServerProcess?.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

// IPC köprüleri
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("app:platform", () => process.platform);
