        document.addEventListener('DOMContentLoaded', () => {
            function getPassengerWaitingTimerHtml(elapsedSecs) {
                const allowedSecs = 300; // 5 mins grace
                if (elapsedSecs <= allowedSecs) {
                    const remaining = allowedSecs - elapsedSecs;
                    const rH = Math.floor(remaining / 3600);
                    const rM = Math.floor((remaining % 3600) / 60);
                    const rS = remaining % 60;
                    const hStr = rH > 0 ? `${rH}:` : '';
                    return `<span id="passenger-waiting-timer" data-elapsed="${elapsedSecs}" style="color:var(--cr-primary); font-weight:700;">Grace: ${hStr}${String(rM).padStart(2,'0')}:${String(rS).padStart(2,'0')}</span>`;
                } else {
                    const over = elapsedSecs - allowedSecs;
                    const oH = Math.floor(over / 3600);
                    const oM = Math.floor((over % 3600) / 60);
                    const oS = over % 60;
                    const hStr = oH > 0 ? `${oH}:` : '';
                    const charge = Math.ceil(over / 60) * 2;
                    return `<span id="passenger-waiting-timer" data-elapsed="${elapsedSecs}" style="color:var(--danger-red, #B71C1C); font-weight:700;">Waiting: ${hStr}${String(oM).padStart(2,'0')}:${String(oS).padStart(2,'0')} (+₹${charge})</span>`;
                }
            }

            // Passenger waiting timer interval
            setInterval(() => {
                const timerEl = document.getElementById('passenger-waiting-timer');
                if (timerEl) {
                    let elapsedSecs = parseInt(timerEl.getAttribute('data-elapsed'), 10);
                    if (!isNaN(elapsedSecs)) {
                        elapsedSecs++;
                        timerEl.outerHTML = getPassengerWaitingTimerHtml(elapsedSecs);
                    }
                }
            }, 1000);

            // Monitor for active mission injection to restyle it on the fly
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if(mutation.target.id === 'active-details' && mutation.addedNodes.length > 0) {
                        restyleActiveDetails();
                        // document.getElementById('history-panel').classList.add('hidden');
                        document.getElementById('active-top-bar').style.display = 'flex';
                        document.getElementById('gps-tracking-pill').style.display = 'block';
                        document.getElementById('active-map-tools').style.display = 'flex';
                    }
                    if(document.getElementById('active-mission-container').classList.contains('hidden')) {
                        // document.getElementById('history-panel').classList.remove('hidden');
                        document.getElementById('active-top-bar').style.display = 'none';
                        document.getElementById('gps-tracking-pill').style.display = 'none';
                        document.getElementById('active-map-tools').style.display = 'none';
                    }
                });
            });
            const ad = document.getElementById('active-details');
            if(ad) observer.observe(ad, { childList: true, subtree: true });
            
            const cont = document.getElementById('active-mission-container');
            if(cont) observer.observe(cont, { attributes: true, attributeFilter: ['class'] });

            function restyleActiveDetails() {
                // Find driver section and reformat
                const detailsHtml = document.getElementById('active-details');
                
                // If it contains "Searching for CityRide Driver..."
                if(detailsHtml.innerHTML.includes('Searching for CityRide Driver')) {
                    detailsHtml.innerHTML = `
                        <div style="text-align:center; padding:24px 0;">
                            <div class="loader-circle"></div>
                            <div style="font-weight:700; font-size:1.1rem; margin-bottom:8px;">Finding your LuxeRide...</div>
                            <div style="font-size:0.9rem; color:var(--cr-text-muted); margin-bottom:24px;">Matching you with the highest-rated drivers nearby...</div>
                            <div style="display:flex; gap:12px; justify-content:center; margin-bottom:32px;">
                                <div style="background:var(--cr-bg); color:var(--cr-primary); padding:6px 12px; border-radius:var(--cr-radius-pill); font-size:0.8rem; font-weight:600; display:flex; align-items:center; gap:6px;">✓ Top Rated Only</div>
                                <div style="background:#DBEAFE; color:var(--cr-accent-blue); padding:6px 12px; border-radius:var(--cr-radius-pill); font-size:0.8rem; font-weight:600; display:flex; align-items:center; gap:6px;">🚗 Green Choice</div>
                            </div>
                            <button onclick="document.querySelector('#hidden-cancel button')?.click()" class="cr-btn cr-btn-light" style="width:100%; border:1px solid var(--cr-border-light); font-weight:600; color:var(--cr-text-main);">✕ Cancel Booking</button>
                            <button onclick="window.location.href='dashboard.html'" class="cr-btn cr-btn-light" style="width:100%; margin-top:12px; border:none; font-weight:600; color:var(--cr-text-muted); background:transparent; box-shadow:none;">← Back to Dashboard</button>
                        </div>
                        <div style="display:none;" id="hidden-cancel">
                            ${detailsHtml.querySelector('button[onclick*="cancelRide"]')?.outerHTML || ''}
                        </div>
                    `;
                    return;
                }
                
                // Break the MutationObserver infinite loop if already restyled
                if (detailsHtml.innerHTML.includes('driver-card-luxe')) return;
                
                // If assigned or ongoing
                const am = window._currentActiveMission;
                if (am && (am.status === 'assigned' || am.status === 'ongoing')) {
                    const otp = am.otp || '----';
                    const driverName = am.driver_name || 'Driver';
                    const carModel = am.car_model || 'Premium Vehicle';
                    const carNumber = am.car_number || 'TBD';
                    let driverPhone = am.driver_phone || '';
                    if (driverPhone && !driverPhone.startsWith('tel:')) driverPhone = 'tel:' + driverPhone;
                    
                    const currentBookingId = am.id;
                    window._activeBookingId = currentBookingId;
                    if (window._rtcSocket && currentBookingId) {
                        window._rtcSocket.bookingIdContext = currentBookingId;
                        window._rtcSocket.emit('track_booking', currentBookingId);
                    }
                    
                    let etaText = am.estimated_duration ? `Arrival in ${am.estimated_duration}` : 'Arrival Pending';
                    const distVal = am.actual_distance || am.estimated_distance || am.distance || 'Unknown';
                    const distText = distVal === 'Unknown' ? distVal : `${distVal} away`;
                    let subText = `<span style="color:var(--cr-primary);">ON TIME</span> • ${distText}`;
                    
                    let otpBlock = ``;
                    if (am.status === 'assigned' && am.reached_pickup_time) {
                        etaText = 'Driver Arrived';
                        const elapsed = am.reached_elapsed_seconds || 0;
                        subText = getPassengerWaitingTimerHtml(elapsed);
                        otpBlock = `
                            <div class="ar-otp-badge">
                                <div class="otp-label">YOUR OTP</div>
                                <div class="otp-val">${otp}</div>
                            </div>
                        `;
                    } else if (am.status === 'assigned') {
                        otpBlock = `
                            <div class="ar-otp-badge">
                                <div class="otp-label">YOUR OTP</div>
                                <div class="otp-val">${otp}</div>
                            </div>
                        `;
                    } else if (am.status === 'ongoing') {
                        etaText = 'On Trip';
                        subText = `<span style="color:var(--cr-primary);">En route to destination</span>`;
                    }

                    detailsHtml.innerHTML = `
                        <div class="flex-between" style="margin-bottom:16px;">
                            <div>
                                <div class="ar-eta">${etaText}</div>
                                <div style="font-size:0.85rem; color:var(--cr-text-muted); font-weight:600;">${subText}</div>
                            </div>
                            ${otpBlock}
                        </div>

                        <div class="driver-card-luxe">
                            <div style="position:relative;">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(driverName)}&background=random" class="dc-avatar">
                                <div class="dc-rating">★ 4.9</div>
                            </div>
                            <div class="dc-info">
                                <div style="font-weight:600; font-size:1rem;">${driverName}</div>
                                <div style="font-size:0.85rem; color:var(--cr-text-muted);">${carModel}</div>
                            </div>
                            <div class="dc-plate">${carNumber}</div>
                        </div>

                        <div class="ar-actions">
                            <button class="ar-action-btn" onclick="openCallOverlay('${driverPhone}', '${driverName}', '${carNumber}')"><div class="ar-action-icon call">📞</div><span class="ar-action-label">Call</span></button>
                            <button class="ar-action-btn" onclick="window.location.href='chat.html?bookingId=${currentBookingId}&driverName=${encodeURIComponent(driverName)}&driverPhone=${encodeURIComponent(driverPhone)}&driverCar=${encodeURIComponent(carNumber)}'"><div class="ar-action-icon chat">💬</div><span class="ar-action-label">Chat</span></button>
                            <button class="ar-action-btn" onclick="shareTrip('${currentBookingId}')"><div class="ar-action-icon share">📤</div><span class="ar-action-label">Share</span></button>
                            <button class="ar-action-btn" onclick="triggerSOS()"><div class="ar-action-icon sos">✱</div><span class="ar-action-label">SOS</span></button>
                        </div>
                        
                        <button class="cr-btn cancel-trip-btn" onclick="cancelRide(${currentBookingId}, 1)">Cancel Trip</button>
                    `;
                }
            }
        });