const { exec } = require('child_process');

// Test different FindWindow approaches
const script = `
Add-Type -Name D -Namespace W -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] 
public static extern IntPtr FindWindow(string c, string w);
[DllImport("user32.dll")] 
public static extern IntPtr GetShellWindow();
'@

# Try different approaches to find Progman
$progman1 = [W.D]::FindWindow("Progman", $null)
$progman2 = [W.D]::FindWindow("Progman", "Program Manager")
$progman3 = [W.D]::FindWindow($null, "Program Manager")
$shellWnd = [W.D]::GetShellWindow()

Write-Host "FindWindow(Progman, null): $progman1"
Write-Host "FindWindow(Progman, 'Program Manager'): $progman2"
Write-Host "FindWindow(null, 'Program Manager'): $progman3"
Write-Host "GetShellWindow(): $shellWnd"

# Use shell window as fallback
$desktop = if ($progman1 -ne 0) { $progman1 } elseif ($shellWnd -ne 0) { $shellWnd } else { 0 }
Write-Host "Desktop handle to use: $desktop"
exit 0
`;

const buf = Buffer.from(script, 'utf16le');
const encoded = buf.toString('base64');

console.log('Testing FindWindow approaches...');
exec(`powershell -NoProfile -EncodedCommand "${encoded}"`, (err, stdout, stderr) => {
  console.log('=== STDOUT ===');
  console.log(stdout);
  if (err) {
    console.log('=== ERROR ===');
    console.log(err.message);
  }
});
