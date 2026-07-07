// Dev launcher: work around npm electron wrapper intercepting require('electron').
// 1. Rename the wrapper so Electron's built-in 'electron' module has priority.
// 2. Launch electron.
// 3. Restore the wrapper on exit.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');
const indexPath = path.join(electronDir, 'index.js');
const bakPath = path.join(electronDir, 'index.js.bak');

// Rename wrapper
if (fs.existsSync(indexPath)) {
  fs.renameSync(indexPath, bakPath);
  console.log('[launch] Disabled npm electron wrapper');
}

// Launch electron
const electronBin = path.join(electronDir, 'dist', 'electron.exe');
const args = ['.'];
if (process.env.VITE_DEV_SERVER_URL) {
  args.push('--dev-server=' + process.env.VITE_DEV_SERVER_URL);
}

const proc = spawn(electronBin, args, {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: { ...process.env },
});

// Restore wrapper on exit
const cleanup = () => {
  if (fs.existsSync(bakPath)) {
    fs.renameSync(bakPath, indexPath);
    console.log('[launch] Restored npm electron wrapper');
  }
};

proc.on('exit', (code) => {
  cleanup();
  process.exit(code || 0);
});

proc.on('error', (err) => {
  console.error('[launch] Electron failed:', err);
  cleanup();
  process.exit(1);
});

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
