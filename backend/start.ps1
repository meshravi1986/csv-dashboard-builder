param(
    [int]$Port = 8000,
    [string]$Host = "0.0.0.0"
)

$ErrorActionPreference = "Stop"
$MAX_WAIT_SECONDS = 30
$CHECK_INTERVAL_SECONDS = 2

# Find and kill any existing process on the target port
$existing = netstat -ano | Select-String ":${Port}\s" | Select-String "LISTENING"
if ($existing) {
    $pid = ($existing -split '\s+')[-1]
    Write-Host "Port $Port is in use by PID $pid. Attempting graceful shutdown..."
    try {
        Stop-Process -Id $pid -Force -ErrorAction Stop
        Write-Host "Process $pid killed."
    } catch {
        Write-Host "Could not kill process $pid (may require admin). Trying taskkill..."
        taskkill /F /PID $pid 2>$null
    }
}

# Wait for the port to be released (handles TIME_WAIT orphaned sockets)
$elapsed = 0
while ($elapsed -lt $MAX_WAIT_SECONDS) {
    $still_listening = netstat -ano | Select-String ":${Port}\s" | Select-String "LISTENING"
    if (-not $still_listening) {
        Write-Host "Port $Port is free. Starting server..."
        python -m uvicorn app.main:app --host $Host --port $Port --reload
        exit 0
    }
    Write-Host "Waiting for port $Port to be released... (${elapsed}s)"
    Start-Sleep -Seconds $CHECK_INTERVAL_SECONDS
    $elapsed += $CHECK_INTERVAL_SECONDS
}

Write-Host "ERROR: Port $Port still busy after ${MAX_WAIT_SECONDS}s."
Write-Host "Try: netstat -ano | Select-String ':${Port}\s'"
Write-Host "Then: taskkill /F /PID <PID>"
exit 1
