$ErrorActionPreference = 'Stop'
$dir = 'C:\auroxtech\workers\aurox-whatsapp'
$pkg = Join-Path $dir 'node_modules\whatsapp-web.js\package.json'
$file = Join-Path $dir 'node_modules\whatsapp-web.js\src\structures\Message.js'
if (!(Test-Path $pkg) -or !(Test-Path $file)) { throw 'whatsapp-web.js nao encontrado. Confira o caminho, sem reinstalar nada.' }
$version = (Get-Content -Raw $pkg | ConvertFrom-Json).version
if ($version -ne '1.34.7') { throw "Versao $version nao verificada. Nenhuma mudanca foi feita." }
$source = [IO.File]::ReadAllText($file)
$target = '        this.id = data.id;'
$replacement = '        this.id = data.id && data.id._serialized == null && typeof data.id.$1 === ''string'' ? { ...data.id, _serialized: data.id.$1 } : data.id;'
if ($source.Contains($replacement)) { Write-Host 'Patch de Message.js ja aplicado.'; exit 0 }
$matches = ([regex]::Matches($source,[regex]::Escape($target))).Count
if ($matches -ne 1) { throw "Esperava uma unica ocorrencia do trecho. Encontrei $matches. Nenhuma alteracao." }
$backup = "$file.aurox-before-media-fix.bak"
if (!(Test-Path $backup)) { Copy-Item -LiteralPath $file -Destination $backup }
$updated = $source.Replace($target,$replacement)
[IO.File]::WriteAllText($file,$updated,[Text.UTF8Encoding]::new($false))
Push-Location $dir
try {
    node --check $file
    if ($LASTEXITCODE -ne 0) { Copy-Item -LiteralPath $backup -Destination $file -Force; throw 'Sintaxe invalida. Backup restaurado.' }
    Write-Host 'Patch instalado. Reinicie apenas o worker e teste um novo audio.' -ForegroundColor Green
} finally { Pop-Location }
