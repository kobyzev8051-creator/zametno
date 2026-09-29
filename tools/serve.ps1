# Простой локальный сервер для проверки: открывает приложение из папки app по адресу http://localhost:8080/
# Запуск из папки проекта: powershell -ExecutionPolicy Bypass -File tools\serve.ps1
$port = 8080
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\app')).Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Сервер запущен: http://localhost:$port/  (остановить: Ctrl+C)"

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css'; '.js' = 'application/javascript'
  '.webmanifest' = 'application/manifest+json'; '.json' = 'application/json'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($path -eq '') { $path = 'index.html' }
  $file = Join-Path $root $path
  $res = $ctx.Response
  if ((Test-Path $file -PathType Leaf) -and ((Resolve-Path $file).Path.StartsWith($root))) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file)
    $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
  }
  $res.Close()
}
