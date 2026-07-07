import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import crypto from 'crypto';
import { initDatabase, getDb } from './database';
import { generateExperimentalSection } from './export';

// ── Recurrence computation ──
// Supports simple rules: "daily", "weekly", "monthly", "every N days", "every N weeks"
function computeNextRecurrence(currentDate: string | null, rule: string): string | null {
  if (!currentDate) return null;
  const d = new Date(currentDate + 'T00:00:00');
  if (isNaN(d.getTime())) return null;

  const lower = rule.toLowerCase().trim();

  // every N days
  const daysMatch = lower.match(/every\s+(\d+)\s+day/);
  if (daysMatch) {
    d.setDate(d.getDate() + parseInt(daysMatch[1]));
    return d.toISOString().slice(0, 10);
  }

  // every N weeks
  const weeksMatch = lower.match(/every\s+(\d+)\s+week/);
  if (weeksMatch) {
    d.setDate(d.getDate() + parseInt(weeksMatch[1]) * 7);
    return d.toISOString().slice(0, 10);
  }

  // daily
  if (lower === 'daily') {
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // weekly
  if (lower === 'weekly') {
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  // monthly
  if (lower === 'monthly') {
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  return null;
}

let mainWindow: BrowserWindow | null = null;
let widgetWindow: BrowserWindow | null = null;
let dataPath = '';
const isDev = !app.isPackaged;

// ── Config ──

interface AppConfig {
  dataPath?: string;
}

function configFilePath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(configFilePath())) {
      return JSON.parse(fs.readFileSync(configFilePath(), 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(config: AppConfig) {
  fs.mkdirSync(path.dirname(configFilePath()), { recursive: true });
  fs.writeFileSync(configFilePath(), JSON.stringify(config, null, 2), 'utf-8');
}

// ── Data Path ──

async function ensureDataPath(): Promise<string> {
  const config = loadConfig();
  if (config.dataPath && fs.existsSync(config.dataPath)) {
    console.log('[LabNote] Using saved data path:', config.dataPath);
    return config.dataPath;
  }

  // First launch: use default path immediately (no blocking dialog)
  // User can change it later via settings
  const defaultPath = path.join(app.getPath('documents'), 'LabNoteData');
  console.log('[LabNote] First launch, using default data path:', defaultPath);
  fs.mkdirSync(defaultPath, { recursive: true });
  saveConfig({ ...config, dataPath: defaultPath });
  return defaultPath;
}

// ── Window ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'LabNote — 化学实验记录',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (isDev) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Widget Window ──

let widgetEmbedded = false;
let widgetEmbedCheckTimer: ReturnType<typeof setInterval> | null = null;
let widgetEmbedCheckBusy = false;
let widgetEmbedRetryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Encode a PowerShell script as base64 for use with -EncodedCommand.
 * This completely avoids file parsing, here-string, and line ending issues.
 */
function encodePS1(script: string): string {
  // PowerShell -EncodedCommand expects UTF-16LE (without BOM) encoded as base64
  const buf = Buffer.from(script, 'utf16le');
  return buf.toString('base64');
}

/**
 * Run an encoded PowerShell command asynchronously.
 */
function runEncodedPS1(encoded: string, callback: (err: Error | null, stdout?: string) => void) {
  const { exec } = require('child_process');
  exec(
    `powershell -NoProfile -EncodedCommand "${encoded}"`,
    (err: Error | null, stdout: string, stderr: string) => {
      callback(err, stdout?.trim());
    }
  );
}

/**
 * Get the widget hwnd as a string for PowerShell script interpolation.
 */
function getHwndStr(): string {
  if (!widgetWindow || widgetWindow.isDestroyed()) return '0';
  return String(widgetWindow.getNativeWindowHandle().readUInt32LE(0));
}

/**
 * Embed widget into Windows desktop wallpaper layer.
 * Uses PowerShell -EncodedCommand to avoid all parsing issues.
 * Retries up to 3 times with increasing delays if embedding fails.
 */
function embedWidgetIntoDesktop(attempt = 1) {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const hwnd = getHwndStr();
  const script = `
Add-Type -Name D -Namespace W -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string w);
[DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr c, IntPtr p);
[DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
[DllImport("user32.dll")] public static extern IntPtr GetShellWindow();
[DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern IntPtr SetWindowLongPtr(IntPtr h, int i, IntPtr v);
[DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern IntPtr GetWindowLongPtr(IntPtr h, int i);
[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
'@
$hwnd = [IntPtr]${hwnd}
$progman = [W.D]::GetShellWindow()
[W.D]::SendMessage($progman, 0x052C, [IntPtr]1, [IntPtr]::Zero) | Out-Null
$target = [IntPtr]::Zero
# First, check if SHELLDLL_DefView is directly under Progman
$defView = [W.D]::FindWindowEx($progman, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
if ($defView -ne [IntPtr]::Zero) {
  $target = $progman
} else {
  # Otherwise, look for WorkerW containing SHELLDLL_DefView (Rainmeter scenario)
  $ww = [IntPtr]::Zero
  do {
    $ww = [W.D]::FindWindowEx([IntPtr]::Zero, $ww, "WorkerW", $null)
    if ($ww -ne [IntPtr]::Zero) {
      if ([W.D]::FindWindowEx($ww, [IntPtr]::Zero, "SHELLDLL_DefView", $null) -ne [IntPtr]::Zero) {
        $target = $ww
      }
    }
  } while ($ww -ne [IntPtr]::Zero -and $target -eq [IntPtr]::Zero)
}
# If still no target, use Progman as fallback
if ($target -eq [IntPtr]::Zero) { $target = $progman }
$s = [W.D]::GetWindowLongPtr($hwnd, -16).ToInt64()
$s = ($s -band (-bnot [long]0x80000000)) -bor [long]0x40000000 -bor [long]0x02000000
[W.D]::SetWindowLongPtr($hwnd, -16, [IntPtr]$s) | Out-Null
[W.D]::SetParent($hwnd, $target) | Out-Null
[W.D]::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, 0, 0, 0x0013) | Out-Null
$p = [W.D]::GetParent($hwnd)
if ($p -ne [IntPtr]::Zero) { exit 0 } else { exit 1 }
`;
  const encoded = encodePS1(script);
  runEncodedPS1(encoded, (err) => {
    if (err) {
      console.error(`[widget] Desktop embed attempt ${attempt} failed:`, err.message);
      if (attempt < 3 && widgetWindow && !widgetWindow.isDestroyed()) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        if (widgetEmbedRetryTimer) clearTimeout(widgetEmbedRetryTimer);
        widgetEmbedRetryTimer = setTimeout(() => {
          widgetEmbedRetryTimer = null;
          embedWidgetIntoDesktop(attempt + 1);
        }, delay);
      }
    } else {
      console.log('[widget] Embedded into desktop successfully');
      widgetEmbedded = true;
    }
  });
}

/**
 * Push widget to bottom of z-order (fallback if embedding fails).
 */
function pushWidgetToBottom() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const hwnd = getHwndStr();
  const script = `
Add-Type -Name B -Namespace W -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
'@
[W.B]::SetWindowPos([IntPtr]${hwnd}, [IntPtr]1, 0, 0, 0, 0, 0x0013)
`;
  runEncodedPS1(encodePS1(script), () => {});
}

/**
 * Check if widget is still embedded; re-embed if not.
 */
function checkWidgetEmbed() {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    if (widgetEmbedCheckTimer) { clearInterval(widgetEmbedCheckTimer); widgetEmbedCheckTimer = null; }
    return;
  }
  if (widgetEmbedCheckBusy) return;
  widgetEmbedCheckBusy = true;

  const hwnd = getHwndStr();
  const script = `
Add-Type -Name C -Namespace W -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
'@
$p = [W.C]::GetParent([IntPtr]${hwnd})
if ($p -ne [IntPtr]::Zero) { exit 0 } else { exit 1 }
`;
  runEncodedPS1(encodePS1(script), (err) => {
    widgetEmbedCheckBusy = false;
    if (err) {
      console.log('[widget] Not embedded, re-embedding...');
      widgetEmbedded = false;
      embedWidgetIntoDesktop(1);
    }
  });
}

function createWidgetWindow() {
  const { screen } = require('electron') as typeof Electron;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const widgetWidth = 300;
  const widgetHeight = 520;
  const padding = 20;

  widgetWindow = new BrowserWindow({
    width: widgetWidth,
    height: widgetHeight,
    minWidth: 200,
    maxWidth: 800,
    minHeight: 200,
    maxHeight: 900,
    x: screenWidth - widgetWidth - padding,
    y: padding + 40,
    frame: false,
    alwaysOnTop: false,
    transparent: true,
    backgroundColor: '#00000000',
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    title: 'LabNote Widget',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (isDev) {
    widgetWindow.loadURL(devServerUrl + '#/widget');
  } else {
    const fileUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString() + '#/widget';
    widgetWindow.loadURL(fileUrl);
  }

  // Force content to re-layout on resize (especially needed when embedded into desktop)
  widgetWindow.on('resize', () => {
    widgetWindow?.webContents.executeJavaScript(`
      (function() {
        var root = document.getElementById('root');
        if (root) { root.style.height = window.innerHeight + 'px'; root.style.width = window.innerWidth + 'px'; }
      })();
    `).catch(() => {});
  });

  widgetWindow.on('closed', () => {
    widgetWindow = null;
    widgetEmbedded = false;
    if (widgetEmbedCheckTimer) {
      clearInterval(widgetEmbedCheckTimer);
      widgetEmbedCheckTimer = null;
    }
    if (widgetEmbedRetryTimer) {
      clearTimeout(widgetEmbedRetryTimer);
      widgetEmbedRetryTimer = null;
    }
  });

  // If widget somehow gets focus (shouldn't happen when embedded), push it back down
  widgetWindow.on('focus', () => {
    widgetWindow?.setAlwaysOnTop(false);
    pushWidgetToBottom();
    // Re-embed in case desktop was recreated
    if (!widgetEmbedded) embedWidgetIntoDesktop(1);
  });

  // Embed widget into Windows desktop so it only shows when desktop is visible
  widgetWindow.once('ready-to-show', () => {
    // Delay to ensure native window handle is fully ready, then embed
    setTimeout(() => {
      embedWidgetIntoDesktop(1);
    }, 800);

    // Periodic check: re-embed if desktop was recreated (theme change, explorer restart, etc.)
    widgetEmbedCheckTimer = setInterval(() => {
      checkWidgetEmbed();
    }, 10000);
  });
}

// ── Widget IPC ──

function setupWidgetIpc() {
  ipcMain.handle('widget:toggle', () => {
    if (widgetWindow) {
      widgetWindow.close();
      widgetWindow = null;
    } else {
      createWidgetWindow();
    }
  });

  ipcMain.handle('widget:openMain', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      setupMenu();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.moveTop();
    }
  });

  ipcMain.handle('widget:navigateTo', (_e, path: string) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      setupMenu();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.moveTop();
    }
    // Navigate to the specified path in the main window
    mainWindow?.webContents.executeJavaScript(`window.location.hash = '#${path}'`).catch(() => {});
  });

  ipcMain.handle('widget:refresh', () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('widget:dataChanged');
    }
  });

  ipcMain.handle('widget:devtools', () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.toggleDevTools();
    }
  });
}

function notifyWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('widget:dataChanged');
  }
}

// ── Menu ──

function setupMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: '选择数据库位置...',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: async () => {
            if (!mainWindow) return;
            const result = await dialog.showOpenDialog(mainWindow, {
              title: '选择 LabNote 数据存储目录',
              properties: ['openDirectory', 'createDirectory'],
            });
            if (result.canceled || !result.filePaths.length) return;

            const newPath = result.filePaths[0];
            fs.mkdirSync(newPath, { recursive: true });

            // Save new path to config
            const config = loadConfig();
            saveConfig({ ...config, dataPath: newPath });

            // Update in-memory path
            dataPath = newPath;

            // Reinitialize database at new location
            try {
              // Close old database connection (better-sqlite3 auto-closes on gc)
              initDatabase(newPath);
              // Re-register IPC handlers with new db
              registerIpcHandlers();
              console.log('[LabNote] Database moved to:', newPath);
              mainWindow.webContents.send('app:dataPathChanged', newPath);
            } catch (err: any) {
              console.error('[LabNote] Failed to move database:', err.message);
              dialog.showErrorBox('数据库迁移失败', String(err));
            }
          },
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: '关于 LabNote',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于 LabNote',
              message: 'LabNote — 化学实验记录',
              detail: '版本 1.0.0\n基于 Electron + React + TypeScript',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── Image Protocol ──

