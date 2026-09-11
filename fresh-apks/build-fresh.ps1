$ErrorActionPreference = "Stop"
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir    = Split-Path -Parent $ScriptDir
$PublicDir  = Join-Path $RootDir "public"
$OutputDir  = Join-Path $ScriptDir "output"
$env:JAVA_HOME    = "C:\Program Files\Java\jdk-21.0.10"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path         = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$Apps = @(
    @{ name="customer"; appId="com.cityride.customer"; appName="CityRide";        entry="index.html";  login="auth.html";         authKey="cityride_member" },
    @{ name="driver";   appId="com.cityride.driver";   appName="CityRide Driver"; entry="driver.html"; login="driver-login.html"; authKey="cityride_pilot"  },
    @{ name="vendor";   appId="com.cityride.vendor";   appName="CityRide Vendor"; entry="vendor.html"; login="vendor-login.html"; authKey="cityride_vendor" },
    @{ name="admin";    appId="com.cityride.admin";    appName="CityRide Admin";  entry="admin.html";  login="admin-login.html";  authKey="cityride_master" },
    @{ name="association"; appId="com.cityride.association"; appName="CityRide Association"; entry="association-admin.html"; login="association-admin.html"; authKey="assoc_admin_token" }
)
function Write-Step([string]$msg) { Write-Host "`n===> $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host "  FAIL $msg" -ForegroundColor Red }
foreach ($app in $Apps) {
    $name    = $app.name
    $appId   = $app.appId
    $appName = $app.appName
    $entry   = $app.entry
    $login   = $app.login
    $authKey = $app.authKey
    $appDir  = Join-Path $ScriptDir $name
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    Write-Step "Building [$appName] ($appId)"
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    if (Test-Path $appDir) {
        Remove-Item $appDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Force -Path $appDir | Out-Null
    $pkgContent = '{ "name": "cityride-' + $name + '", "version": "1.0.0", "private": true, "scripts": { "sync": "npx cap sync android" }, "dependencies": { "@capacitor/android": "^6.2.0", "@capacitor/core": "^6.2.0", "@capacitor/splash-screen": "^6.0.2", "@capacitor/status-bar": "^6.0.2", "@capacitor/app": "^6.0.1", "@capacitor/network": "^6.0.2", "@capacitor/geolocation": "^6.0.1", "@capacitor/local-notifications": "^6.1.0" }, "devDependencies": { "@capacitor/cli": "^6.2.0" } }'
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText("$appDir\package.json", $pkgContent, $utf8NoBom)
    Write-OK "package.json created"
    $capContent = '{ "appId": "' + $appId + '", "appName": "' + $appName + '", "webDir": "www", "server": { "androidScheme": "https", "cleartext": true }, "android": { "allowMixedContent": true, "webContentsDebuggingEnabled": false }, "plugins": { "CapacitorHttp": { "enabled": true }, "CapacitorCookies": { "enabled": true }, "SplashScreen": { "launchShowDuration": 2000, "launchAutoHide": true, "backgroundColor": "#090a0f", "showSpinner": false, "splashFullScreen": true, "splashImmersive": true }, "StatusBar": { "style": "Dark", "backgroundColor": "#090a0f", "overlaysWebView": false } } }'
    [System.IO.File]::WriteAllText("$appDir\capacitor.config.json", $capContent, $utf8NoBom)
    Write-OK "capacitor.config.json created"
    $wwwDir = Join-Path $appDir "www"
    New-Item -ItemType Directory -Force -Path $wwwDir | Out-Null
    Write-Host "  Copying web assets..." -NoNewline
    Copy-Item -Path "$PublicDir\*" -Destination $wwwDir -Recurse -Force
    Write-Host " done" -ForegroundColor Green
    $configJs = 'window.APP_MODE = "capacitor"; const API_BASE_URL = "https://crtaxi.up.railway.app"; window.API_BASE_URL = API_BASE_URL; window.SOCKET_URL = API_BASE_URL; const _of = window.fetch.bind(window); window.fetch = function(i,o){ if(typeof i==="string"&&i.startsWith("/"))i=API_BASE_URL+i; else if(typeof i==="string"&&i.startsWith(API_BASE_URL)){}else{return _of(i,o);} o=o||{}; o.credentials="include"; return _of(i,o); }; const _xo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function(m,u){ if(typeof u==="string"&&u.startsWith("/"))u=API_BASE_URL+u; return _xo.apply(this,arguments); }; const _xs = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function(){ this.withCredentials = true; return _xs.apply(this, arguments); }; document.addEventListener("DOMContentLoaded", async () => { if (window.Capacitor && window.Capacitor.Plugins) { try { if (window.Capacitor.Plugins.Geolocation) await window.Capacitor.Plugins.Geolocation.requestPermissions(); } catch(e){} try { if (window.Capacitor.Plugins.LocalNotifications) await window.Capacitor.Plugins.LocalNotifications.requestPermissions(); } catch(e){} } });'
    [System.IO.File]::WriteAllText("$wwwDir\config.js", $configJs, $utf8NoBom)
    Write-OK "config.js created"
    if ($name -ne "customer") {
        $redirect = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$appName</title>
    <style>body{background:#090a0f;color:#fff;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;}</style>
    <script>
        (function() {
            var target = '$entry';
            var loginPage = '$login';
            var authKey = '$authKey';
            var isLoggedIn = false;
            try {
                var stored = localStorage.getItem(authKey);
                if (stored && stored !== 'null' && stored !== 'undefined') {
                    var parsed = JSON.parse(stored);
                    if (parsed && (parsed.id || parsed.token || parsed.email || parsed.name || parsed.vendor_id)) {
                        isLoggedIn = true;
                    }
                }
            } catch(e) {}

            if (isLoggedIn) {
                window.location.replace(target);
            } else {
                window.location.replace(loginPage);
            }
        })();
    </script>
</head>
<body>
    <div style="text-align:center;">
        <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px;">$appName</div>
        <div style="font-size:0.85rem;color:#888;">Initializing secure session...</div>
    </div>
</body>
</html>
"@
        [System.IO.File]::WriteAllText("$wwwDir\index.html", $redirect, $utf8NoBom)
        Write-OK "index.html -> Smart Auth Dispatcher ($entry / $login)"
    }
    Write-Host "  npm install..." -NoNewline
    Push-Location $appDir
    & npm install --silent 2>&1 | Out-Null
    Pop-Location
    Write-Host " done" -ForegroundColor Green
    Write-Host "  cap add android..." -NoNewline
    Push-Location $appDir
    & npx cap add android 2>&1 | Out-Null
    Pop-Location
    Write-Host " done" -ForegroundColor Green
    
    # Create local.properties
    $sdkEscaped = $env:ANDROID_HOME -replace "\\", "\\"
    Set-Content "$appDir\android\local.properties" "sdk.dir=$sdkEscaped"
    
    # Inject Custom Java Plugins
    $appJavaSrc = Join-Path $RootDir "capacitor-apps\$name\android\app\src\main\java\com\cityride\$name"
    $appJavaDst = Join-Path $appDir "android\app\src\main\java\com\cityride\$name"
    $appPluginsDst = Join-Path $appJavaDst "plugins"
    
    New-Item -ItemType Directory -Force -Path $appJavaDst | Out-Null
    New-Item -ItemType Directory -Force -Path $appPluginsDst | Out-Null
    
    if (Test-Path $appJavaSrc) {
        Copy-Item -Path "$appJavaSrc\*.java" -Destination $appJavaDst -Force
        if (Test-Path "$appJavaSrc\plugins") {
            Copy-Item -Path "$appJavaSrc\plugins\*.java" -Destination $appPluginsDst -Force
        }
        Write-OK "[$name] Background Java plugins injected"
    }
    
    $manifestPath = "$appDir\android\app\src\main\AndroidManifest.xml"
    if (Test-Path $manifestPath) {
        $manifest = Get-Content $manifestPath -Raw
        $manifest = $manifest -replace 'android:theme="@style/AppTheme.NoActionBar"', 'android:theme="@style/AppTheme.NoActionBar" android:usesCleartextTraffic="true"'
        
        $permissions = @"
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
</manifest>
"@
        $manifest = $manifest -replace '</manifest>', $permissions
        
        $appServices = ""
        if ($name -eq "driver") {
            $appServices = @"
        <!-- Driver Native Foreground Services & Receivers -->
        <service android:name=".FloatingWidgetService" android:enabled="true" android:exported="false" android:stopWithTask="false" />
        <service android:name=".DriverBackgroundService" android:enabled="true" android:exported="false" android:foregroundServiceType="location|dataSync" android:stopWithTask="false" />
        <service android:name=".HeartbeatService" android:enabled="true" android:exported="false" android:foregroundServiceType="dataSync" android:stopWithTask="false" />
        <service android:name=".BackgroundLocationService" android:enabled="true" android:exported="false" android:foregroundServiceType="location" android:stopWithTask="false" />
        <receiver android:name=".BootReceiver" android:enabled="true" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </receiver>
    </application>
"@
        } elseif ($name -eq "customer") {
            $appServices = @"
        <!-- Customer Native Foreground Services & Receivers -->
        <service android:name=".CustomerBackgroundService" android:enabled="true" android:exported="false" android:foregroundServiceType="dataSync" android:stopWithTask="false" />
        <service android:name=".HeartbeatService" android:enabled="true" android:exported="false" android:foregroundServiceType="dataSync" android:stopWithTask="false" />
        <service android:name=".BackgroundLocationService" android:enabled="true" android:exported="false" android:foregroundServiceType="location" android:stopWithTask="false" />
        <receiver android:name=".BootReceiver" android:enabled="true" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </receiver>
    </application>
"@
        } else {
            $appServices = @"
        <!-- App Native Foreground Services & Receivers -->
        <service android:name=".HeartbeatService" android:enabled="true" android:exported="false" android:foregroundServiceType="dataSync" android:stopWithTask="false" />
        <service android:name=".BackgroundLocationService" android:enabled="true" android:exported="false" android:foregroundServiceType="location" android:stopWithTask="false" />
        <receiver android:name=".BootReceiver" android:enabled="true" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </receiver>
    </application>
"@
        }
        
        $manifest = $manifest -replace '</application>', $appServices
        [System.IO.File]::WriteAllText($manifestPath, $manifest, $utf8NoBom)
        Write-OK "AndroidManifest.xml patched"
    }
    
    $buildGradlePath = "$appDir\android\app\build.gradle"
    if (Test-Path $buildGradlePath) {
        $gradle = [System.IO.File]::ReadAllText($buildGradlePath)
        $gradle = $gradle -replace "VERSION_11", "VERSION_17"
        if ($gradle -notmatch "play-services-location") {
            $gradle = $gradle -replace 'dependencies \{', "dependencies {`n    implementation 'com.google.android.gms:play-services-location:21.3.0'"
        }
        [System.IO.File]::WriteAllText($buildGradlePath, $gradle, $utf8NoBom)
        Write-OK "build.gradle Java patched"
    }
    Write-Host "  cap sync android..." -NoNewline
    Push-Location $appDir
    & npx cap sync android 2>&1 | Out-Null
    Pop-Location
    Write-Host " done" -ForegroundColor Green
    Write-Host "  Gradle assembleDebug..."
    $androidDir = "$appDir\android"
    Push-Location $androidDir
    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $buildOutput = & .\gradlew.bat assembleDebug 2>&1
    $ErrorActionPreference = $oldPref
    $exitCode = $LASTEXITCODE
    Pop-Location
    if ($exitCode -eq 0) {
        $apkSrc = "$androidDir\app\build\outputs\apk\debug\app-debug.apk"
        $apkDst = "$OutputDir\cityride-$name-v2.apk"
        Copy-Item $apkSrc $apkDst -Force
        $sizeMB = [math]::Round((Get-Item $apkDst).Length / 1MB, 1)
        Write-OK "APK -> output\cityride-$name-v2.apk ($sizeMB MB)"
    } else {
        Write-Fail "FAILED: $name"
        $buildOutput | Select-String "FAILURE|error:|Exception" | Select-Object -Last 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    }
}
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "  Done! APKs saved to: $OutputDir" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Green
Get-ChildItem $OutputDir -Filter "*-v2.apk" | ForEach-Object {
    Write-Host "  $($_.Name)  ($([math]::Round($_.Length/1MB,1)) MB)" -ForegroundColor Cyan
}
