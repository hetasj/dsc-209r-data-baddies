param([switch]$ReducedMotion, [string]$BaseUrl)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$profilePath = Join-Path $env:TEMP ('jade-project3-check-' + [guid]::NewGuid().ToString('N'))
$testFileUrl = [System.Uri]::new((Join-Path $PSScriptRoot 'browser-check.html')).AbsoluteUri
$testUrl = $testFileUrl + '?automated=1'
if ($BaseUrl) { $testUrl = $BaseUrl.TrimEnd('/') + '/tests/browser-check.html' }
$browserPath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path -LiteralPath $browserPath)) {
    $browserPath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
}
$browserArguments = @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', ('--user-data-dir="' + $profilePath + '"'), 'about:blank')
if ($ReducedMotion) { $browserArguments += '--force-prefers-reduced-motion' }
$browserProcess = Start-Process -FilePath $browserPath -ArgumentList $browserArguments -WindowStyle Hidden -PassThru
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$script:messageId = 0
function Send-Cdp {
    param([string]$Method, [hashtable]$Parameters = @{})
    $operationTimeout = [Threading.CancellationTokenSource]::new()
    $operationTimeout.CancelAfter(100000)
    if ($Method -eq 'Browser.close') { $operationTimeout.CancelAfter(3000) }
    try {
    $script:messageId++
    $requestId = $script:messageId
    $message = @{id = $requestId; method = $Method; params = $Parameters} | ConvertTo-Json -Compress -Depth 20
    $bytes = [Text.Encoding]::UTF8.GetBytes($message)
    $socket.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $operationTimeout.Token).GetAwaiter().GetResult() | Out-Null
    do {
        $stream = [IO.MemoryStream]::new()
        do {
            $buffer = [byte[]]::new(65536)
            $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $operationTimeout.Token).GetAwaiter().GetResult()
            if ($received.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { throw 'Browser connection closed before the checks finished.' }
            $stream.Write($buffer, 0, $received.Count)
        } until ($received.EndOfMessage)
        $response = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
        $stream.Dispose()
    } until ($response.id -eq $requestId)
    if ($response.error) { throw ($response.error | ConvertTo-Json -Compress) }
    return $response.result
    } finally { $operationTimeout.Dispose() }
}
try {
    Write-Output 'Starting an isolated headless browser...'
    $portFile = Join-Path $profilePath 'DevToolsActivePort'
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    while (-not (Test-Path -LiteralPath $portFile)) {
        if ([DateTime]::UtcNow -gt $deadline) { throw 'Browser did not start.' }
        Start-Sleep -Milliseconds 100
    }
    $debugPort = (Get-Content -LiteralPath $portFile)[0]
    do {
        $pages = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $debugPort + '/json/list') -TimeoutSec 5
        $page = $pages | Where-Object type -eq 'page' | Select-Object -First 1
        if (-not $page.webSocketDebuggerUrl) { Start-Sleep -Milliseconds 100 }
        if ([DateTime]::UtcNow -gt $deadline) { throw 'Browser page did not initialize.' }
    } until ($page.webSocketDebuggerUrl)
    $connectTimeout = [Threading.CancellationTokenSource]::new()
    $connectTimeout.CancelAfter(10000)
    try { $socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $connectTimeout.Token).GetAwaiter().GetResult() | Out-Null }
    finally { $connectTimeout.Dispose() }
    Send-Cdp 'Page.enable' | Out-Null
    Write-Output 'Checking that double-clicking the test gives setup instructions...'
    Send-Cdp 'Page.navigate' @{url = $testFileUrl} | Out-Null
    Start-Sleep -Seconds 1
    $guidance = Send-Cdp 'Runtime.evaluate' @{expression = "document.getElementById('result')?.textContent"; returnByValue = $true}
    if ($guidance.result.value -notlike '*double-clicking*') { throw 'Direct-open guidance was not displayed.' }
    Write-Output 'Checking that a blocked D3 download reports an error...'
    Send-Cdp 'Network.enable' | Out-Null
    Send-Cdp 'Network.setBlockedURLs' @{urls = @('*cdn.jsdelivr.net*')} | Out-Null
    Send-Cdp 'Page.navigate' @{url = $testUrl} | Out-Null
    Start-Sleep -Seconds 2
    $blocked = Send-Cdp 'Runtime.evaluate' @{expression = "document.getElementById('result')?.textContent"; returnByValue = $true}
    if ($blocked.result.value -notlike 'FAIL*cdn.jsdelivr.net*') { throw ('Blocked-download check failed: ' + $blocked.result.value) }
    Send-Cdp 'Network.setBlockedURLs' @{urls = @()} | Out-Null
    Write-Output 'Running the full chart checks. This usually takes 40-60 seconds...'
    Send-Cdp 'Page.navigate' @{url = $testUrl} | Out-Null
    Start-Sleep -Milliseconds 500
    $checkExpression = @'
new Promise(resolve => {
    const deadline = Date.now() + 95000;
    const timer = setInterval(() => {
        const text = document.getElementById('result')?.textContent || '';
        if (/^(PASS|FAIL)/.test(text) || Date.now() > deadline) {
            clearInterval(timer);
            resolve(/^(PASS|FAIL)/.test(text) ? text : 'FAIL — Browser check timed out. Last status: ' + text);
        }
    }, 100);
})
'@
    $evaluation = Send-Cdp 'Runtime.evaluate' @{expression = $checkExpression; awaitPromise = $true; returnByValue = $true}
    $checkResult = $evaluation.result.value
    Write-Output $checkResult
    if ($evaluation.exceptionDetails) { throw ($evaluation.exceptionDetails | ConvertTo-Json -Depth 10) }
    $indexUrl = [System.Uri]::new((Join-Path $projectPath 'index.html')).AbsoluteUri
    if ($BaseUrl) { $indexUrl = $BaseUrl.TrimEnd('/') + '/index.html' }
    Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width = 1100; height = 1200; deviceScaleFactor = 1; mobile = $false} | Out-Null
    Send-Cdp 'Page.navigate' @{url = $indexUrl} | Out-Null
    Start-Sleep -Seconds 2
    $screenshot = Send-Cdp 'Page.captureScreenshot' @{format = 'png'; captureBeyondViewport = $true}
    $screenshotPath = Join-Path $env:TEMP 'jade-project3-preview.png'
    [IO.File]::WriteAllBytes($screenshotPath, [Convert]::FromBase64String($screenshot.data))
    Write-Output ('Preview: ' + $screenshotPath)
    if ($checkResult -notlike 'PASS*') { throw 'Browser checks did not pass.' }
} finally {
    if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        try { Send-Cdp 'Browser.close' | Out-Null } catch { }
    }
    $socket.Dispose()
    if (-not $browserProcess.HasExited) { Stop-Process -Id $browserProcess.Id -ErrorAction SilentlyContinue }
}