function registerImageProtocol() {
  protocol.handle('labnote', (request) => {
    // labnote://images/filename.png
    const urlPath = request.url.slice('labnote://'.length);
    const filePath = path.join(dataPath, urlPath);
    // Prevent path traversal
    const resolved = path.resolve(dataPath, urlPath);
    if (!resolved.startsWith(dataPath)) {
      return new Response('Forbidden', { status: 403 });
    }
    const fileUrl = pathToFileURL(filePath).toString();
    return net.fetch(fileUrl);
  });
}

// ── IPC Handlers ──

function registerIpcHandlers() {
  const db = getDb();
  if (!db) {
    console.error('[LabNote] FATAL: Database not initialized, IPC handlers will not work');
    return;
  }
  console.log('[LabNote] Database ready, registering IPC handlers...');

  // ── Data Path ──
  ipcMain.handle('app:getDataPath', () => dataPath);

  // ── Images ──
  ipcMain.handle('images:save', (_e, dataUrl: string) => {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) throw new Error('Invalid image data URL');
    const [, ext, base64] = match;
    const buffer = Buffer.from(base64, 'base64');
    const filename = `${crypto.randomUUID()}.${ext}`;
    const imagesDir = path.join(dataPath, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    const filePath = path.join(imagesDir, filename);
    fs.writeFileSync(filePath, buffer);
    console.log('[LabNote] Image saved:', filename, `(${buffer.length} bytes)`);
    return filename;
  });

  // ── Projects ──
  ipcMain.handle('projects:list', () => {
    return db.prepare('SELECT p.*, (SELECT COUNT(*) FROM experiments WHERE project_id = p.id) as experiment_count FROM projects p ORDER BY p.created_at DESC').all();
  });

  ipcMain.handle('projects:get', (_e, id: number) => {
    return db.prepare('SELECT p.*, (SELECT COUNT(*) FROM experiments WHERE project_id = p.id) as experiment_count FROM projects p WHERE id = ?').get(id);
  });

  ipcMain.handle('projects:create', (_e, data: { name: string; description?: string; innovations?: string; tasks?: string; progress?: number }) => {
    console.log('[LabNote] projects:create called with:', JSON.stringify(data));
    try {
      const stmt = db.prepare('INSERT INTO projects (name, description, innovations, tasks, progress) VALUES (?, ?, ?, ?, ?)');
      const result = stmt.run(data.name, data.description || null, data.innovations || '', data.tasks || '', data.progress ?? 0);
      console.log('[LabNote] projects:create success, id:', result.lastInsertRowid);
      return Number(result.lastInsertRowid);
    } catch (err) {
      console.error('[LabNote] projects:create error:', err);
      throw err;
    }
  });

  ipcMain.handle('projects:update', (_e, id: number, data: { name?: string; description?: string; innovations?: string; tasks?: string; progress?: number }) => {
    const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!current) return;
    db.prepare('UPDATE projects SET name = ?, description = ?, innovations = ?, tasks = ?, progress = ? WHERE id = ?').run(
      data.name ?? current.name,
      data.description ?? current.description,
      data.innovations ?? current.innovations ?? '',
      data.tasks ?? current.tasks ?? '',
      data.progress ?? current.progress ?? 0,
      id
    );
  });

  ipcMain.handle('projects:delete', (_e, id: number) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  });

  // ── Experiments ──
  ipcMain.handle('experiments:list', () => {
    return db.prepare(`
      SELECT e.*, p.name as project_name
      FROM experiments e
      LEFT JOIN projects p ON e.project_id = p.id
      ORDER BY e.date DESC, e.created_at DESC
    `).all();
  });

  ipcMain.handle('experiments:get', (_e, id: number) => {
    const exp = db.prepare(`
      SELECT e.*, p.name as project_name
      FROM experiments e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE e.id = ?
    `).get(id);

    if (!exp) return null;

    const reactants = db.prepare('SELECT * FROM reactants WHERE experiment_id = ? ORDER BY sort_order').all(id);
    const catalysts = db.prepare('SELECT * FROM catalysts WHERE experiment_id = ? ORDER BY sort_order').all(id);
    const solvents = db.prepare('SELECT * FROM solvents WHERE experiment_id = ? ORDER BY sort_order').all(id);
    const tagRows = db.prepare(`
      SELECT t.* FROM tags t
      JOIN experiment_tags et ON t.id = et.tag_id
      WHERE et.experiment_id = ?
    `).all(id);
    const customModules = db.prepare(
      'SELECT * FROM experiment_module_data WHERE experiment_id = ? ORDER BY sort_order'
    ).all(id);

    return { ...exp, reactants, catalysts, solvents, tags: tagRows, custom_modules: customModules };
  });

  ipcMain.handle('experiments:create', (_e, data: any) => {
    console.log('[LabNote] experiments:create called, title:', data.title);

    // Validate project_id to prevent FOREIGN KEY constraint failure
    if (data.project_id != null) {
      const projectExists = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(data.project_id);
      if (!projectExists) {
        console.warn('[LabNote] experiments:create: project_id', data.project_id, 'does not exist, setting to null');
        data.project_id = null;
      }
    }

    const createTransaction = db.transaction((payload: any) => {
      console.log('[LabNote] experiments:create tx: inserting main record...');
      const insertExp = db.prepare(`
        INSERT INTO experiments (title, project_id, date, container, temperature, time, pressure, ph, stirring, atmosphere, procedure, workup, yield_val, yield_unit, morphology, notes, result_images, structure_image, subtitle, module_layout)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = insertExp.run(
        payload.title, payload.project_id || null, payload.date,
        payload.container || null, payload.temperature || null, payload.time || null,
        payload.pressure || null, payload.ph || null, payload.stirring || null,
        payload.atmosphere || null, payload.procedure || null, payload.workup || null,
        payload.yield_val || null, payload.yield_unit || '%', payload.morphology || null,
        payload.notes || null, payload.result_images || null, payload.structure_image || null, payload.subtitle || '',
        payload.module_layout ? JSON.stringify(payload.module_layout) : null
      );
      const expId = Number(result.lastInsertRowid);
      console.log('[LabNote] experiments:create tx: main record inserted, id:', expId);

      if (payload.reactants?.length) {
        console.log('[LabNote] experiments:create tx: inserting', payload.reactants.length, 'reactants');
        const stmt = db.prepare('INSERT INTO reactants (experiment_id, name, formula, amount, amount_unit, equiv, role, sort_order, structure_image, molecular_weight, molar_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        payload.reactants.forEach((r: any, i: number) => {
          stmt.run(expId, r.name, r.formula || null, r.amount || null, r.amount_unit || null, r.equiv || null, r.role || null, i, r.structure_image || null, r.molecular_weight || null, r.molar_amount || null);
        });
      }

      if (payload.catalysts?.length) {
        console.log('[LabNote] experiments:create tx: inserting', payload.catalysts.length, 'catalysts');
        const stmt = db.prepare('INSERT INTO catalysts (experiment_id, name, amount, amount_unit, sort_order, molecular_weight, molar_amount) VALUES (?, ?, ?, ?, ?, ?, ?)');
        payload.catalysts.forEach((c: any, i: number) => {
          stmt.run(expId, c.name, c.amount || null, c.amount_unit || null, i, c.molecular_weight || null, c.molar_amount || null);
        });
      }

      if (payload.solvents?.length) {
        console.log('[LabNote] experiments:create tx: inserting', payload.solvents.length, 'solvents');
        const stmt = db.prepare('INSERT INTO solvents (experiment_id, name, volume, volume_unit, ratio, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
        payload.solvents.forEach((s: any, i: number) => {
          stmt.run(expId, s.name, s.volume || null, s.volume_unit || null, s.ratio || null, i);
        });
      }

      if (payload.tag_ids?.length) {
        console.log('[LabNote] experiments:create tx: inserting', payload.tag_ids.length, 'tags');
        const stmt = db.prepare('INSERT OR IGNORE INTO experiment_tags (experiment_id, tag_id) VALUES (?, ?)');
        payload.tag_ids.forEach((tid: number) => stmt.run(expId, tid));
      }

      return expId;
    });

    try {
      const expId = createTransaction(data);
      console.log('[LabNote] experiments:create committed, id:', expId);

      // Save custom module data
      if (data.custom_modules?.length) {
        const stmt = db.prepare(
          'INSERT INTO experiment_module_data (experiment_id, module_key, module_type, data, sort_order) VALUES (?, ?, \'custom\', ?, ?)'
        );
        data.custom_modules.forEach((m: any, i: number) => {
          stmt.run(expId, m.module_key, JSON.stringify(m.data), i);
        });
      }

      return expId;
    } catch (err: any) {
      console.error('[LabNote] experiments:create error (transaction rolled back):', err.message || err);
      throw err;
    }
  });

  ipcMain.handle('experiments:update', (_e, id: number, data: any) => {
    console.log('[LabNote] experiments:update called, id:', id, 'title:', data.title);

    // Validate project_id to prevent FOREIGN KEY constraint failure
    if (data.project_id != null) {
      const projectExists = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(data.project_id);
      if (!projectExists) {
        console.warn('[LabNote] experiments:update: project_id', data.project_id, 'does not exist, setting to null');
        data.project_id = null;
      }
    }

    const updateTransaction = db.transaction((expId: number, payload: any) => {
      console.log('[LabNote] experiments:update tx: updating main record...');
      db.prepare(`
        UPDATE experiments SET title=?, project_id=?, date=?, container=?, temperature=?, time=?,
        pressure=?, ph=?, stirring=?, atmosphere=?, procedure=?, workup=?,
        yield_val=?, yield_unit=?, morphology=?, notes=?, result_images=?, structure_image=?, subtitle=?,
        module_layout=?, updated_at=datetime('now','localtime')
        WHERE id=?
      `).run(
        payload.title, payload.project_id || null, payload.date,
        payload.container || null, payload.temperature || null, payload.time || null,
        payload.pressure || null, payload.ph || null, payload.stirring || null,
        payload.atmosphere || null, payload.procedure || null, payload.workup || null,
        payload.yield_val || null, payload.yield_unit || '%', payload.morphology || null,
        payload.notes || null, payload.result_images || null, payload.structure_image || null, payload.subtitle || '',
        payload.module_layout ? JSON.stringify(payload.module_layout) : null, expId
      );

      console.log('[LabNote] experiments:update tx: deleting old sub-entities...');
      db.prepare('DELETE FROM reactants WHERE experiment_id = ?').run(expId);
      db.prepare('DELETE FROM catalysts WHERE experiment_id = ?').run(expId);
      db.prepare('DELETE FROM solvents WHERE experiment_id = ?').run(expId);
      db.prepare('DELETE FROM experiment_tags WHERE experiment_id = ?').run(expId);

      if (payload.reactants?.length) {
        console.log('[LabNote] experiments:update tx: inserting', payload.reactants.length, 'reactants');
        const stmt = db.prepare('INSERT INTO reactants (experiment_id, name, formula, amount, amount_unit, equiv, role, sort_order, structure_image, molecular_weight, molar_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        payload.reactants.forEach((r: any, i: number) => stmt.run(expId, r.name, r.formula || null, r.amount || null, r.amount_unit || null, r.equiv || null, r.role || null, i, r.structure_image || null, r.molecular_weight || null, r.molar_amount || null));
      }
      if (payload.catalysts?.length) {
        console.log('[LabNote] experiments:update tx: inserting', payload.catalysts.length, 'catalysts');
        const stmt = db.prepare('INSERT INTO catalysts (experiment_id, name, amount, amount_unit, sort_order, molecular_weight, molar_amount) VALUES (?, ?, ?, ?, ?, ?, ?)');
        payload.catalysts.forEach((c: any, i: number) => stmt.run(expId, c.name, c.amount || null, c.amount_unit || null, i, c.molecular_weight || null, c.molar_amount || null));
      }
      if (payload.solvents?.length) {
        console.log('[LabNote] experiments:update tx: inserting', payload.solvents.length, 'solvents');
        const stmt = db.prepare('INSERT INTO solvents (experiment_id, name, volume, volume_unit, ratio, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
        payload.solvents.forEach((s: any, i: number) => stmt.run(expId, s.name, s.volume || null, s.volume_unit || null, s.ratio || null, i));
      }
      if (payload.tag_ids?.length) {
        console.log('[LabNote] experiments:update tx: inserting', payload.tag_ids.length, 'tags');
        const stmt = db.prepare('INSERT OR IGNORE INTO experiment_tags (experiment_id, tag_id) VALUES (?, ?)');
        payload.tag_ids.forEach((tid: number) => stmt.run(expId, tid));
      }
    });

    try {
      updateTransaction(id, data);
      console.log('[LabNote] experiments:update committed, id:', id);

      // Save custom module data
      db.prepare('DELETE FROM experiment_module_data WHERE experiment_id = ?').run(id);
      if (data.custom_modules?.length) {
        const stmt = db.prepare(
          'INSERT INTO experiment_module_data (experiment_id, module_key, module_type, data, sort_order) VALUES (?, ?, \'custom\', ?, ?)'
        );
        data.custom_modules.forEach((m: any, i: number) => {
          stmt.run(id, m.module_key, JSON.stringify(m.data), i);
        });
      }
    } catch (err: any) {
      console.error('[LabNote] experiments:update error (transaction rolled back):', err.message || err);
      throw err;
    }
  });

  ipcMain.handle('experiments:delete', (_e, id: number) => {
    db.prepare('DELETE FROM experiments WHERE id = ?').run(id);
  });

  // ── Tags ──
  ipcMain.handle('tags:list', (_e, filterType?: string) => {
    if (filterType) {
      return db.prepare('SELECT * FROM tags WHERE type = ? ORDER BY name').all(filterType);
    }
    return db.prepare('SELECT * FROM tags ORDER BY type, name').all();
  });

  ipcMain.handle('tags:create', (_e, data: { name: string; color?: string; type?: string }) => {
    const stmt = db.prepare('INSERT INTO tags (name, color, type) VALUES (?, ?, ?)');
    const result = stmt.run(data.name, data.color || '#3b82f6', data.type || 'experiment');
    return result.lastInsertRowid;
  });

  ipcMain.handle('tags:delete', (_e, id: number) => {
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  });

  ipcMain.handle('tags:update', (_e, id: number, data: { name: string; color?: string }) => {
    db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(data.name, data.color || '#3b82f6', id);
  });

  // ── Templates ──
  ipcMain.handle('templates:list', () => {
    return db.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all();
  });

  ipcMain.handle('templates:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  });

  ipcMain.handle('templates:create', (_e, data: { name: string; description?: string; template_data: string }) => {
    const stmt = db.prepare('INSERT INTO templates (name, description, template_data) VALUES (?, ?, ?)');
    const result = stmt.run(data.name, data.description || null, data.template_data);
    return result.lastInsertRowid;
  });

  ipcMain.handle('templates:delete', (_e, id: number) => {
    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  });

  ipcMain.handle('templates:update', (_e, id: number, data: { name?: string; description?: string; template_data?: string }) => {
    const current = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    if (!current) return;
    db.prepare(
      'UPDATE templates SET name = ?, description = ?, template_data = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?'
    ).run(
      data.name ?? current.name,
      data.description ?? current.description,
      data.template_data ?? current.template_data,
      id
    );
  });

  ipcMain.handle('templates:increment-usage', (_e, id: number) => {
    db.prepare("UPDATE templates SET usage_count = usage_count + 1, updated_at = datetime('now','localtime') WHERE id = ?").run(id);
  });

  // ── Reagents ──
  ipcMain.handle('reagents:list', () => {
    return db.prepare('SELECT * FROM reagents ORDER BY name').all();
  });

  ipcMain.handle('reagents:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM reagents WHERE id = ?').get(id);
  });

  ipcMain.handle('reagents:create', (_e, data: { name: string; abbreviation?: string; molecular_weight?: number; molecular_formula?: string; structure_image?: string }) => {
    const stmt = db.prepare('INSERT INTO reagents (name, abbreviation, molecular_weight, molecular_formula, structure_image) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(data.name, data.abbreviation || '', data.molecular_weight ?? null, data.molecular_formula || '', data.structure_image || null);
    return result.lastInsertRowid;
  });

  ipcMain.handle('reagents:update', (_e, id: number, data: { name?: string; abbreviation?: string; molecular_weight?: number; molecular_formula?: string; structure_image?: string }) => {
    const current = db.prepare('SELECT * FROM reagents WHERE id = ?').get(id) as any;
    if (!current) return;
    db.prepare('UPDATE reagents SET name = ?, abbreviation = ?, molecular_weight = ?, molecular_formula = ?, structure_image = ? WHERE id = ?').run(
      data.name ?? current.name,
      data.abbreviation ?? current.abbreviation ?? '',
      data.molecular_weight ?? current.molecular_weight ?? null,
      data.molecular_formula ?? current.molecular_formula ?? '',
      data.structure_image ?? current.structure_image ?? null,
      id
    );
  });

  ipcMain.handle('reagents:delete', (_e, id: number) => {
    db.prepare('DELETE FROM reagents WHERE id = ?').run(id);
  });

  // ── Experiment Tags (for filtering) ──
  ipcMain.handle('experiments:tags', (_e, expId: number) => {
    return db.prepare('SELECT tag_id FROM experiment_tags WHERE experiment_id = ?').all(expId);
  });

  // ── Experiment Tags (batch) ──
  ipcMain.handle('experiments:allTags', () => {
    return db.prepare('SELECT experiment_id, tag_id FROM experiment_tags').all();
  });

  // ── Export experimental section ──
  ipcMain.handle('experiments:export', (_e, id: number) => {
    const exp = db.prepare(`
      SELECT e.*, p.name as project_name
      FROM experiments e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!exp) return null;

    const reactants = db.prepare('SELECT name, amount, amount_unit FROM reactants WHERE experiment_id = ? ORDER BY sort_order').all(id);
    const catalysts = db.prepare('SELECT name, amount, amount_unit FROM catalysts WHERE experiment_id = ? ORDER BY sort_order').all(id);
    const solvents = db.prepare('SELECT name, volume, volume_unit FROM solvents WHERE experiment_id = ? ORDER BY sort_order').all(id);

    return generateExperimentalSection({ ...exp, reactants, catalysts, solvents });
  });

  // ── Export experiment raw data (for frontend template formatting) ──
  ipcMain.handle('experiments:exportData', (_e, id: number) => {
    const exp = db.prepare(`
      SELECT e.*, p.name as project_name
      FROM experiments e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!exp) return null;

    const reactants = db.prepare('SELECT name, amount, amount_unit FROM reactants WHERE experiment_id = ? ORDER BY sort_order').all(id);
    const catalysts = db.prepare('SELECT name, amount, amount_unit FROM catalysts WHERE experiment_id = ? ORDER BY sort_order').all(id);
    const solvents = db.prepare('SELECT name, volume, volume_unit FROM solvents WHERE experiment_id = ? ORDER BY sort_order').all(id);

    return { ...exp, reactants, catalysts, solvents };
  });

  // ── Module Layout ──
  ipcMain.handle('experiments:setModuleLayout', (_e, id: number, layout: any[]) => {
    db.prepare('UPDATE experiments SET module_layout = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(JSON.stringify(layout), id);
  });

  // ── Custom Module Data ──
  ipcMain.handle('experiments:getCustomModules', (_e, id: number) => {
    return db.prepare(
      'SELECT * FROM experiment_module_data WHERE experiment_id = ? ORDER BY sort_order'
    ).all(id);
  });

  ipcMain.handle('experiments:saveCustomModules', (_e, expId: number, modules: { module_key: string; data: Record<string, any> }[]) => {
    const saveTx = db.transaction((id: number, mods: { module_key: string; data: Record<string, any> }[]) => {
      db.prepare('DELETE FROM experiment_module_data WHERE experiment_id = ?').run(id);
      if (mods && mods.length > 0) {
        const stmt = db.prepare(
          'INSERT INTO experiment_module_data (experiment_id, module_key, module_type, data, sort_order) VALUES (?, ?, \'custom\', ?, ?)'
        );
        mods.forEach((m, i) => {
          stmt.run(id, m.module_key, JSON.stringify(m.data), i);
        });
      }
    });
    saveTx(expId, modules);
  });

  // ── Compound name cache ──
  ipcMain.handle('compound:getName', (_e, smiles: string) => {
    const row = db.prepare('SELECT name FROM compound_names WHERE smiles = ?').get(smiles) as { name: string } | undefined;
    return row?.name || null;
  });

  ipcMain.handle('compound:setName', (_e, smiles: string, name: string) => {
    db.prepare('INSERT OR REPLACE INTO compound_names (smiles, name) VALUES (?, ?)').run(smiles, name);
  });

  // ── Tasks / Todo / Calendar ──
  ipcMain.handle('tasks:list', (_e, filters?: { status?: string; experiment_id?: number; tag_id?: number }) => {
    let query = `
      SELECT t.*,
        e.title as experiment_title,
        e.date as experiment_date
      FROM tasks t
      LEFT JOIN experiments e ON t.experiment_id = e.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.status) {
      conditions.push('t.status = ?');
      params.push(filters.status);
    }
    if (filters?.experiment_id != null) {
      conditions.push('t.experiment_id = ?');
      params.push(filters.experiment_id);
    }
    if (filters?.tag_id != null) {
      conditions.push('t.id IN (SELECT task_id FROM task_tags WHERE tag_id = ?)');
      params.push(filters.tag_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY CASE t.status WHEN \'done\' THEN 2 WHEN \'cancelled\' THEN 3 ELSE 1 END, t.due_date ASC NULLS LAST, t.priority DESC, t.created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r: any) => ({
      ...r,
      tags: db.prepare(`
        SELECT tg.* FROM tags tg
        JOIN task_tags tt ON tg.id = tt.tag_id
        WHERE tt.task_id = ?
      `).all(r.id),
      subtasks: db.prepare(`
        SELECT * FROM tasks WHERE parent_task_id = ?
        ORDER BY created_at ASC
      `).all(r.id),
    }));
  });

  ipcMain.handle('tasks:get', (_e, id: number) => {
    const task = db.prepare(`
      SELECT t.*, e.title as experiment_title, e.date as experiment_date
      FROM tasks t
      LEFT JOIN experiments e ON t.experiment_id = e.id
      WHERE t.id = ?
    `).get(id) as any;

    if (!task) return null;

    task.tags = db.prepare(`
      SELECT tg.* FROM tags tg
      JOIN task_tags tt ON tg.id = tt.tag_id
      WHERE tt.task_id = ?
    `).all(id);

    task.subtasks = db.prepare(`
      SELECT * FROM tasks WHERE parent_task_id = ?
      ORDER BY created_at ASC
    `).all(id);

    return task;
  });

  ipcMain.handle('tasks:create', (_e, data: {
    title: string; description?: string; status?: string; priority?: string;
    due_date?: string | null; experiment_id?: number | null;
    parent_task_id?: number | null; recurrence_rule?: string | null;
    tag_ids?: number[];
  }) => {
    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, due_date, experiment_id, parent_task_id, recurrence_rule)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.title,
      data.description || '',
      data.status || 'todo',
      data.priority || 'medium',
      data.due_date || null,
      data.experiment_id || null,
      data.parent_task_id || null,
      data.recurrence_rule || null,
    );

    const taskId = Number(result.lastInsertRowid);

    if (data.tag_ids && data.tag_ids.length > 0) {
      const tagStmt = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
      for (const tagId of data.tag_ids) {
        tagStmt.run(taskId, tagId);
      }
    }

    notifyWidget();
    return taskId;
  });

  ipcMain.handle('tasks:update', (_e, id: number, data: {
    title?: string; description?: string; status?: string; priority?: string;
    due_date?: string | null; experiment_id?: number | null;
    parent_task_id?: number | null; recurrence_rule?: string | null;
    tag_ids?: number[];
  }) => {
    const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!current) throw new Error('Task not found');

    db.prepare(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?,
        due_date = ?, experiment_id = ?, parent_task_id = ?,
        recurrence_rule = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      data.title ?? current.title,
      data.description ?? current.description,
      data.status ?? current.status,
      data.priority ?? current.priority,
      data.due_date !== undefined ? data.due_date : current.due_date,
      data.experiment_id !== undefined ? data.experiment_id : current.experiment_id,
      data.parent_task_id !== undefined ? data.parent_task_id : current.parent_task_id,
      data.recurrence_rule !== undefined ? data.recurrence_rule : current.recurrence_rule,
      id,
    );

    if (data.tag_ids !== undefined) {
      db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(id);
      if (data.tag_ids.length > 0) {
        const tagStmt = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
        for (const tagId of data.tag_ids) {
          tagStmt.run(id, tagId);
        }
      }
    }

    // Recurring task: when marked done, generate next occurrence
    if (data.status === 'done' && current.recurrence_rule) {
      const nextDate = computeNextRecurrence(current.due_date, current.recurrence_rule);
      if (nextDate) {
        db.prepare(`
          INSERT INTO tasks (title, description, status, priority, due_date, experiment_id, parent_task_id, recurrence_rule)
          VALUES (?, ?, 'todo', ?, ?, ?, ?, ?)
        `).run(
          current.title, current.description, current.priority,
          nextDate, current.experiment_id, current.parent_task_id, current.recurrence_rule,
        );
      }
    }
    notifyWidget();
  });

  ipcMain.handle('tasks:delete', (_e, id: number) => {
    db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    notifyWidget();
  });

  ipcMain.handle('tasks:getByExperiment', (_e, experimentId: number) => {
    return db.prepare(`
      SELECT t.*, e.title as experiment_title, e.date as experiment_date
      FROM tasks t
      LEFT JOIN experiments e ON t.experiment_id = e.id
      WHERE t.experiment_id = ?
      ORDER BY t.status ASC, t.due_date ASC
    `).all(experimentId);
  });

  // ── Module Templates CRUD ──
  ipcMain.handle('modules:templates:list', () => {
    return db.prepare(
      'SELECT * FROM module_templates ORDER BY is_preset DESC, sort_order ASC, name ASC'
    ).all();
  });

  ipcMain.handle('modules:templates:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM module_templates WHERE id = ?').get(id);
  });

  ipcMain.handle('modules:templates:create', (_e, data: { name: string; description?: string; category?: string; fields: string }) => {
    const stmt = db.prepare(
      'INSERT INTO module_templates (name, description, category, fields, is_preset) VALUES (?, ?, ?, ?, 0)'
    );
    const result = stmt.run(data.name, data.description || null, data.category || 'custom', data.fields);
    return Number(result.lastInsertRowid);
  });

  ipcMain.handle('modules:templates:update', (_e, id: number, data: { name?: string; description?: string; fields?: string }) => {
    const current = db.prepare('SELECT * FROM module_templates WHERE id = ?').get(id) as any;
    if (!current || current.is_preset) return;
    db.prepare(
      'UPDATE module_templates SET name = ?, description = ?, fields = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?'
    ).run(
      data.name ?? current.name,
      data.description ?? current.description,
      data.fields ?? current.fields,
      id
    );
  });

  ipcMain.handle('modules:templates:delete', (_e, id: number) => {
    const current = db.prepare('SELECT * FROM module_templates WHERE id = ?').get(id) as any;
    if (!current || current.is_preset) return;
    db.prepare('DELETE FROM module_templates WHERE id = ?').run(id);
  });
}

