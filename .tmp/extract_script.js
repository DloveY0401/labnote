const fs = require('fs');
const mainTs = fs.readFileSync('electron/main.ts', 'utf8');
// Find the embed script
const startMarker = 'function embedWidgetIntoDesktop';
const startIdx = mainTs.indexOf(startMarker);
if (startIdx === -1) { console.log('Not found'); process.exit(1); }
const chunk = mainTs.substring(startIdx, startIdx + 3000);
const backtickStart = chunk.indexOf('`');
const backtickEnd = chunk.indexOf('`;', backtickStart + 1);
if (backtickStart === -1 || backtickEnd === -1) { console.log('Backticks not found'); process.exit(1); }
const script = chunk.substring(backtickStart + 1, backtickEnd);
console.log('=== SCRIPT START ===');
console.log(script);
console.log('=== SCRIPT END ===');
console.log('Length:', script.length);

// Now encode it like the app does
const buf = Buffer.from(script, 'utf16le');
const encoded = buf.toString('base64');
console.log('Encoded length:', encoded.length);

// Write encoded to file for testing
fs.writeFileSync('.tmp/encoded_script.txt', encoded);
console.log('Written to .tmp/encoded_script.txt');
