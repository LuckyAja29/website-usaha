# Server Lokal BukuKas Usaha
$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  Server BukuKas Usaha Aktif di http://localhost:$port" -ForegroundColor Green
    Write-Host "  Mode: Auto-Save Langsung ke File Excel Tanpa Download" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "JANGAN TUTUP jendela ini selama Anda menggunakan aplikasi.`n" -ForegroundColor Yellow
} catch {
    Write-Host "Server sudah aktif atau port $port sedang digunakan." -ForegroundColor Yellow
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        # CORS Headers
        $res.Headers.Add("Access-Control-Allow-Origin", "*")
        $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($req.HttpMethod -eq "OPTIONS") {
            $res.StatusCode = 200
            $res.OutputStream.Close()
            continue
        }

        $urlPath = $req.Url.LocalPath

        # API Endpoint: Simpan langsung ke file Excel di disk
        if ($urlPath -eq "/api/save-excel" -and $req.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($req.InputStream)
                $body = $reader.ReadToEnd()
                $json = ConvertFrom-Json $body
                
                $fileName = if ($json.fileName) { $json.fileName } else { "BukuKas_Usaha.xlsx" }
                $filePath = Join-Path $PWD $fileName

                if ($json.base64Data) {
                    $bytes = [System.Convert]::FromBase64String($json.base64Data)
                    [System.IO.File]::WriteAllBytes($filePath, $bytes)
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Berhasil memperbarui file: $fileName" -ForegroundColor Green
                }

                $escapedPath = $filePath.Replace('\', '\\')
                $respText = "{`"status`":`"ok`",`"message`":`"File berhasil disimpan langsung ke disk`",`"path`":`"$escapedPath`"}"
                $respBytes = [System.Text.Encoding]::UTF8.GetBytes($respText)
                $res.ContentType = "application/json; charset=utf-8"
                $res.ContentLength64 = $respBytes.Length
                $res.OutputStream.Write($respBytes, 0, $respBytes.Length)
            } catch {
                Write-Host "[Error] Gagal menulis file: $_" -ForegroundColor Red
                $errText = "{`"status`":`"error`",`"message`":`"$($_.Exception.Message)`"}"
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errText)
                $res.StatusCode = 500
                $res.ContentType = "application/json; charset=utf-8"
                $res.ContentLength64 = $errBytes.Length
                $res.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
            $res.OutputStream.Close()
            continue
        }

        # API Endpoint: Baca file Excel dari disk
        if ($urlPath -eq "/api/load-excel" -and $req.HttpMethod -eq "GET") {
            $fileName = $req.QueryString["fileName"]
            if (-not $fileName) { $fileName = "BukuKas_Usaha.xlsx" }
            $filePath = Join-Path $PWD $fileName

            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $base64 = [System.Convert]::ToBase64String($bytes)
                $respText = "{`"status`":`"ok`",`"base64Data`":`"$base64`",`"fileName`":`"$fileName`"}"
            } else {
                $respText = "{`"status`":`"not_found`"}"
            }
            $respBytes = [System.Text.Encoding]::UTF8.GetBytes($respText)
            $res.ContentType = "application/json; charset=utf-8"
            $res.ContentLength64 = $respBytes.Length
            $res.OutputStream.Write($respBytes, 0, $respBytes.Length)
            $res.OutputStream.Close()
            continue
        }

        # Static File Serving
        $path = $urlPath.TrimStart('/')
        if ($path -eq '') { $path = 'index.html' }
        $localPath = Join-Path $PWD $path

        if (Test-Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            switch ($ext) {
                '.html' { $res.ContentType = 'text/html; charset=utf-8' }
                '.css'  { $res.ContentType = 'text/css; charset=utf-8' }
                '.js'   { $res.ContentType = 'application/javascript; charset=utf-8' }
                '.json' { $res.ContentType = 'application/json; charset=utf-8' }
                '.xlsx' { $res.ContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
                default { $res.ContentType = 'application/octet-stream' }
            }
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
            $res.OutputStream.Write($err, 0, $err.Length)
        }
        $res.OutputStream.Close()
    } catch {
        # Abaikan error koneksi tertutup mendadak
    }
}
