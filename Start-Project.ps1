param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js' = 'text/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'
    '.csv' = 'text/csv; charset=utf-8'
    '.png' = 'image/png'
    '.svg' = 'image/svg+xml'
}
try {
    $listener.Start()
    $actualPort = $listener.LocalEndpoint.Port
    Write-Host ''
    Write-Host 'Project 3 is ready. Open one of these addresses in your browser:'
    Write-Host ('  Chart:         http://127.0.0.1:' + $actualPort + '/')
    Write-Host ('  Browser check: http://127.0.0.1:' + $actualPort + '/tests/browser-check.html')
    Write-Host ''
    Write-Host 'Keep this window open while using the project. Press Ctrl+C to stop.'
    Write-Host 'The browser check takes about 40-60 seconds. Keep its tab visible.'
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 5000
            $stream.WriteTimeout = 5000
            $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            if (-not $requestLine) { continue }
            $request = $requestLine.Split(' ')
            $headerLength = $requestLine.Length
            do {
                $header = $reader.ReadLine()
                if ($header) { $headerLength += $header.Length }
                if ($headerLength -gt 16384) { throw 'Request headers are too long.' }
            } while ($header)

            $status = '404 Not Found'
            $contentType = 'text/plain; charset=utf-8'
            $body = [Text.Encoding]::UTF8.GetBytes('File not found. Extract the complete project folder before starting it.')
            if ($request.Length -ge 2 -and $request[0] -in @('GET', 'HEAD')) {
                $urlPath = [Uri]::UnescapeDataString(($request[1] -split '\?', 2)[0])
                if ($urlPath -eq '/') { $urlPath = '/index.html' }
                $relativePath = $urlPath.TrimStart('/').Replace('/', '\')
                $filePath = [IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))
                $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
                # Serve only site assets inside this project, never neighboring files.
                if ($filePath.StartsWith($projectRoot, [StringComparison]::OrdinalIgnoreCase) -and
                    $mimeTypes.ContainsKey($extension) -and [IO.File]::Exists($filePath)) {
                    $status = '200 OK'
                    $contentType = $mimeTypes[$extension]
                    $body = [IO.File]::ReadAllBytes($filePath)
                }
            } else {
                $status = '405 Method Not Allowed'
                $body = [Text.Encoding]::UTF8.GetBytes('Only GET and HEAD are supported.')
            }
            $responseHeader = 'HTTP/1.1 ' + $status + "`r`nContent-Type: " + $contentType +
                "`r`nContent-Length: " + $body.Length + "`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [Text.Encoding]::ASCII.GetBytes($responseHeader)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($request[0] -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
            $stream.Flush()
        } catch {
            Write-Warning ('A browser request could not be served: ' + $_.Exception.Message)
        } finally {
            if ($reader) { $reader.Dispose(); $reader = $null }
            $client.Dispose()
        }
    }
} catch {
    Write-Host ('Could not start the local server: ' + $_.Exception.Message)
    Write-Host 'If the project is already running, use http://127.0.0.1:8765/ in your browser.'
    exit 1
} finally {
    $listener.Stop()
}
