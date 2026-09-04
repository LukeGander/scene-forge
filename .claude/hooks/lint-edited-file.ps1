$ErrorActionPreference = "Stop"

$projectDir = $env:CLAUDE_PROJECT_DIR
if ([string]::IsNullOrWhiteSpace($projectDir)) { exit 0 }

Set-Location -LiteralPath $projectDir

try {
    $raw = [Console]::In.ReadToEnd()
} catch {
    exit 0
}
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

try {
    $payload = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$filePath = $payload.tool_input.file_path
if ([string]::IsNullOrWhiteSpace($filePath)) { exit 0 }
if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) { exit 0 }

$resolvedFile = [System.IO.Path]::GetFullPath($filePath)
$resolvedProjectDir = [System.IO.Path]::GetFullPath($projectDir)
$projectPrefix = $resolvedProjectDir.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar

if (-not $resolvedFile.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    # Edited file resolves outside the project root (e.g. a path-traversal file_path) - skip.
    exit 0
}

# Only extensions this project's ESLint flat config actually lints
$lintableExtensions = @(".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".astro")
$ext = [System.IO.Path]::GetExtension($resolvedFile).ToLowerInvariant()
if ($lintableExtensions -notcontains $ext) { exit 0 }

# --fix resolves the repo-wide CRLF/Prettier noise on this file as a side effect;
# only genuinely unfixable problems remain to fail on.
$eslintOutput = & npx eslint --fix -- "$resolvedFile" 2>&1
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    $text = ($eslintOutput | Out-String).TrimEnd()
    $maxChars = 8000
    if ($text.Length -gt $maxChars) {
        $text = "... (truncated) ...`n" + $text.Substring($text.Length - $maxChars)
    }
    [Console]::Error.WriteLine("ESLint found unfixed problems in ${resolvedFile}:`n$text")
    exit 2
}

exit 0