// ── App Lifecycle ──

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      setupMenu();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.moveTop();
    }
  });
}

app.whenReady().then(async () => {
  console.log('[LabNote] App ready');

  // Step 1: Ensure data path
  dataPath = await ensureDataPath();
  console.log('[LabNote] Data path:', dataPath);

  // Step 2: Register image protocol (must be after app.whenReady, before window loads)
  registerImageProtocol();

  // Step 3: Create window FIRST — Chromium loads HTML/CSS/JS in background
  // while we initialize database on the main thread.
  createWindow();

  // Step 3.5: Setup custom menu (no Edit menu, File menu has data path selector)
  setupMenu();

  // Step 4: Initialize database (runs in parallel with renderer loading)
  console.log('[LabNote] Initializing database...');
  try {
    initDatabase(dataPath);
    console.log('[LabNote] Database initialized');
  } catch (err: any) {
    console.error('[LabNote] Database init failed:', err.message || err);
  }

  // Step 5: Ensure images subdirectory
  fs.mkdirSync(path.join(dataPath, 'images'), { recursive: true });

  // Step 6: Register IPC handlers (must complete before React mounts & makes queries)
  registerIpcHandlers();
  setupWidgetIpc();

  // Step 7: Create widget (after IPC handlers are ready)
  createWidgetWindow();

  console.log('[LabNote] Startup complete');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
