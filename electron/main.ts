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

import { app, BrowserWindow, shell, ipcMain, utilityProcess, Menu } from "electron";
import type { UtilityProcess } from "electron";
import path from "path";
import http from "http";

// Sadece app.isPackaged kullan — NODE_ENV ortam değişkenine bağımlılık beyaz ekrana neden olur
const isDev = !app.isPackaged;
const DEV_SERVER_URL = "http://localhost:3000";
const PROD_PORT = 3001;
const PROD_URL = `http://127.0.0.1:${PROD_PORT}`;

let mainWindow: BrowserWindow | null = null;
let nextServerProcess: UtilityProcess | null = null;

// Sunucu başlarken gösterilecek yükleme sayfası
const LOADING_HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conectvy</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #1a1a1a;
    }
    .container { text-align: center; }
    .spinner {
      width: 38px;
      height: 38px;
      border: 3px solid #e2e8f0;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 6px; }
    p  { font-size: 13px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Conectvy</h1>
    <p>Uygulama başlatılıyor, lütfen bekleyin…</p>
  </div>
</body>
</html>`;

// ─── Window ────────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
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

  win.once("ready-to-show", () => win.show());

  // Dış linkleri varsayılan tarayıcıda aç
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // F12 ile DevTools aç/kapat (production'da teşhis için)
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      win.webContents.isDevToolsOpened()
        ? win.webContents.closeDevTools()
        : win.webContents.openDevTools({ mode: "detach" });
    }
  });

  win.on("closed", () => { mainWindow = null; });

  return win;
}

function showError(message: string) {
  const safeMsg = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>Hata</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         padding: 48px; color: #1a1a1a; }
  h2 { color: #c00; margin-bottom: 12px; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 6px;
        font-size: 12px; white-space: pre-wrap; word-break: break-all; }
</style>
</head>
<body>
  <h2>Uygulama başlatılamadı</h2>
  <pre>${safeMsg}</pre>
  <p style="margin-top:12px;color:#64748b;font-size:12px">
    Detaylar için F12'ye basın veya sistem yöneticinize başvurun.
  </p>
</body>
</html>`;

  if (!mainWindow) {
    mainWindow = new BrowserWindow({
      width: 800,
      height: 500,
      show: true,
      webPreferences: { contextIsolation: true },
    });
  }
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

// ─── Server ────────────────────────────────────────────────────────────────────

/**
 * Sunucunun gerçekten hazır olduğunu HTTP durum kodu ile doğrular.
 * Sadece 2xx / 3xx yanıt alındığında resolve eder; 5xx'te tekrar dener.
 */
function waitForServer(port: number, timeout = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let settled = false;

    function tryConnect() {
      if (settled) return;

      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        res.resume(); // belleği boşalt
        if (!settled) {
          if (res.statusCode !== undefined && res.statusCode < 500) {
            // 2xx veya 3xx → sunucu gerçekten hazır
            settled = true;
            resolve();
          } else {
            // 5xx → Next.js henüz hazır değil, tekrar dene
            setTimeout(tryConnect, 600);
          }
        }
      });

      req.setTimeout(3000, () => req.destroy());

      req.on("error", () => {
        if (settled) return;
        if (Date.now() - start > timeout) {
          settled = true;
          reject(new Error(`Sunucu ${timeout / 1000} saniye içinde başlamadı`));
        } else {
          setTimeout(tryConnect, 600);
        }
      });

      req.end();
    }

    tryConnect();
  });
}

