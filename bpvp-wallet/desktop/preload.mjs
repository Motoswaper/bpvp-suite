import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("bpvpWallet", {
  init: (input) => ipcRenderer.invoke("wallet:init", input),
  createSeed: (input) => ipcRenderer.invoke("wallet:create-seed", input),
  derive: (input) => ipcRenderer.invoke("wallet:derive", input),
  signMessage: (input) => ipcRenderer.invoke("wallet:sign-message", input),
  status: (input) => ipcRenderer.invoke("wallet:status", input)
});
