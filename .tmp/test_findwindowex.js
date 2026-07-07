const { exec } = require('child_process');

// Test FindWindowEx with different null/empty approaches
const script = `
Add-Type -Name D -Namespace W -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)] 
public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string w);
[DllImport("user32.dll")] 
public static extern IntPtr GetShellWindow();
[DllImport("user32.dll")] 
public static extern IntPtr FindWindow(string c, string w);
'@

$progman = [W.D]::GetShellWindow()
Write-Host "Progman: $progman"

# Check if Progman has SHELLDLL_DefView directly
$defView1 = [W.D]::FindWindowEx($progman, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
$defView2 = [W.D]::FindWindowEx($progman, [IntPtr]::Zero, "SHELLDLL_DefView", "")
$defView3 = [W.D]::FindWindow("SHELLDLL_DefView", $null)
$defView4 = [W.D]::FindWindow("SHELLDLL_DefView", "")

Write-Host "FindWindowEx(Progman, 0, SHELLDLL_DefView, null): $defView1"
Write-Host "FindWindowEx(Progman, 0, SHELLDLL_DefView, ''): $defView2"
Write-Host "FindWindow(SHELLDLL_DefView, null): $defView3"
Write-Host "FindWindow(SHELLDLL_DefView, ''): $defView4"

# Also check for Progman's children
Write-Host ""
Write-Host "Checking Progman children..."
$child = [IntPtr]::Zero
do {
  $child = [W.D]::FindWindowEx($progman, $child, $null, $null)
  if ($child -ne [IntPtr]::Zero) {
    Write-Host "  Child: $child"
  }
} while ($child -ne [IntPtr]::Zero)

exit 0
`;

const buf = Buffer.from(script, 'utf16le');
const encoded = buf.toString('base64');

console.log('Testing FindWindowEx with null/empty...');
exec(`powershell -NoProfile -EncodedCommand "${encoded}"`, (err, stdout, stderr) => {
  console.log('=== STDOUT ===');
  console.log(stdout);
  if (err) console.log('Error:', err.message);
});
