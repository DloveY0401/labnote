const { exec } = require('child_process');

// Simulate the actual embed script with GetShellWindow
const hwnd = '12345'; // dummy value
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
Write-Host "Shell window (Progman): $progman"
[W.D]::SendMessage($progman, 0x052C, [IntPtr]1, [IntPtr]::Zero) | Out-Null
Write-Host "SendMessage 0x052C completed"
$target = [IntPtr]::Zero
$ww = [IntPtr]::Zero
do {
  $ww = [W.D]::FindWindowEx([IntPtr]::Zero, $ww, "WorkerW", $null)
  Write-Host "Found WorkerW: $ww"
  if ($ww -ne [IntPtr]::Zero) {
    $defView = [W.D]::FindWindowEx($ww, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
    Write-Host "  SHELLDLL_DefView: $defView"
    if ($defView -ne [IntPtr]::Zero) {
      $target = $ww
    }
  }
} while ($ww -ne [IntPtr]::Zero -and $target -eq [IntPtr]::Zero)
Write-Host "Target WorkerW: $target"
Write-Host "Script completed successfully"
exit 0
`;

const buf = Buffer.from(script, 'utf16le');
const encoded = buf.toString('base64');

console.log('Testing fixed embed script...');
console.log('Encoded length:', encoded.length);
exec(`powershell -NoProfile -EncodedCommand "${encoded}"`, (err, stdout, stderr) => {
  console.log('=== STDOUT ===');
  console.log(stdout);
  if (err) {
    console.log('=== ERROR ===');
    console.log(err.message);
    console.log('Exit code:', err.code);
  } else {
    console.log('Exit code: 0 (success)');
  }
});
