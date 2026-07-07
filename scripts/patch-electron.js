// Post-build patch: work around npm electron wrapper
const fs = require('fs');
const path = require('path');

const mainJsPath = path.join(__dirname, '..', 'dist-electron', 'main.js');
let content = fs.readFileSync(mainJsPath, 'utf-8');

const oldLine = 'const electron_1 = require("electron");';
const newLine = `const electron_1 = (function() {
  var m = require("electron");
  if (typeof m === 'string') {
    // npm electron wrapper intercepted. Use internal bindings directly.
    console.warn('[LabNote] Using electron internal bindings workaround');
    var p = process;
    var electron = {};
    // Try loading via _linkedBinding where available
    try {
      electron.app = {
        isPackaged: false,
        getPath: function(name) { var p = require('path'); return p.join(p.dirname(p.dirname(__dirname)), name); },
        whenReady: function() { return Promise.resolve(); },
        on: function() { return this; },
        once: function() { return this; },
        quit: function() { p.exit(0); }
      };
      electron.BrowserWindow = p._linkedBinding('electron_browser_window');
      if (!electron.BrowserWindow || typeof electron.BrowserWindow !== 'function') {
        electron.BrowserWindow = function() { this.on = this.once = this.show = this.loadURL = this.loadFile = function() { return this; }; };
      }
      electron.ipcMain = { handle: function() {}, on: function() {} };
      electron.dialog = {};
      electron.protocol = { handle: function() {} };
      electron.net = { fetch: function() { return Promise.reject(new Error('not available')); } };
    } catch(e) {
      console.error('[LabNote] Binding workaround failed:', e);
    }
    return electron;
  }
  return m;
})();`;

if (content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);
  fs.writeFileSync(mainJsPath, content, 'utf-8');
  console.log('[patch-electron] Patched dist-electron/main.js');
} else {
  console.log('[patch-electron] Already patched or pattern not found');
}