function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const appRoot      = path.join(process.resourcesPath, "nextjs");
    const serverScript = path.join(appRoot, "server.js");
    const logFile      = path.join(app.getPath("userData"), "server.log");

    // Log dosyasını sıfırla
    const fs = require("fs") as typeof import("fs");
    const writeLog = (line: string) => {
      try { fs.appendFileSync(logFile, line + "\n", "utf8"); } catch {}
    };

    writeLog(`=== Conectvy başlatma logu [${new Date().toISOString()}] ===`);
    writeLog(`appRoot:      ${appRoot}`);
    writeLog(`serverScript: ${serverScript}`);
    writeLog(`logFile:      ${logFile}`);

    // server.js var mı?
    if (!fs.existsSync(serverScript)) {
      const msg = `server.js bulunamadı: ${serverScript}\n\nBuild adımını tekrar çalıştırın:\n  npm run electron:build`;
      writeLog("HATA: " + msg);
      reject(new Error(msg));
      return;
    }

    // Kaydedilmiş DB bağlantı ayarlarını oku
    const dbConfigPath = path.join(app.getPath("userData"), "db-config.json");
    let dbEnvConfig: Record<string, string> = {};
    try {
      if (fs.existsSync(dbConfigPath)) {
        dbEnvConfig = JSON.parse(fs.readFileSync(dbConfigPath, "utf8"));
        writeLog("DB config dosyasından okundu: " + dbConfigPath);
      }
    } catch (e) {
      writeLog("DB config okunamadı: " + e);
    }

    writeLog("server.js bulundu, fork başlatılıyor…");
    console.log("[main] Next.js sunucu başlatılıyor:", serverScript);

    let serverLog = "";  // hata mesajına eklenecek çıktı

    nextServerProcess = utilityProcess.fork(serverScript, [], {
      cwd: appRoot,
      env: {
        ...process.env,
        ...dbEnvConfig,
        PORT:      String(PROD_PORT),
        HOSTNAME:  "127.0.0.1",
        NODE_ENV:  "production",
      },
      stdio: "pipe",
    });

    nextServerProcess.stdout?.on("data", (d: Buffer) => {
      const text = d.toString();
      serverLog += text;
      writeLog("[stdout] " + text.trimEnd());
      console.log("[next-server]", text.trimEnd());
    });

    nextServerProcess.stderr?.on("data", (d: Buffer) => {
      const text = d.toString();
      serverLog += text;
      writeLog("[stderr] " + text.trimEnd());
      console.error("[next-server:err]", text.trimEnd());
    });

    let resolved = false;

    // Süreç, waitForServer'dan önce çıkarsa hata fırlat
    nextServerProcess.once("exit", (code) => {
      writeLog(`[exit] kod: ${code}`);
      console.error(`[next-server] erken çıkış (kod: ${code})`);
      if (!resolved) {
        const details = serverLog.trim() || "(çıktı yok)";
        reject(new Error(
          `Next.js sunucusu başlamadan kapandı (kod: ${code})\n\n` +
          `Log dosyası: ${logFile}\n\n` +
          `--- Sunucu çıktısı ---\n${details}`
        ));
      }
    });

    waitForServer(PROD_PORT, 60_000)
      .then(() => { resolved = true; writeLog("Sunucu hazır."); resolve(); })
      .catch((err) => { resolved = true; writeLog("Timeout: " + err); reject(err); });
  });
}

// ─── App lifecycle ─────────────────────────────────────────────────────────────

app.on("ready", async () => {
  Menu.setApplicationMenu(null);
  mainWindow = createWindow();

  // ── Dev modu ────────────────────────────────────────────────────────────────
  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  // ── Production modu ─────────────────────────────────────────────────────────

  // 1. Önce yükleme ekranını göster (beyaz ekran yerine)
  mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`
  );

  // 2. Next.js sunucusunu başlat
  try {
    await startNextServer();
  } catch (err) {
    console.error("[main] Sunucu başlatma hatası:", err);
    showError(String(err));
    return;
  }

  // 3. Sunucu hazır → gerçek URL'yi yükle
  console.log("[main] Sunucu hazır, uygulama yükleniyor:", PROD_URL);

  let retryCount = 0;
  const MAX_RETRIES = 5;

  const loadApp = () => mainWindow?.loadURL(PROD_URL);

  // Yükleme başarısız olursa sınırlı sayıda yeniden dene
  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDesc) => {
    console.warn(`[main] Sayfa yüklenemedi (${errorCode}): ${errorDesc}`);
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`[main] Yeniden deneniyor (${retryCount}/${MAX_RETRIES})…`);
      setTimeout(loadApp, 1000);
    } else {
      showError(`Sayfa ${MAX_RETRIES} denemeden sonra yüklenemedi.\n\nHata: ${errorDesc}`);
    }
  });

  loadApp();

  // 4. Sunucunun sonraki kapanışını izle
  nextServerProcess?.on("exit", (code) => {
    console.error(`[next-server] beklenmedik kapanış (kod: ${code})`);
    if (mainWindow) {
      showError(`Next.js sunucusu beklenmedik şekilde kapandı (kod: ${code})`);
    }
  });
});

app.on("window-all-closed", () => {
  nextServerProcess?.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    mainWindow = createWindow();
  }
});

// ─── IPC köprüleri ─────────────────────────────────────────────────────────────
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("app:platform", () => process.platform);

const DB_CONFIG_FILE = () => path.join(app.getPath("userData"), "db-config.json");

ipcMain.handle("db-config:read", () => {
  const fs = require("fs") as typeof import("fs");
  try {
    const p = DB_CONFIG_FILE();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {}
  return {};
});

ipcMain.handle("db-config:write", (_e, config: Record<string, string>) => {
  const fs = require("fs") as typeof import("fs");
  fs.writeFileSync(DB_CONFIG_FILE(), JSON.stringify(config, null, 2), "utf8");
});

ipcMain.on("app:relaunch", () => {
  app.relaunch();
  app.exit(0);
});
