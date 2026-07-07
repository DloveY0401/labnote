const { exec } = require('child_process');

// Test the fixed embed script
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
Write-Host "Progman: $progman"
[W.D]::SendMessage($progman, 0x052C, [IntPtr]1, [IntPtr]::Zero) | Out-Null
$target = [IntPtr]::Zero
# First, check if SHELLDLL_DefView is directly under Progman
$defView = [W.D]::FindWindowEx($progman, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
Write-Host "SHELLDLL_DefView under Progman: $defView"
if ($defView -ne [IntPtr]::Zero) {
  $target = $progman
  Write-Host "Using Progman as target (SHELLDLL_DefView is direct child)"
} else {
  # Otherwise, look for WorkerW containing SHELLDLL_DefView (Rainmeter scenario)
  Write-Host "Looking for WorkerW with SHELLDLL_DefView..."
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
if ($target -eq [IntPtr]::Zero) { 
  $target = $progman 
  Write-Host "Using Progman as fallback"
}
Write-Host "Final target: $target"
Write-Host "Script would now set window styles and parent to target"
exit 0
`;

const buf = Buffer.from(script, 'utf16le');
const encoded = buf.toString('base64');

console.log('Testing fixed embed script...');
exec(`powershell -NoProfile -EncodedCommand "${encoded}"`, (err, stdout, stderr) => {
  console.log('=== STDOUT ===');
  console.log(stdout);
  if (err) {
    console.log('Error:', err.message);
  } else {
    console.log('Exit code: 0 (success)');
  }
});
