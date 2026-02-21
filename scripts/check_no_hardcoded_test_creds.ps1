$ErrorActionPreference = "Stop"

$testsRoot = Join-Path $PSScriptRoot "..\tests"
if (-not (Test-Path $testsRoot)) {
  Write-Host "tests folder not found: $testsRoot"
  exit 1
}

$forbiddenPatterns = @(
  "@test\.com",
  "localhost:5173",
  "localhost:3000",
  "http://localhost"
)

$allowToken = "ALLOW_HARDCODED_TEST_STRING"
$matchesFound = @()

$files = Get-ChildItem -Path $testsRoot -Recurse -File
foreach ($file in $files) {
  $lines = Get-Content -Path $file.FullName
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $lineNumber = $i + 1

    $isAllowedException =
      ($line -match '^\s*(//|#|\*|/\*)') -and
      ($line -match [regex]::Escape($allowToken))

    if ($isAllowedException) {
      continue
    }

    foreach ($pattern in $forbiddenPatterns) {
      if ($line -match $pattern) {
        $relativePath = Resolve-Path -Path $file.FullName -Relative
        $matchesFound += [PSCustomObject]@{
          Path    = $relativePath
          Line    = $lineNumber
          Pattern = $pattern
          Text    = $line.Trim()
        }
        break
      }
    }
  }
}

if ($matchesFound.Count -gt 0) {
  Write-Host "Forbidden hard-coded test strings found:" -ForegroundColor Red
  foreach ($match in $matchesFound) {
    Write-Host (" - {0}:{1} [{2}] {3}" -f $match.Path, $match.Line, $match.Pattern, $match.Text)
  }
  exit 1
}

Write-Host "PASS: No forbidden hard-coded credential/origin strings found under tests."
exit 0
