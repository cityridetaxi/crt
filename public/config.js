/**
 * CityRide Platform - Standalone & Native Mobile Configuration
 */

// 1. Determine Native Mobile Environment (Capacitor / Cordova / File Protocol)
const isNativeApp = (
    window.location.protocol === 'file:' || 
    window.location.protocol === 'capacitor:' ||
    typeof window.Capacitor !== 'undefined' || 
    window.APP_MODE === 'capacitor' ||
    (window.location.origin && window.location.origin.includes('localhost') && !window.location.port)
);

// 2. Default Backend Server Resolution
// Default production server backend for APKs: https://cityridetaxi.org
let DEFAULT_SERVER_URL = "https://cityridetaxi.org"; 

let resolvedApiBaseUrl = window.API_BASE_URL || window.SERVER_URL || "";

if (isNativeApp && !resolvedApiBaseUrl) {
    resolvedApiBaseUrl = DEFAULT_SERVER_URL;
}

if (!isNativeApp && !resolvedApiBaseUrl) {
    resolvedApiBaseUrl = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : "";
}

// Clean up trailing slash
resolvedApiBaseUrl = resolvedApiBaseUrl.replace(/\/$/, '');

window.API_BASE_URL = resolvedApiBaseUrl;
const API_BASE_URL = resolvedApiBaseUrl;

console.log("🚀 CityRide Engine Initialized | API_BASE_URL:", window.API_BASE_URL || "(Same-Origin Relative)");

// Global helper function to get absolute API URL for any path
window.getApiUrl = function(path) {
    if (!path) return window.API_BASE_URL;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return (window.API_BASE_URL || '') + cleanPath;
};

// Reusable Passcode Visibility Toggle Helper
window.togglePasswordVisibility = function(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    
    if (isPassword) {
        button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
        button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
};

// 3. Global Network Interceptors (Window.fetch & XMLHttpRequest)
if (window.API_BASE_URL) {
    const _originalFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
        init = init || {};
        
        let url = input;
        if (typeof input === 'string') {
            if (input.startsWith('/')) {
                url = window.API_BASE_URL + input;
            }
        } else if (typeof Request !== 'undefined' && input instanceof Request) {
            let reqUrl = input.url;
            if (reqUrl.startsWith('/')) {
                url = new Request(window.API_BASE_URL + reqUrl, input);
            }
        }

        let urlStr = '';
        if (typeof url === 'string') urlStr = url;
        else if (url && url.url) urlStr = url.url;

        let isInternal = urlStr.startsWith('/') || urlStr.startsWith(window.API_BASE_URL);

        if (init.credentials === undefined && isInternal) {
            init.credentials = 'include';
        }

        return _originalFetch(url, init);
    };

    const _originalXHR = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        let finalUrl = url;
        if (typeof url === 'string' && url.startsWith('/')) {
            finalUrl = window.API_BASE_URL + url;
        }
        
        let urlStr = '';
        if (typeof finalUrl === 'string') urlStr = finalUrl;
        else if (finalUrl && finalUrl.url) urlStr = finalUrl.url;

        if (urlStr.startsWith('/') || urlStr.startsWith(window.API_BASE_URL)) {
            this.withCredentials = true;
        }

        return _originalXHR.call(this, method, finalUrl, async !== false, user, password);
    };
}

// 4. Socket.IO Interceptor (Automatically routes io() calls to window.API_BASE_URL)
let _nativeSocketIo = window.io;
Object.defineProperty(window, 'io', {
    get() {
        return function(url, opts) {
            if (!_nativeSocketIo) return null;
            let socketUrl = url;
            let options = opts;

            if (typeof url === 'object' || !url) {
                options = url || {};
                socketUrl = window.API_BASE_URL || undefined;
            } else if (typeof url === 'string' && (url === '/' || url === '')) {
                socketUrl = window.API_BASE_URL || undefined;
            }

            options = options || {};
            if (options.withCredentials === undefined) {
                options.withCredentials = true;
            }
            if (!options.transports) {
                options.transports = ['websocket', 'polling'];
            }

            return _nativeSocketIo(socketUrl, options);
        };
    },
    set(v) {
        _nativeSocketIo = v;
    },
    configurable: true
});

// 5. Capacitor Native Permissions & Battery Optimization Initialization
document.addEventListener('DOMContentLoaded', async () => {
    if (window.Capacitor && window.Capacitor.Plugins) {
        const plugins = window.Capacitor.Plugins;
        
        try {
            if (plugins.Geolocation) {
                await plugins.Geolocation.requestPermissions();
            }
        } catch(e) { console.warn("Geolocation permission prompt failed", e); }
        
        try {
            if (plugins.LocalNotifications) {
                await plugins.LocalNotifications.requestPermissions();
            }
        } catch(e) { console.warn("Notification permission prompt failed", e); }

        try {
            if (plugins.CustomerBackgroundPlugin) {
                await plugins.CustomerBackgroundPlugin.requestIgnoreBatteryOptimizations();
            } else if (plugins.DriverBackgroundPlugin) {
                await plugins.DriverBackgroundPlugin.requestIgnoreBatteryOptimizations();
            }
        } catch(e) { console.warn("Battery optimization request error", e); }

        try {
            if (plugins.BackgroundLocationPlugin) {
                await plugins.BackgroundLocationPlugin.promptEnableLocation();
            }
        } catch(e) { console.warn("Location prompt error", e); }
    }
});
