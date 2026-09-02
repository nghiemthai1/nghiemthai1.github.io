param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 8000,
    [switch]$NoBrowser
)

$siteRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$contentTypes = @{
    '.css' = 'text/css; charset=utf-8'
    '.gif' = 'image/gif'
    '.html' = 'text/html; charset=utf-8'
    '.ico' = 'image/x-icon'
    '.jpeg' = 'image/jpeg'
    '.jpg' = 'image/jpeg'
    '.js' = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.pdf' = 'application/pdf'
    '.png' = 'image/png'
    '.svg' = 'image/svg+xml'
    '.woff' = 'font/woff'
    '.woff2' = 'font/woff2'
}

try {
    $listener.Start()
    Write-Host "Serving $siteRoot"
    Write-Host "Open http://localhost:$Port/"
    Write-Host 'Press Ctrl+C to stop.'
    if (-not $NoBrowser) {
        Start-Process "http://localhost:$Port/"
    }

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            while ($reader.ReadLine()) { }

            $parts = $requestLine -split ' '
            $method = $parts[0]
            $requestPath = [uri]::UnescapeDataString(($parts[1] -split '\?')[0]).TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = 'index.html' }

            $filePath = [IO.Path]::GetFullPath((Join-Path $siteRoot $requestPath))
            $isInsideSite = $filePath.StartsWith($siteRoot, [StringComparison]::OrdinalIgnoreCase)
            $isSupportedMethod = $method -eq 'GET' -or $method -eq 'HEAD'

            if (-not $isInsideSite -or -not $isSupportedMethod -or -not [IO.File]::Exists($filePath)) {
                $status = '404 Not Found'
                $body = [Text.Encoding]::UTF8.GetBytes('Not found')
                $contentType = 'text/plain; charset=utf-8'
            } else {
                $status = '200 OK'
                $body = [IO.File]::ReadAllBytes($filePath)
                $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
                $contentType = if ($contentTypes.ContainsKey($extension)) {
                    $contentTypes[$extension]
                } else {
                    'application/octet-stream'
                }
            }

            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($method -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
        } catch [IO.IOException] {
            # Browsers may cancel large or superseded requests. Keep serving subsequent requests.
            Write-Verbose "Client disconnected before the response completed."
        } finally {
            $client.Dispose()
        }
    }
} finally {
    $listener.Stop()
}
