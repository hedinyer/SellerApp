import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const isDev = process.env.NODE_ENV === 'development'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      // Mejoras para el manejo de inputs en Electron
      spellcheck: false,
      enableWebSQL: false,
      // Asegurar que los eventos de teclado funcionen correctamente
      backgroundThrottling: false,
    },
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff', // Cambiar a fondo blanco
    title: 'Orderly', // Cambiar el título de la ventana
    icon: join(__dirname, '../public/applogo.ico'), // Agregar el icono
  })

  // Fix para inputs en Electron: Asegurar que los eventos de teclado se manejen correctamente
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Permitir que todos los eventos de teclado se propaguen normalmente
    // Esto ayuda a que los inputs respondan correctamente
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // Open the DevTools.
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
}) 