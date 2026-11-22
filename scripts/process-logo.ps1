Add-Type -AssemblyName System.Drawing

$srcPath = "C:/Users/MD Anik/.gemini/antigravity/brain/7eedcef9-4ee1-4cd3-92a8-37b5cd96719c/.user_uploaded/media_1795353985248_d5d5d231.jpg"
$destDir = "E:/Sabbir dokan app/public"

if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir
}

function Resize-And-Save($src, $w, $h, $outputPath) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $g.DrawImage($src, 0, 0, $w, $h)
    $g.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated: $outputPath ($w x $h)"
}

$origImg = [System.Drawing.Image]::FromFile($srcPath)

Resize-And-Save $origImg 512 512 "$destDir/logo.png"
Resize-And-Save $origImg 512 512 "$destDir/pwa-512x512.png"
Resize-And-Save $origImg 192 192 "$destDir/pwa-192x192.png"
Resize-And-Save $origImg 180 180 "$destDir/apple-touch-icon.png"
Resize-And-Save $origImg 64 64 "$destDir/favicon.png"

$origImg.Dispose()
Write-Output "All icons created successfully from user uploaded logo."
