/**
 * CityRide Taxi - Customer Panel Universal Notification Engine
 * Handles real-time Activity Toasts, Audio Chimes, Browser Push Notifications & Notification Center
 */

(function (window) {
    'use strict';

    const STORAGE_KEY = 'cityride_customer_notifications';
    const SHOWN_TOASTS_KEY = 'cityride_shown_toast_keys';
    const MAX_HISTORY = 30;

    // Clear any old stacked notifications from legacy storage on script load
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch(e) {}

    function isToastAlreadyShown(key) {
        if (!key) return false;
        try {
            const raw = sessionStorage.getItem(SHOWN_TOASTS_KEY) || localStorage.getItem(SHOWN_TOASTS_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return list.includes(key);
        } catch(e) { return false; }
    }

    function markToastShown(key) {
        if (!key) return;
        try {
            const raw = sessionStorage.getItem(SHOWN_TOASTS_KEY) || localStorage.getItem(SHOWN_TOASTS_KEY);
            const list = raw ? JSON.parse(raw) : [];
            if (!list.includes(key)) {
                list.push(key);
                if (list.length > 50) list.shift();
                sessionStorage.setItem(SHOWN_TOASTS_KEY, JSON.stringify(list));
                localStorage.setItem(SHOWN_TOASTS_KEY, JSON.stringify(list));
            }
        } catch(e) {}
    }

    // --- 1. WEB AUDIO API CHIME GENERATOR ---
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    function playChime(type) {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'success' || type === 'ride_accepted') {
                // Dual high chime (C5 -> G5)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
            } else if (type === 'ride_completed') {
                // Triple fanfare (C5 -> E5 -> G5 -> C6)
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.setValueAtTime(659.25, now + 0.1);
                osc.frequency.setValueAtTime(783.99, now + 0.2);
                osc.frequency.setValueAtTime(1046.50, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
                osc.start(now);
                osc.stop(now + 0.7);
            } else if (type === 'reached_pickup' || type === 'ride_ongoing') {
                // Upward arpeggio
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now); // A4
                osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
                osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                osc.start(now);
                osc.stop(now + 0.6);
            } else if (type === 'chat_message' || type === 'chat') {
                // High-pitch dual chime (A5 -> D6) for Chat Alert
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now); // A5
                osc.frequency.setValueAtTime(1174.66, now + 0.12); // D6
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                osc.start(now);
                osc.stop(now + 0.45);
            } else if (type === 'ride_cancelled' || type === 'error') {
                // Low warning tone
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now); // A3
                osc.frequency.setValueAtTime(196, now + 0.15); // G3
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            } else {
                // Subtle default notification beep
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, now); // D5
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            }
        } catch (e) {
            console.warn('[CustomerNotifications] Audio chime error:', e.message);
        }
    }

    // --- 2. CAPACITOR NATIVE & BROWSER PUSH NOTIFICATION ---
    function requestPushPermission() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
            try {
                window.Capacitor.Plugins.LocalNotifications.requestPermissions().catch(() => {});
            } catch (e) {}
        }
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }

    function sendPushNotification(title, body, iconUrl) {
        // 1. Capacitor Native Android APK Notification
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
            try {
                window.Capacitor.Plugins.LocalNotifications.schedule({
                    notifications: [
                        {
                            title: title,
                            body: body,
                            id: Math.floor(Math.random() * 100000) + 1,
                            schedule: { at: new Date(Date.now() + 50) },
                            sound: 'res://platform_default',
                            actionTypeId: "",
                            extra: null
                        }
                    ]
                });
            } catch (e) {
                console.warn('[CustomerNotifications] Native LocalNotifications error:', e.message);
            }
        }

        // 2. Web Browser Push Notification
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body: body,
                    icon: iconUrl || '/car.png',
                    badge: '/car.png',
                    tag: 'cityride-activity-' + Date.now()
                });
            } catch (e) {
                console.warn('[CustomerNotifications] Push notification error:', e.message);
            }
        }
    }

    // --- 3. TOAST CONTAINER CREATION ---
    function getOrCreateToastContainer() {
        let container = document.getElementById('cr-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'cr-toast-container';
            container.className = 'cr-toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    // Map activity key to visual configs
    const ACTIVITY_CONFIGS = {
        ride_booked: {
            title: '🚕 Ride Requested!',
            colorClass: 'cr-toast-pending',
            icon: '🚖',
            sound: 'info'
        },
        pending: {
            title: '🚕 Ride Requested!',
            colorClass: 'cr-toast-pending',
            icon: '🚖',
            sound: 'info'
        },
        ride_accepted: {
            title: '⚡ Captain Assigned!',
            colorClass: 'cr-toast-assigned',
            icon: '👨‍✈️',
            sound: 'ride_accepted'
        },
        assigned: {
            title: '⚡ Captain Assigned!',
            colorClass: 'cr-toast-assigned',
            icon: '👨‍✈️',
            sound: 'ride_accepted'
        },
        reached_pickup: {
            title: '📍 Captain at Pickup!',
            colorClass: 'cr-toast-pickup',
            icon: '📍',
            sound: 'reached_pickup'
        },
        ride_ongoing: {
            title: '🏁 Trip Started!',
            colorClass: 'cr-toast-ongoing',
            icon: '🚗',
            sound: 'ride_ongoing'
        },
        ongoing: {
            title: '🏁 Trip Started!',
            colorClass: 'cr-toast-ongoing',
            icon: '🚗',
            sound: 'ride_ongoing'
        },
        ride_completed: {
            title: '🎉 Trip Completed!',
            colorClass: 'cr-toast-completed',
            icon: '🏁',
            sound: 'ride_completed'
        },
        completed: {
            title: '🎉 Trip Completed!',
            colorClass: 'cr-toast-completed',
            icon: '🏁',
            sound: 'ride_completed'
        },
        finished: {
            title: '🎉 Trip Completed!',
            colorClass: 'cr-toast-completed',
            icon: '🏁',
            sound: 'ride_completed'
        },
        ride_cancelled: {
            title: '❌ Ride Cancelled',
            colorClass: 'cr-toast-cancelled',
            icon: '🚫',
            sound: 'ride_cancelled'
        },
        cancelled: {
            title: '❌ Ride Cancelled',
            colorClass: 'cr-toast-cancelled',
            icon: '🚫',
            sound: 'ride_cancelled'
        },
        chat: {
            title: '💬 New Message',
            colorClass: 'cr-toast-assigned', // Blue color works well for chat
            icon: '💬',
            sound: 'info'
        }
    };

    // --- 4. SHOW TOAST NOTIFICATION ---
    function showToast(activityType, customTitle, message, duration = 4000, bookingId = null) {
        // STRICT DEDUPLICATION: Ensure each unique notification only pops up ONCE
        const dedupeKey = bookingId ? `${bookingId}_${activityType}` : `${activityType}_${customTitle}_${message}`;
        if (isToastAlreadyShown(dedupeKey)) {
            return; // Never re-display a notification that was already shown!
        }
        markToastShown(dedupeKey);

        const config = ACTIVITY_CONFIGS[activityType] || {
            title: customTitle || 'Activity Update',
            colorClass: 'cr-toast-info',
            icon: '🔔',
            sound: 'info'
        };

        const displayTitle = customTitle || config.title;
        const container = getOrCreateToastContainer();

        // Limit maximum active toasts on screen to 1 at a time so popups NEVER stack
        const existingToasts = container.querySelectorAll('.cr-toast-card');
        existingToasts.forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = `cr-toast-card ${config.colorClass}`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        toast.innerHTML = `
            <div class="cr-toast-icon">${config.icon}</div>
            <div class="cr-toast-content">
                <div class="cr-toast-header">
                    <span class="cr-toast-title">${escapeHtml(displayTitle)}</span>
                    <span class="cr-toast-time">${timestamp}</span>
                </div>
                <div class="cr-toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="cr-toast-close" onclick="this.parentElement.remove()" title="Close">&times;</button>
        `;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('active');
        });

        // Play audio chime
        playChime(config.sound);

        // Push desktop notification
        sendPushNotification(displayTitle, message);

        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.remove('active');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }

    // --- 5. NOTIFICATION HISTORY CENTER & STORAGE ---
    function getStoredNotifications() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveNotificationToHistory(item) {
        const history = getStoredNotifications();
        history.unshift(item);
        if (history.length > MAX_HISTORY) history.pop();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {}

        updateNotificationBadge();
        renderNotificationCenterDrawer();
    }

    function markAllAsRead() {
        const history = getStoredNotifications();
        history.forEach(item => item.read = true);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {}
        updateNotificationBadge();
        renderNotificationCenterDrawer();
    }

    function updateNotificationBadge() {
        const history = getStoredNotifications();
        const unreadCount = history.filter(i => !i.read).length;
        const badgeEls = document.querySelectorAll('.cr-notif-badge');

        badgeEls.forEach(badge => {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        });
    }

    function renderNotificationCenterDrawer() {
        const listEl = document.getElementById('cr-notif-list');
        if (!listEl) return;

        const history = getStoredNotifications();
        if (history.length === 0) {
            listEl.innerHTML = `
                <div class="cr-notif-empty">
                    <div style="font-size: 2.5rem; margin-bottom: 8px;">🔔</div>
                    <div style="font-weight: 600; color: var(--cr-text-muted);">No activity notifications yet</div>
                    <div style="font-size: 0.8rem; color: var(--cr-text-muted); opacity: 0.7;">Updates about your rides will appear here in real time.</div>
                </div>
            `;
            return;
        }

        listEl.innerHTML = history.map(item => {
            const timeAgo = formatTimeAgo(item.timestamp);
            const isUnread = !item.read;
            return `
                <div class="cr-notif-item ${isUnread ? 'unread' : ''}">
                    <div class="cr-notif-item-icon">${item.icon || '🔔'}</div>
                    <div class="cr-notif-item-body">
                        <div class="cr-notif-item-title">${escapeHtml(item.title)}</div>
                        <div class="cr-notif-item-msg">${escapeHtml(item.message)}</div>
                        <div class="cr-notif-item-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function formatTimeAgo(ts) {
        if (!ts) return 'Just now';
        const diffSecs = Math.floor((Date.now() - ts) / 1000);
        if (diffSecs < 30) return 'Just now';
        if (diffSecs < 60) return `${diffSecs}s ago`;
        const diffMins = Math.floor(diffSecs / 60);
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return new Date(ts).toLocaleDateString();
    }

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

    // Toggle drawer UI
    function toggleNotificationDrawer() {
        let drawer = document.getElementById('cr-notif-drawer');
        if (!drawer) {
            createNotificationDrawerUI();
            drawer = document.getElementById('cr-notif-drawer');
        }
        if (drawer) {
            const isOpen = drawer.classList.contains('active');
            if (isOpen) {
                drawer.classList.remove('active');
            } else {
                markAllAsRead();
                drawer.classList.add('active');
            }
        }
    }

    function createNotificationDrawerUI() {
        if (document.getElementById('cr-notif-drawer')) return;

        const drawer = document.createElement('div');
        drawer.id = 'cr-notif-drawer';
        drawer.className = 'cr-notif-drawer';
        drawer.innerHTML = `
            <div class="cr-notif-drawer-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:1.2rem;">🔔</span>
                    <span style="font-weight:700; font-size:1rem; color:var(--cr-text-main);">Activity Updates</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <button class="cr-notif-clear-btn" id="cr-notif-clear-all" title="Clear All History">Clear All</button>
                    <button class="cr-notif-close-btn" id="cr-notif-close-drawer">&times;</button>
                </div>
            </div>
            <div class="cr-notif-drawer-body" id="cr-notif-list">
                <!-- Notifications list rendered dynamically -->
            </div>
        `;
        document.body.appendChild(drawer);

        document.getElementById('cr-notif-close-drawer').addEventListener('click', () => {
            drawer.classList.remove('active');
        });

        document.getElementById('cr-notif-clear-all').addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEY);
            updateNotificationBadge();
            renderNotificationCenterDrawer();
        });

        renderNotificationCenterDrawer();
    }

    // Helper method to notify from socket payloads
    function processSocketActivity(data) {
        if (!data) return;
        const status = (data.status || '').toLowerCase();
        const bId = data.bookingId || data.id || '';
        const driverName = data.driverName || data.driver_name || '';
        const carModel = data.carModel || data.car_model || '';
        const carNumber = data.carNumber || data.car_number || '';
        const otp = data.otp || data.journey_otp || '';
        const dropLoc = data.dropLoc || data.drop_loc || '';
        const fare = data.finalFare || data.fare || data.estimated_price || '';

        if (status === 'pending' || status === 'ride_booked') {
            showToast('ride_booked', '🚕 Ride Booked!', `Ride #B${bId} successfully placed. Searching for nearby drivers...`, 6000, bId + '_pending');
        } else if (status === 'assigned' || status === 'ride_accepted') {
            const vehicleInfo = carModel ? ` (${carModel}${carNumber ? ' - ' + carNumber : ''})` : '';
            const msg = driverName ? `Captain ${driverName}${vehicleInfo} accepted your ride and is on the way!` : 'A captain has accepted your booking request and is en route!';
            showToast('ride_accepted', '🚗 Driver Accepted!', msg, 6000, bId + '_assigned');
        } else if (status === 'reached_pickup') {
            const otpText = otp ? ` Share OTP: ${otp} to start the ride.` : '';
            const msg = driverName ? `Captain ${driverName} has arrived at your pickup location!${otpText}` : `Your captain has arrived at your pickup location!${otpText}`;
            showToast('reached_pickup', '📍 Driver Arrived at Pickup!', msg, 7000, bId + '_reached');
        } else if (status === 'ongoing' || status === 'ride_ongoing') {
            const destText = dropLoc ? ` to ${dropLoc.split(',')[0]}` : '';
            showToast('ride_ongoing', '🚀 Trip Started!', `Your trip${destText} has started. Wishing you a safe & comfortable journey!`, 6000, bId + '_ongoing');
        } else if (status === 'completed' || status === 'finished' || status === 'ride_completed') {
            const fareMsg = fare ? ` Total Fare: ₹${fare}.` : '';
            showToast('ride_completed', '🏁 Trip Completed!', `You have reached your destination!${fareMsg} Thank you for riding with CityRide.`, 7000, bId + '_completed');
        } else if (status === 'cancelled' || status === 'ride_cancelled') {
            showToast('ride_cancelled', '❌ Ride Cancelled', `Booking #B${bId} has been cancelled.`, 6000, bId + '_cancelled');
        }
    }

    // --- 6. HIGH-INTENSITY STRONG CHAT NOTIFICATION ENGINE ---
    function showChatNotification(data, role) {
        if (!data) return;
        const senderName = data.senderName || (role === 'driver' ? 'Customer' : 'Driver');
        const messageText = data.message || 'Sent a new message';
        const bookingId = data.bookingId || '';

        // 1. Strong Haptic Vibration Pattern (Vibrate 200ms - Pause 80ms - Vibrate 200ms - Pause 80ms - Vibrate 300ms)
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate([200, 80, 200, 80, 300]);
            } catch (e) {}
        }

        // 2. Play Web Audio API Dual High-Pitch Chime
        playChime('chat_message');

        // 3. Capacitor Native Android APK Local Push & Web Push Notification
        sendPushNotification(`💬 Message from ${senderName}`, messageText);

        // 4. High-Visibility Glassmorphic Top Banner Toast with Action Button
        const container = getOrCreateToastContainer();
        const toast = document.createElement('div');
        toast.className = 'cr-toast-card cr-toast-chat-strong';
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const targetRole = role || (window.location.pathname.includes('driver') ? 'driver' : 'user');
        const chatUrl = `chat.html?bookingId=${bookingId}&role=${targetRole}`;

        toast.innerHTML = `
            <div class="cr-toast-icon" style="font-size: 1.6rem; filter: drop-shadow(0 2px 6px rgba(0,255,102,0.4));">💬</div>
            <div class="cr-toast-content" style="flex:1;">
                <div class="cr-toast-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="cr-toast-title" style="color:#ffffff; font-weight:800; font-size:0.95rem;">💬 ${escapeHtml(senderName)}</span>
                    <span class="cr-toast-time" style="color:rgba(255,255,255,0.7); font-size:0.75rem;">${timestamp}</span>
                </div>
                <div class="cr-toast-message" style="color:rgba(255,255,255,0.95); font-weight:600; margin-top:2px; font-size:0.9rem;">"${escapeHtml(messageText)}"</div>
                <div style="margin-top:8px;">
                    <a href="${chatUrl}" class="cr-chat-toast-reply-btn">💬 Reply Now</a>
                </div>
            </div>
            <button class="cr-toast-close" onclick="event.stopPropagation(); this.parentElement.remove()" title="Close" style="color:white; opacity:0.8;">&times;</button>
        `;

        toast.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                window.location.href = chatUrl;
            }
        };

        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('active'));

        // Save to History Center
        saveNotificationToHistory({
            id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            type: 'chat_message',
            title: `💬 ${senderName}`,
            message: messageText,
            timestamp: Date.now(),
            icon: '💬',
            bookingId: bookingId,
            read: false
        });

        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.remove('active');
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000);
    }

    // Dynamic style injection for Strong Chat Toast
    const chatStyle = document.createElement('style');
    chatStyle.textContent = `
        .cr-toast-chat-strong {
            background: linear-gradient(135deg, rgba(0, 107, 58, 0.96), rgba(0, 153, 84, 0.96)) !important;
            backdrop-filter: blur(16px) !important;
            -webkit-backdrop-filter: blur(16px) !important;
            color: #ffffff !important;
            border: 2px solid #00FF66 !important;
            box-shadow: 0 12px 36px rgba(0, 107, 58, 0.45), 0 0 25px rgba(0, 255, 102, 0.35) !important;
            animation: chatToastPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            cursor: pointer;
        }
        @keyframes chatToastPop {
            0% { transform: translateY(-30px) scale(0.9); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .cr-chat-toast-reply-btn {
            display: inline-block;
            background: #00FF66;
            color: #004D28 !important;
            font-weight: 800;
            font-size: 0.78rem;
            padding: 5px 14px;
            border-radius: 20px;
            text-decoration: none !important;
            box-shadow: 0 4px 12px rgba(0, 255, 102, 0.4);
            transition: transform 0.15s ease;
        }
        .cr-chat-toast-reply-btn:hover {
            transform: scale(1.05);
        }
        .chat-pulse-ring {
            animation: chatPulseRing 1.2s infinite ease-out !important;
        }
        @keyframes chatPulseRing {
            0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
            70% { box-shadow: 0 0 0 12px rgba(220, 38, 38, 0); }
            100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
    `;
    document.head.appendChild(chatStyle);

    // Auto-initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        requestPushPermission();
        updateNotificationBadge();
        
        // Attach click handler to any button with class 'cr-notif-bell-btn'
        document.querySelectorAll('.cr-notif-bell-btn').forEach(btn => {
            btn.addEventListener('click', toggleNotificationDrawer);
        });
    });

    // Global Public API
    window.CustomerNotifications = {
        notify: showToast,
        showChatNotification: showChatNotification,
        processSocketActivity: processSocketActivity,
        toggleDrawer: toggleNotificationDrawer,
        requestPermission: requestPushPermission,
        playChime: playChime
    };
    window.DriverNotifications = window.CustomerNotifications;

})(window);
