"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const isDev = process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
const DEV_SERVER_URL = "http://localhost:3000";
const PROD_PORT = 3001;
let mainWindow = null;
let nextServerProcess = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
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
    // Dış linkleri varsayılan tarayıcıda aç
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
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
function showError(message) {
    if (!mainWindow) {
        mainWindow = new electron_1.BrowserWindow({
            width: 800,
            height: 500,
            show: true,
            webPreferences: { contextIsolation: true },
        });
    }
    mainWindow.loadURL(`data:text/html,<h2 style="font-family:sans-serif;padding:40px;color:#c00">` +
        `Uygulama ba&#351;lat&#305;lamad&#305;.<br><br>` +
        `<small>${message}</small>` +
        `</h2>`);
}
/**
 * Üretim modunda Next.js standalone sunucusunu Electron'un kendi
 * Node.js runtime'ı ile başlatır (kullanıcı makinesinde Node.js gerekmez).
 */
function startNextServer() {
    return new Promise((resolve, reject) => {
        const appRoot = path_1.default.join(process.resourcesPath, "app");
        const serverScript = path_1.default.join(appRoot, "server.js");
        nextServerProcess = electron_1.utilityProcess.fork(serverScript, [], {
            cwd: appRoot,
            env: {
                ...process.env,
                PORT: String(PROD_PORT),
                HOSTNAME: "127.0.0.1",
                NODE_ENV: "production",
            },
            stdio: "pipe",
        });
        let resolved = false;
        nextServerProcess.stdout?.on("data", (data) => {
            const msg = data.toString();
            console.log("[next-server]", msg);
            if (!resolved &&
                (msg.includes("Ready") ||
                    msg.includes("started server") ||
                    msg.includes("Listening"))) {
                resolved = true;
                resolve();
            }
        });
        nextServerProcess.stderr?.on("data", (d) => console.error("[next-server:err]", d.toString()));
        nextServerProcess.on("exit", (code) => {
            console.error(`[next-server] çıktı (kod: ${code})`);
            if (!resolved) {
                resolved = true;
                reject(new Error(`Next.js sunucusu başlamadan çıktı (kod: ${code})`));
            }
        });
        // 15 sn içinde Ready gelmezse devam et (yavaş makineler için)
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve();
            }
        }, 15000);
    });
}
electron_1.app.on("ready", async () => {
    if (!isDev) {
        try {
            await startNextServer();
        }
        catch (err) {
            console.error("[main] Sunucu hatası:", err);
            showError(String(err));
            return;
        }
    }
    createWindow();
});
electron_1.app.on("window-all-closed", () => {
    nextServerProcess?.kill();
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
electron_1.app.on("activate", () => {
    if (mainWindow === null)
        createWindow();
});
// IPC köprüleri
electron_1.ipcMain.handle("app:version", () => electron_1.app.getVersion());
electron_1.ipcMain.handle("app:platform", () => process.platform);
