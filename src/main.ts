import { app, BrowserWindow, dialog, ipcMain } from "electron/main";

app.disableDomainBlockingFor3DAPIs();
app.commandLine.appendSwitch("disable-gpu-process-crash-limit");
app.commandLine.appendSwitch("force_high_performance_gpu");
process.env.SHIM_MCCOMPAT = '0x800000001';

// Window reference - resolved when window is created
let mainWindow: BrowserWindow | null = null;

// Register IPC handlers SYNCHRONOUSLY at module load
// This ensures they're available when renderer IPC fires
ipcMain.handle("openfolder", async (e, startfolder?: string) => {
    // Use fromWebContents to get the window, or fallback to getAllWindows
    const win = mainWindow || BrowserWindow.fromWebContents(e.sender) || BrowserWindow.getAllWindows()[0];
    return dialog.showOpenDialog(win!, { properties: ["openDirectory"], defaultPath: startfolder });
});

ipcMain.handle("toggledevtools", async (e) => {
    const win = mainWindow || BrowserWindow.fromWebContents(e.sender) || BrowserWindow.getAllWindows()[0];
    win?.webContents.toggleDevTools();
});

app.whenReady().then(async () => {
    mainWindow = new BrowserWindow({
        width: 800, height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    mainWindow.webContents.openDevTools();
    await mainWindow.loadFile(`assets/index.html`);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
