const { exec } = require('child_process');
const fs = require('fs');

// Read the encoded script
const encoded = fs.readFileSync('.tmp/encoded_script.txt', 'utf8');

// The script has ${hwnd} which needs to be replaced
// But since we extracted the raw template, we need to rebuild it properly
// Let me just build the script directly

const hwnd = '12345'; // dummy value for testing
const script = `
Add-Type -Name D -Namespace W -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string w);
[DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string w);
[DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr c, IntPtr p);
[DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
[DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern IntPtr SetWindowLongPtr(IntPtr h, int i, IntPtr v);
[DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern IntPtr GetWindowLongPtr(IntPtr h, int i);
[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
'@
$hwnd = [IntPtr]${hwnd}
$progman = [W.D]::FindWindow("Progman", $null)
Write-Host "Progman handle: $progman"
[W.D]::SendMessage($progman, 0x052C, [IntPtr]1, [IntPtr]::Zero) | Out-Null
Write-Host "SendMessage completed"
$target = [IntPtr]::Zero
$ww = [IntPtr]::Zero
do {
  $ww = [W.D]::FindWindowEx([IntPtr]::Zero, $ww, "WorkerW", $null)
  if ($ww -ne [IntPtr]::Zero) {
    if ([W.D]::FindWindowEx($ww, [IntPtr]::Zero, "SHELLDLL_DefView", $null) -ne [IntPtr]::Zero) {
      $target = $ww
    }
  }
} while ($ww -ne [IntPtr]::Zero -and $target -eq [IntPtr]::Zero)
Write-Host "Target WorkerW: $target"
Write-Host "Script completed successfully"
exit 0
`;

// Encode as UTF-16LE base64
const buf = Buffer.from(script, 'utf16le');
const encodedScript = buf.toString('base64');

console.log('Running PowerShell script...');
console.log('Encoded length:', encodedScript.length);

exec(`powershell -NoProfile -EncodedCommand "${encodedScript}"`, (err, stdout, stderr) => {
  console.log('=== STDOUT ===');
  console.log(stdout);
  console.log('=== STDERR ===');
  console.log(stderr);
  console.log('=== ERROR ===');
  console.log(err);
  console.log('Exit code:', err ? err.code : 0);
});
