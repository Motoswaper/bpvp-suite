import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import {
  initVault,
  createWalletSeed,
  deriveWalletAddress,
  signWalletMessage,
  vaultStatus
} from "../dist/core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 760,
    title: "BPVP Wallet Desktop (Signet/Testnet)",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Keep preload bridge stable in desktop beta; sandboxed preload can
      // intermittently block contextBridge exposure in some local setups.
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function safeCall(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown error" };
  }
}

ipcMain.handle("wallet:init", (_evt, input) => safeCall(() => initVault(input)));
ipcMain.handle("wallet:create-seed", (_evt, input) => safeCall(() => createWalletSeed(input)));
ipcMain.handle("wallet:derive", (_evt, input) => safeCall(() => deriveWalletAddress(input)));
ipcMain.handle("wallet:sign-message", (_evt, input) => safeCall(() => signWalletMessage(input)));
ipcMain.handle("wallet:status", (_evt, input) => safeCall(() => vaultStatus(input)));

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
