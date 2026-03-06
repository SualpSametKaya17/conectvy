"use strict";
/**
 * Electron Main Process
 *
 * Dev mode  : Next.js dev server (localhost:3000) açık olmalı.
 *             `npm run electron:dev` komutu hem Next.js hem Electron'u başlatır.
 *
 * Prod mode : next build çıktısı (.next/standalone) ile next start çalışır.
 *             electron-builder ile exe haline getirilir.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const isDev = process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
const DEV_SERVER_URL = "http://localhost:3000";
const PROD_PORT = 3001; // standalone next start port
let mainWindow = null;
let nextServer = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        // Frameless: titlebar-drag CSS class handles drag
        frame: true,
        show: false,
        backgroundColor: "#ffffff",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });
    // Open external links in default browser, not in Electron
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
    if (isDev) {
        mainWindow.loadURL(DEV_SERVER_URL);
        mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    else {
        mainWindow.loadURL(`http://localhost:${PROD_PORT}`);
    }
    mainWindow.on("closed", () => { mainWindow = null; });
}
/** Start embedded Next.js standalone server in production */
function startNextServer() {
    return new Promise((resolve, reject) => {
        const appRoot = path_1.default.join(process.resourcesPath, "app");
        const serverScript = path_1.default.join(appRoot, "server.js");
        // Node.js binary: ortam değişkeninden, yoksa PATH'teki node
        const nodeBin = process.env.ELECTRON_NODE_BIN ?? "node";
        nextServer = (0, child_process_1.spawn)(nodeBin, [serverScript], {
            env: {
                ...process.env,
                PORT: String(PROD_PORT),
                HOSTNAME: "localhost",
                NODE_ENV: "production",
            },
            cwd: appRoot,
        });
        let resolved = false;
        nextServer.stdout?.on("data", (data) => {
            const msg = data.toString();
            console.log("[next-server]", msg);
            if (!resolved && (msg.includes("Ready") || msg.includes("started server"))) {
                resolved = true;
                resolve();
            }
        });
        nextServer.stderr?.on("data", (d) => console.error("[next-server:err]", d.toString()));
        nextServer.on("error", (err) => {
            console.error("[next-server] başlatılamadı:", err.message);
            if (!resolved) {
                resolved = true;
                reject(err);
            }
        });
        nextServer.on("exit", (code) => {
            if (!resolved) {
                resolved = true;
                reject(new Error(`Next.js sunucusu beklenmedik çıkış yaptı (kod: ${code})`));
            }
        });
        // Timeout fallback
        setTimeout(() => { if (!resolved) {
            resolved = true;
            resolve();
        } }, 10000);
    });
}
electron_1.app.on("ready", async () => {
    if (!isDev) {
        try {
            await startNextServer();
        }
        catch (err) {
            console.error("[main] Sunucu hatası:", err);
            // Pencereyi aç, hata sayfası göster
            createWindow();
            mainWindow?.loadURL(`data:text/html,<h2 style="font-family:sans-serif;padding:40px;color:#c00">
          Sunucu başlatılamadı.<br><br>
          <small>${String(err)}</small><br><br>
          <small>Node.js kurulu ve PATH'te olduğundan emin olun.</small>
        </h2>`);
            return;
        }
    }
    createWindow();
});
electron_1.app.on("window-all-closed", () => {
    nextServer?.kill();
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
electron_1.app.on("activate", () => {
    if (mainWindow === null)
        createWindow();
});
// IPC: Renderer → Main güvenli köprü
electron_1.ipcMain.handle("app:version", () => electron_1.app.getVersion());
electron_1.ipcMain.handle("app:platform", () => process.platform);
