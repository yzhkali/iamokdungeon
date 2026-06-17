$port = 8099
$root = $PSScriptRoot
$ErrorActionPreference = "Stop"

Write-Host "PowerShell version: $($PSVersionTable.PSVersion)"
Write-Host "Serving folder: $root"
Write-Host ""

try {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://127.0.0.1:$port/")
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "[START FAILED] Error below - screenshot this for Claude:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  Write-Host ""
  Write-Host "(Common cause: port in use, or needs admin rights."
  Write-Host " Try right-click the bat -> Run as administrator.)"
  Write-Host ""
  Read-Host "Press Enter to exit"
  exit 1
}

$url = "http://127.0.0.1:$port/index.html"
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Server is running!" -ForegroundColor Green
Write-Host "  URL: $url"
Write-Host "  Opening browser... Close this window = stop server"
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

try { Start-Process $url } catch {
  Write-Host "(Browser did not open. Manually paste this URL: $url)" -ForegroundColor Yellow
}

$mime = @{
  ".html"="text/html; charset=utf-8"; ".js"="text/javascript"; ".mjs"="text/javascript";
  ".css"="text/css"; ".json"="application/json"; ".gltf"="model/gltf+json";
  ".bin"="application/octet-stream"; ".glb"="model/gltf-binary"; ".png"="image/png";
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".svg"="image/svg+xml"; ".webp"="image/webp"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq "") { $rel = "index.html" }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      $ctx.Response.Headers.Add("Access-Control-Allow-Origin","*")
      $ctx.Response.Headers.Add("Cache-Control","no-store, no-cache, must-revalidate")
      $ctx.Response.Headers.Add("Pragma","no-cache")
      $ctx.Response.Headers.Add("Expires","0")
      $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
      Write-Host ("  200  " + $rel)
    } else {
      $ctx.Response.StatusCode = 404
      Write-Host ("  404  " + $rel) -ForegroundColor DarkYellow
    }
    $ctx.Response.Close()
  } catch {
  }
}
