/**
 * CityRideTaxi - Main Application Logic
 */

// Global Fetch Interceptor for Auth Expiration Redirects
(function() {
    const originalFetch = window.fetch;

    function getLoginRedirect(url) {
        const path = (window.location.pathname || '').toLowerCase();
        if (path.includes('vendor')) return 'vendor-login.html';
        if (path.includes('driver')) return 'driver-login.html';
        if (path.includes('admin')) return 'admin-login.html';
        if (typeof url === 'string' && url.includes('/api/')) {
            if (url.includes('/api/admin/') || url.includes('role=admin')) return 'admin-login.html';
            if (url.includes('/api/vendor/') || url.includes('role=vendor')) return 'vendor-login.html';
            if (url.includes('/api/driver/') || url.includes('role=driver')) return 'driver-login.html';
        }
        return 'auth.html';
    }

    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const url = args[0];
        
        if (typeof url === 'string' && url.includes('/api/auth/logout')) {
            return response;
        }

        if (response.status === 401) {
            const redirect = getLoginRedirect(url);
            if (redirect) window.location.href = redirect;
        }
        return response;
    };
})();

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

const allowedVehicleTypes = ['bike', 'auto', 'hatchback', 'sedan', 'suv', '8plus1', 'van24'];
const allowedTripTypes = ['local', 'oneway', 'round', 'rental'];

function getTransformedType(obj, type) {
    if (!obj) return null;
    switch (type) {
        case 'bike': return obj.bike;
        case 'auto': return obj.auto;
        case 'hatchback': return obj.hatchback;
        case 'sedan': return obj.sedan;
        case 'suv': return obj.suv;
        case '8plus1': return obj['8plus1'];
        case 'van24': return obj.van24;
        default: return null;
    }
}
function setTransformedType(obj, type, val) {
    if (!obj) return;
    switch (type) {
        case 'bike': obj.bike = val; break;
        case 'auto': obj.auto = val; break;
        case 'hatchback': obj.hatchback = val; break;
        case 'sedan': obj.sedan = val; break;
        case 'suv': obj.suv = val; break;
        case '8plus1': obj['8plus1'] = val; break;
        case 'van24': obj.van24 = val; break;
    }
}
function getTripPricing(info, tripTypeId) {
    if (!info) return null;
    switch (tripTypeId) {
        case 'local': return info.local;
        case 'oneway': return info.oneway;
        case 'round': return info.round;
        case 'rental': return info.rental;
        default: return null;
    }
}
function getRentalConfig(rentalInfo, packageVal) {
    if (!rentalInfo) return null;
    switch (packageVal) {
        case '2-20': return Reflect.get(rentalInfo, '2-20') || null;
        case '4-40': return Reflect.get(rentalInfo, '4-40') || null;
        case '8-80': return Reflect.get(rentalInfo, '8-80') || null;
        case '12-120': return Reflect.get(rentalInfo, '12-120') || null;
        default: return null;
    }
}
function getVehicleIcon(vType) {
    switch (vType) {
        case 'bike': return VEHICLE_ICONS.bike;
        case 'auto': return VEHICLE_ICONS.auto;
        case 'hatchback': return VEHICLE_ICONS.hatchback;
        case 'sedan': return VEHICLE_ICONS.sedan;
        case 'suv': return VEHICLE_ICONS.suv;
        case '8plus1': return VEHICLE_ICONS['8plus1'];
        case 'van24': return VEHICLE_ICONS.van24;
        default: return '<img src="https://img.icons8.com/color/96/000000/car.png" alt="Vehicle" style="width:100%; height:100%; object-fit:contain;">';
    }
}

const VEHICLE_ICONS = {
    bike: `<div style="font-size: 2.2rem; line-height: 1; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">🏍️</div>`,
    auto: `<div style="font-size: 2.2rem; line-height: 1; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">🛺</div>`,
    hatchback: `<div style="font-size: 2.2rem; line-height: 1; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">🚙</div>`,
    sedan: `<div style="font-size: 2.2rem; line-height: 1; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">🚗</div>`,
    suv: `<div style="font-size: 2.2rem; line-height: 1; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">🛻</div>`,
    '8plus1': `<div style="font-size: 2.2rem; line-height: 1; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">🚐</div>`,
    van24: `<div style="font-size: 2.2rem; line-height: 1; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">🚌</div>`
};

document.addEventListener('DOMContentLoaded', () => {
    const isLandingPage = window.location.pathname.endsWith('/') || 
                          window.location.pathname === '/' || 
                          window.location.pathname.endsWith('/index.html') ||
                          window.location.pathname.endsWith('index.html');
    const isAuthPage = window.location.pathname.includes('/auth') || 
                       window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('auth.html');

    const member = JSON.parse(localStorage.getItem('cityride_member'));

    // 1. Landing Page Logic (Home)
    // 2. Auth Guard for Landing Page (/)
    // If you are on the landing page and NOT logged in as a passenger, we show login.
    if (isLandingPage && !member) {
        window.location.href = 'auth.html';
        return;
    }

    const bookingForm = document.getElementById('booking-form');
    const passengerInput = document.getElementById('passengers');
    const vehicleSelect = document.getElementById('vehicle-type');
    const fareEstimate = document.getElementById('fare-estimate');
    const distanceVal = document.getElementById('distance-val');
    const fareVal = document.getElementById('fare-val');
    const vehicleBadge = document.getElementById('vehicle-badge');
    const categoryBtns = document.querySelectorAll('.bk-tab');
    const destinationGroup = document.getElementById('destination-group');
    const pickupDate = document.getElementById('pickup-date');
    const returnDate = document.getElementById('return-date');
    const returnDateGroup = document.getElementById('return-date-group');
    const rentalPackageGroup = document.getElementById('rental-package-group');
    const rentalPackageSelect = document.getElementById('rental-package');

    // Extra Drops Elements
    const extraDropsContainer = document.getElementById('extra-drops-container');
    const addDropBtn = document.getElementById('add-drop-btn');
    const addDropBtnContainer = document.getElementById('add-drop-btn-container');
    let extraDropCount = 0;

    function updateExtraDropsVisibility() {
        if (currentCategory === 'local' || currentCategory === 'oneway') {
            if (addDropBtnContainer) addDropBtnContainer.style.display = 'block';
            if (extraDropsContainer) extraDropsContainer.style.display = 'flex';
        } else {
            if (addDropBtnContainer) addDropBtnContainer.style.display = 'none';
            if (extraDropsContainer) extraDropsContainer.style.display = 'none';
            if (extraDropsContainer) extraDropsContainer.innerHTML = '';
            extraDropCount = 0;
        }
    }

    // 1. Initialize Date Restrictions (Must be future)
    const today = new Date().toISOString().split('T')[0];
    pickupDate.setAttribute('min', today);
    pickupDate.value = today;

    // Auto-fetch live location on start for all modes
    setTimeout(() => useLiveLocation(null, true), 1000); 

    if (returnDate) {
        returnDate.setAttribute('min', today);
        returnDate.value = today;
    }

    // 2. Service Category Switching
    let currentCategory = 'local'; // 'local', 'outstation', or 'rental'

    function updateDateTimeFieldsVisibility() {
        const bookingTypeGroup = document.getElementById('booking-type-group');
        const dateGroup = document.getElementById('pickup-date-group');
        const timeGroup = document.getElementById('pickup-time-group');
        const bookingTypeSelect = document.getElementById('booking-type');

        if (bookingTypeGroup) bookingTypeGroup.style.display = 'flex';

        if (bookingTypeSelect && bookingTypeSelect.value === 'now') {
            if (dateGroup) dateGroup.style.display = 'none';
            if (timeGroup) timeGroup.style.display = 'none';
            if (pickupDate) pickupDate.required = false;
            const pTime = document.getElementById('pickup-time');
            if (pTime) pTime.required = false;
        } else {
            if (dateGroup) dateGroup.style.display = 'flex';
            if (timeGroup) timeGroup.style.display = 'flex';
            if (pickupDate) pickupDate.required = true;
            const pTime = document.getElementById('pickup-time');
            if (pTime) pTime.required = true;
        }
    }

    const bookingTypeSelect = document.getElementById('booking-type');
    if (bookingTypeSelect) {
        bookingTypeSelect.addEventListener('change', () => {
            updateDateTimeFieldsVisibility();
            calculateFare();
        });
    }

    updateDateTimeFieldsVisibility();
    updateExtraDropsVisibility();

    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            
            // Clear vehicle selection and hide fare strip on mode change
            selectedVehicleData = null;
            if (vehicleSelect) vehicleSelect.value = '';
            const strip = document.getElementById('fare-strip');
            if (strip) strip.classList.remove('visible');
            
            updateDateTimeFieldsVisibility();
            updateExtraDropsVisibility();

            if (currentCategory === 'rental') {
                destinationGroup.style.display = 'none';
                document.getElementById('drop').required = false;
                rentalPackageGroup.style.display = 'flex';
                returnDateGroup.style.display = 'none';
                
                // Trigger live location fetch (silent)
                useLiveLocation(null, true);

                if (pickupCoords) calculateFare();
            } else {
                destinationGroup.style.display = 'flex';
                document.getElementById('drop').required = true;
                rentalPackageGroup.style.display = 'none';
                returnDateGroup.style.display = 'none';
                
                if (dropCoords) calculateFare();
                else document.getElementById('vehicle-selection-container').innerHTML = '';
            }
        });
    });

    // 3. Logic to handle updates
    if (rentalPackageSelect) rentalPackageSelect.addEventListener('change', calculateFare);

    let currentTripType = 'oneway';

    // Round-trip toggle logic (outstation only)
    function updateRoundTripToggleUI() {
        const toggleGroup = document.getElementById('round-trip-toggle-group');
        const toggle = document.getElementById('round-trip-toggle');
        const slider = document.getElementById('round-trip-slider');
        const knob = document.getElementById('round-trip-knob');
        const sub = document.getElementById('round-trip-toggle-sub');
        const returnRow = document.getElementById('return-date-row');
        const ret = document.getElementById('return-date');

        if (!toggleGroup) return;

        if (currentCategory === 'outstation') {
            toggleGroup.style.display = 'block';
            const isRound = toggle && toggle.checked;
            if (slider) slider.style.background = isRound ? 'var(--cr-primary,#b71c1c)' : 'rgba(200,200,200,0.25)';
            if (knob) knob.style.transform = isRound ? 'translateX(22px)' : 'translateX(0)';
            if (sub) sub.textContent = isRound ? 'Round-trip outstation fare' : 'One-way outstation fare';
            if (returnRow) returnRow.style.display = isRound ? 'block' : 'none';
            if (ret && isRound && !ret.value) {
                const today = new Date().toISOString().split('T')[0];
                ret.setAttribute('min', today);
                ret.value = today;
            }
            currentTripType = isRound ? 'round' : 'oneway';
        } else {
            toggleGroup.style.display = 'none';
            currentTripType = 'oneway';
        }
    }

    const roundTripToggle = document.getElementById('round-trip-toggle');
    if (roundTripToggle) {
        roundTripToggle.addEventListener('change', () => {
            updateRoundTripToggleUI();
            calculateFare();
        });
    }
    const returnDateNew = document.getElementById('return-date');
    if (returnDateNew) returnDateNew.addEventListener('change', calculateFare);



    if (rentalPackageSelect) {
        rentalPackageSelect.addEventListener('change', calculateFare);
    }
    if (returnDate) {
        returnDate.addEventListener('change', calculateFare);
    }

    // Mobile Burger Logic
    const burgerToggle = document.getElementById('burger-toggle');
    const navLinksList = document.querySelector('.nav-links');

    if (burgerToggle && navLinksList) {
        burgerToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            burgerToggle.classList.toggle('active');
            navLinksList.classList.toggle('active');
        });

        // Close menu when clicking a link
        navLinksList.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                burgerToggle.classList.remove('active');
                navLinksList.classList.remove('active');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navLinksList.contains(e.target) && !burgerToggle.contains(e.target)) {
                burgerToggle.classList.remove('active');
                navLinksList.classList.remove('active');
            }
        });
    }

    // 3. Passenger Count Change Logic
    if (passengerInput) {
        passengerInput.addEventListener('change', () => {
            calculateFare(); // Refresh vehicle tiles and prices when capacity changes
        });
    }

    if (addDropBtn) {
        addDropBtn.addEventListener('click', () => {
            if (extraDropCount >= 3) {
                alert('Max 3 extra stops allowed.');
                return;
            }
            extraDropCount++;
            const dropId = `extra-drop-${extraDropCount}`;
            const suggestionId = `extra-drop-suggestions-${extraDropCount}`;
            
            const row = document.createElement('div');
            row.className = 'bk-input-group bk-full extra-drop-row';
            row.id = `extra-drop-row-${extraDropCount}`;
            row.style.position = 'relative';
            row.style.animation = 'fadeIn 0.3s ease';
            
            row.innerHTML = `
                <div class="timeline-dot" style="background: var(--cr-primary); border: 2px solid var(--cr-primary); width: 10px; height: 10px; border-radius: 50%; position: absolute; left: 4px; top: 12px; z-index: 2;"></div>
                <div class="timeline-row" style="margin-left: 24px; padding-bottom: 16px; position: relative;">
                    <div class="timeline-label" style="font-size: 0.8rem; font-weight: 600; color: var(--cr-muted); margin-bottom: 6px; display: flex; justify-content: space-between;">
                        <span>Stop #${extraDropCount}</span>
                        <span style="color: var(--cr-primary); cursor: pointer;" onclick="openMapPicker('${dropId}', event)">Map</span>
                    </div>
                    <div class="timeline-field" style="display: flex; align-items: center; gap: 8px; background: var(--cr-bg); border-radius: 8px;">
                        <input type="text" id="${dropId}" placeholder="Enter stop address" required autocomplete="off" style="flex: 1; border: none; background: transparent; padding: 10px; font-size: 0.95rem; outline: none; width: 100%;">
                        <span style="color: #ff5252; cursor: pointer; padding: 10px;" onclick="removeExtraDrop(${extraDropCount})">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                        </span>
                    </div>
                    <div id="${suggestionId}" style="position:absolute; background:white; width:100%; z-index:100; border-radius:8px; box-shadow:var(--cr-shadow-md); display:none; max-height:150px; overflow-y:auto; margin-top:4px; font-size:0.9rem;"></div>
                </div>
            `;
            
            extraDropsContainer.appendChild(row);
            setupAutocomplete(dropId, suggestionId);
            
            const input = document.getElementById(dropId);
            input.addEventListener('blur', () => {
                setTimeout(calculateFare, 250);
            });
            
            calculateFare();
        });
    }

    window.removeExtraDrop = function(id) {
        const row = document.getElementById(`extra-drop-row-${id}`);
        if (row) {
            row.remove();
            reindexExtraDrops();
            calculateFare();
        }
    };

    function reindexExtraDrops() {
        const rows = extraDropsContainer.querySelectorAll('.extra-drop-row');
        extraDropCount = 0;
        rows.forEach((row) => {
            extraDropCount++;
            row.id = `extra-drop-row-${extraDropCount}`;
            const label = row.querySelector('label');
            if (label) label.textContent = `Stop #${extraDropCount}`;
            
            const mapBtn = row.querySelector('.loc-actions span:nth-child(1)');
            if (mapBtn) {
                mapBtn.setAttribute('onclick', `openMapPicker('extra-drop-${extraDropCount}', event)`);
            }
            
            const removeBtn = row.querySelector('.loc-actions span:nth-child(2)');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', `removeExtraDrop(${extraDropCount})`);
            }
            
            const input = row.querySelector('input');
            const newId = `extra-drop-${extraDropCount}`;
            input.id = newId;
            
            const suggestion = row.querySelector('.bk-suggestions');
            const newSuggestionId = `extra-drop-suggestions-${extraDropCount}`;
            suggestion.id = newSuggestionId;
            
            setupAutocomplete(newId, newSuggestionId);
        });
    }

    // --- Dynamic Tariff Storage ---
    let pricing = null;
    let peakRules = [];
    let specialLocationCharges = []; // [{id, place_type, display_name, surcharge_percentage, is_active}]
    let activeCommissionConfig = null;

    async function fetchTariffs() {
        try {
            // Fetch Standard Tariffs, Peak Rules, Special Location Charges, and Commission Config in parallel
            const [res, peakRes, spRes, commRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/tariffs`),
                fetch(`${API_BASE_URL}/api/peak-rules`),
                fetch(`${API_BASE_URL}/api/special-location-charges`),
                fetch(`${API_BASE_URL}/api/commissions/active`)
            ]);
            const data = await res.json();
            peakRules = await peakRes.json();
            const spData = await spRes.json();
            activeCommissionConfig = await commRes.json();
            specialLocationCharges = Array.isArray(spData) ? spData.filter(c => c.is_active) : [];
            console.log('⚡ Dynamic Peak Rules Active:', peakRules);
            console.log('🏗️ Special Location Charges Loaded:', specialLocationCharges.length, 'active');
            populateSpecialPlaceDropdown();

            // Transform array into nested object structure expected by renderVehicleOptions
            const transformed = Object.create(null);
            data.forEach(t => {
                if (allowedVehicleTypes.includes(t.vehicle_type)) {
                    if (!getTransformedType(transformed, t.vehicle_type)) {
                        // Initialize with display properties (these could also be moved to DB eventually)
                        const displayInfo = {
                            bike: { name: 'Classy Bike Taxi', capacity: '1 Seater', maxPassengers: 1 },
                            auto: { name: 'Auto', capacity: '3+1 Seater', maxPassengers: 3 },
                            hatchback: { name: 'Hatchback', capacity: '4+1 Seater', maxPassengers: 4 },
                            sedan: { name: 'Sedan', capacity: '4+1 Seater', maxPassengers: 4 },
                            suv: { name: 'SUV', capacity: '6+1 Seater', maxPassengers: 6 },
                            '8plus1': { name: 'Tempo Traveller', capacity: '8+1 Seater', maxPassengers: 8 },
                            van24: { name: 'Omni Bus', capacity: '24+1 Seater', maxPassengers: 24 }
                        };
                        setTransformedType(transformed, t.vehicle_type, { ...getTransformedType(displayInfo, t.vehicle_type) });
                    }
                    if (t.category !== '__proto__' && t.category !== 'constructor') {
                        const targetObj = getTransformedType(transformed, t.vehicle_type);
                        if (targetObj) {
                            // Safely map category pricing
                            const val = typeof t.config === 'string' ? JSON.parse(t.config) : t.config;
                            if (t.category === 'local') targetObj.local = val;
                            else if (t.category === 'oneway') targetObj.oneway = val;
                            else if (t.category === 'round') targetObj.round = val;
                            else if (t.category === 'rental') targetObj.rental = val;
                        }
                    }
                }
            });
            pricing = transformed;
            console.log('✅ Tariffs synchronized with Mainframe.');
        } catch (err) {
            console.error('Tariff fetch failed, using emergency fallback.', err);
            specialLocationCharges = [];
            populateSpecialPlaceDropdown();
            // Fallback to hardcoded values if API fails
            pricing = {
                bike: {
                    name: 'Classy Bike Taxi', capacity: '1 Seater', maxPassengers: 1,
                    local: { base: 0, perKm: 10, minKm: 5 },
                    oneway: { base: 0, perKm: 10, minKm: 5, convenience: 0 }
                },
                auto: {
                    name: 'Auto', capacity: '3+1 Seater', maxPassengers: 3,
                    local: { base: 60, perKm: 12, minKm: 0 },
                    oneway: { base: 0, perKm: 9, minKm: 50 },
                    round: { base: 0, perKm: 8, minKmPerDay: 100 },
                    rental: { '2-20': { base: 200, extraKm: 10, extraHour: 80 }, '4-40': { base: 380, extraKm: 10, extraHour: 80 }, '8-80': { base: 700, extraKm: 9, extraHour: 70 }, '12-120': { base: 1000, extraKm: 9, extraHour: 70 } }
                },
                hatchback: {
                    name: 'Hatchback', capacity: '4+1 Seater', maxPassengers: 4,
                    local: { base: 150, perKm: 20, minKm: 0 },
                    oneway: { base: 0, perKm: 11, minKm: 100 },
                    round: { base: 0, perKm: 10, minKmPerDay: 200 },
                    rental: { '2-20': { base: 450, extraKm: 15, extraHour: 120 }, '4-40': { base: 850, extraKm: 15, extraHour: 120 }, '8-80': { base: 1600, extraKm: 14, extraHour: 100 }, '12-120': { base: 2200, extraKm: 13, extraHour: 100 } }
                },
                sedan: {
                    name: 'Sedan', capacity: '4+1 Seater', maxPassengers: 4,
                    local: { base: 200, perKm: 25, minKm: 0 },
                    oneway: { base: 0, perKm: 13, minKm: 130 },
                    round: { base: 0, perKm: 12, minKmPerDay: 250 },
                    rental: { '2-20': { base: 600, extraKm: 18, extraHour: 150 }, '4-40': { base: 1100, extraKm: 18, extraHour: 150 }, '8-80': { base: 2100, extraKm: 16, extraHour: 120 }, '12-120': { base: 2800, extraKm: 15, extraHour: 120 } }
                },
                suv: {
                    name: 'SUV', capacity: '6+1 Seater', maxPassengers: 6,
                    local: { base: 300, perKm: 35, minKm: 0 },
                    oneway: { base: 0, perKm: 19, minKm: 130 },
                    round: { base: 0, perKm: 18, minKmPerDay: 250 },
                    rental: { '2-20': { base: 900, extraKm: 25, extraHour: 250 }, '4-40': { base: 1600, extraKm: 25, extraHour: 250 }, '8-80': { base: 3100, extraKm: 22, extraHour: 200 }, '12-120': { base: 4200, extraKm: 20, extraHour: 200 } }
                },
                '8plus1': {
                    name: 'Tempo Traveller', capacity: '8+1 Seater', maxPassengers: 8,
                    local: { base: 600, perKm: 32, minKm: 0 },
                    oneway: { base: 0, perKm: 22, minKm: 150 },
                    round: { base: 0, perKm: 20, minKmPerDay: 250 },
                    rental: { '2-20': { base: 1800, extraKm: 30, extraHour: 300 }, '4-40': { base: 3200, extraKm: 30, extraHour: 300 }, '8-80': { base: 6000, extraKm: 28, extraHour: 250 }, '12-120': { base: 8500, extraKm: 25, extraHour: 250 } }
                },
                van24: {
                    name: 'Omni Bus', capacity: '24+1 Seater', maxPassengers: 24,
                    local: { base: 1500, perKm: 55, minKm: 0 },
                    oneway: { base: 0, perKm: 42, minKm: 200 },
                    round: { base: 0, perKm: 38, minKmPerDay: 300 },
                    rental: { '2-20': { base: 4000, extraKm: 50, extraHour: 500 }, '4-40': { base: 7000, extraKm: 50, extraHour: 500 }, '8-80': { base: 13000, extraKm: 45, extraHour: 450 }, '12-120': { base: 18000, extraKm: 40, extraHour: 400 } }
                }
            };
        }
    }

    // Initial Fetch
    fetchTariffs();

    // --- Special Location Dropdown Population ---
    function populateSpecialPlaceDropdown() {
        const sel = document.getElementById('special-place-type');
        if (!sel) return;
        // Preserve current value
        const currentVal = sel.value;
        // Keep the "None" option only
        sel.innerHTML = '<option value="">None (No special surcharge)</option>';
        specialLocationCharges.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.place_type;
            opt.textContent = `${c.display_name} (+${parseFloat(c.surcharge_percentage).toFixed(0)}%)`;
            sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
    }

    function getSelectedSpecialCharge() {
        const sel = document.getElementById('special-place-type');
        if (!sel || !sel.value) return { placeType: null, surchargePercent: 0, displayName: null };
        const found = specialLocationCharges.find(c => c.place_type === sel.value);
        if (!found) return { placeType: null, surchargePercent: 0, displayName: null };
        return {
            placeType: found.place_type,
            surchargePercent: parseFloat(found.surcharge_percentage) || 0,
            displayName: found.display_name
        };
    }

    // Wire special place dropdown to recalculate fare
    const specialPlaceSel = document.getElementById('special-place-type');
    if (specialPlaceSel) {
        specialPlaceSel.addEventListener('change', calculateFare);
    }

    // 4. Fare Calculation Logic - ZERO KEY SOLUTION (OSRM)
    async function calculateFare() {

        // Check if user is logged in
        const user = JSON.parse(localStorage.getItem('cityride_member'));
        if (!user) {
            if (fareEstimate) fareEstimate.classList.add('hidden');
            return;
        }

        // Retrieve coordinates stored in datasets by the autocomplete
        const pickupCoords = document.getElementById('pickup').dataset.coords;
        const dropCoords = document.getElementById('drop').dataset.coords;

        const extraDropRows = extraDropsContainer ? extraDropsContainer.querySelectorAll('.extra-drop-row') : [];
        const extraDropsArray = [];
        const extraDropsCoordsArray = [];
        extraDropRows.forEach(row => {
            const input = row.querySelector('input');
            if (input && input.value && input.dataset.coords) {
                extraDropsArray.push({
                    address: input.value,
                    coords: input.dataset.coords
                });
                extraDropsCoordsArray.push(input.dataset.coords);
            }
        });

        if (pickupCoords && dropCoords) {
            try {
                // OSRM via Proxy
                let url = `${API_BASE_URL}/api/proxy/route?pickup=${pickupCoords}&drop=${dropCoords}`;
                if (extraDropsCoordsArray.length > 0) {
                    url += `&extraDrops=${extraDropsCoordsArray.join(';')}`;
                }
                const response = await fetch(url);
                const data = await response.json();

                if (data.routes && data.routes.length > 0) {
                    const distanceInKm = Math.ceil(data.routes[0].distance / 1000);
                    
                    if (currentCategory !== 'rental') {
                        currentCategory = distanceInKm > 50 ? 'outstation' : 'local';
                    }
                    // Update round-trip toggle visibility
                    if (typeof updateRoundTripToggleUI === 'function') updateRoundTripToggleUI();

                    // GLOBAL RULE: Estimated Duration = Distance × 2 minutes (overrides OSRM time)
                    const durationInMins = distanceInKm * 2;
                    renderVehicleOptions(distanceInKm, durationInMins);
                    if (window.drawRouteOnMap) window.drawRouteOnMap(data.routes[0], pickupCoords, extraDropsCoordsArray, dropCoords);
                }
            } catch (err) {
                console.error('Distance calculation error:', err);
                // Do NOT render with hardcoded fallback — clear and show error
                document.getElementById('vehicle-cards-grid') && (document.getElementById('vehicle-cards-grid').innerHTML = '<div style="padding:2rem; text-align:center; color:#888;">Could not calculate route. Please re-select your locations.</div>');
            }
        } else if (currentCategory === 'rental' && pickupCoords) {
            // Rentals don't strictly need a destination for the base package price
            renderVehicleOptions(0, 0);
            if (window.drawRouteOnMap) window.drawRouteOnMap(null, pickupCoords, [], null);
        } else {
            document.getElementById('vehicle-selection-container').innerHTML = '';
            fareEstimate.classList.add('hidden');
        }
    }

    // State for selected vehicle in modal
    let selectedVehicleData = null;

    // Open the vehicle selection modal
    function openVehicleModal() {
        const overlay = document.getElementById('vehicle-modal-overlay');
        if (!overlay) return;
        overlay.classList.add('open');

        // Update route text in modal header
        const pickupText = document.getElementById('vm-pickup-text');
        const dropText = document.getElementById('vm-drop-text');
        const pickupInput = document.getElementById('pickup');
        const dropInput = document.getElementById('drop');
        
        let pickupStr = 'Current Location';
        if (pickupInput && pickupInput.value) {
            pickupStr = pickupInput.value;
        } else if (pickupInput && pickupInput.dataset.coords) {
            pickupStr = `Location: ${pickupInput.dataset.coords}`;
        }
        
        let dropStr = 'Destination';
        if (dropInput && dropInput.value) {
            dropStr = dropInput.value;
        } else if (dropInput && dropInput.dataset.coords) {
            dropStr = `Location: ${dropInput.dataset.coords}`;
        }

        if (pickupText) pickupText.textContent = pickupStr;
        if (dropText) dropText.textContent = currentCategory === 'rental' ? 'Rental — No Drop Required' : dropStr;

        // Update summary bar
        const vmDist = document.getElementById('vm-distance');
        const vmDur = document.getElementById('vm-duration');
        const vmPass = document.getElementById('vm-passengers');
        if (vmDist && lastCalculatedDistance) vmDist.textContent = `${lastCalculatedDistance} KM`;
        if (vmDur && lastCalculatedDuration) {
            const m = lastCalculatedDuration;
            vmDur.textContent = m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m} min`;
        }
        if (vmPass) vmPass.textContent = `${parseInt(passengerInput.value) || 1} Person(s)`;
    }

    // Called when user clicks "Select Vehicle" in modal
    window.confirmVehicleSelection = function() {
        if (!selectedVehicleData) return;
        const overlay = document.getElementById('vehicle-modal-overlay');
        if (overlay) overlay.classList.remove('open');

        // Update hidden fields for booking
        vehicleSelect.value = selectedVehicleData.vType;
        currentTripType = selectedVehicleData.tripType;
        fareVal.textContent = `₹${selectedVehicleData.fare} (Approx.)`;
        distanceVal.textContent = selectedVehicleData.displayDistance;
        window.selectedDuration = selectedVehicleData.durationText;

        // Show fare strip
        const strip = document.getElementById('fare-strip');
        const fsDistance = document.getElementById('fs-distance');
        const fsDuration = document.getElementById('fs-duration');
        const fsFare = document.getElementById('fs-fare');
        if (fsDistance) fsDistance.textContent = `${selectedVehicleData.distanceKm} KM`;
        if (fsDuration) fsDuration.textContent = selectedVehicleData.durationText || '—';
        if (fsFare) fsFare.textContent = `₹${selectedVehicleData.fare}`;
        if (strip) strip.classList.add('visible');

        // Show/hide return date for round trips
        if (selectedVehicleData.tripType === 'round') {
            returnDateGroup.style.display = 'flex';
        } else {
            returnDateGroup.style.display = 'none';
        }

        // Store fare breakdown data
        window._lastFareBreakdown = selectedVehicleData.breakdown;
    };

    // Open fare breakdown popup
    window.openFareBreakdown = function() {
        const overlay = document.getElementById('fare-modal-overlay');
        const body = document.getElementById('fare-modal-body');
        if (!overlay || !body) return;

        const bd = window._lastFareBreakdown || {};
        const pickup = document.getElementById('pickup').value || '—';
        const drop = document.getElementById('drop').value || '—';

        // Set safe static template structure
        body.innerHTML = `
            <div class="fm-row"><span class="fm-label">📍 Pickup</span><span class="fm-value" id="fb-pickup" style="max-width:180px;text-align:right;font-size:0.8rem;"></span></div>
            <div class="fm-row"><span class="fm-label">🏁 Destination</span><span class="fm-value" id="fb-drop" style="max-width:180px;text-align:right;font-size:0.8rem;"></span></div>
            <div class="fm-row"><span class="fm-label">🛣 Distance</span><span class="fm-value" id="fb-distance"></span></div>
            <div class="fm-row"><span class="fm-label">⏱ Est. Duration</span><span class="fm-value" id="fb-duration"></span></div>
            <div class="fm-row"><span class="fm-label">🚗 Vehicle</span><span class="fm-value" id="fb-vehicle"></span></div>
            <div class="fm-row"><span class="fm-label">💰 Rate / KM</span><span class="fm-value" id="fb-rate"></span></div>
            <div id="fb-base-row"></div>
            <div id="fb-allowance-row"></div>
            <div id="fb-peak-row"></div>
            <div class="fm-row"><span class="fm-label">📊 Platform Fee</span><span class="fm-value" id="fb-platform-fee"></span></div>
            <div class="fm-total-row">
                <span class="fm-total-label">Estimated Total</span>
                <span class="fm-total-value" id="fb-total"></span>
            </div>
            <p class="fm-note">ℹ️ Actual fare may vary based on route, waiting time, peak hours & tolls.</p>
        `;

        // Update elements using textContent to prevent XSS warnings
        document.getElementById('fb-pickup').textContent = pickup;
        document.getElementById('fb-drop').textContent = drop;
        document.getElementById('fb-distance').textContent = `${bd.distanceKm || lastCalculatedDistance || 0} KM`;
        document.getElementById('fb-duration').textContent = bd.durationText || window.selectedDuration || '—';
        document.getElementById('fb-vehicle').textContent = bd.vehicleName || '—';
        document.getElementById('fb-rate').textContent = `₹${bd.perKm || '—'}`;
        document.getElementById('fb-platform-fee').textContent = `₹${bd.gst || 0}`;
        document.getElementById('fb-total').textContent = `₹${bd.total || 0}`;

        const baseRow = document.getElementById('fb-base-row');
        if (bd.baseFare) {
            baseRow.className = 'fm-row';
            baseRow.innerHTML = `<span class="fm-label">🏠 Base Fare</span><span class="fm-value" id="fb-base-val"></span>`;
            document.getElementById('fb-base-val').textContent = `₹${bd.baseFare}`;
        } else {
            baseRow.innerHTML = '';
        }

        const allowanceRow = document.getElementById('fb-allowance-row');
        if (bd.driverAllowance) {
            allowanceRow.className = 'fm-row';
            allowanceRow.innerHTML = `<span class="fm-label">👨‍🚕 Driver Betta</span><span class="fm-value" id="fb-allowance-val"></span>`;
            document.getElementById('fb-allowance-val').textContent = `₹${bd.driverAllowance}`;
        } else {
            allowanceRow.innerHTML = '';
        }

        const peakRow = document.getElementById('fb-peak-row');
        if (bd.peakCharge) {
            peakRow.className = 'fm-row';
            peakRow.innerHTML = `<span class="fm-label">⚡ Peak Surcharge</span><span class="fm-value" style="color:#ff9f0a;" id="fb-peak-val"></span>`;
            document.getElementById('fb-peak-val').textContent = `₹${bd.peakCharge}`;
        } else {
            peakRow.innerHTML = '';
        }

        const extraStopsRow = document.getElementById('fb-extra-stops-row') || document.createElement('div');
        extraStopsRow.id = 'fb-extra-stops-row';
        if (bd.extraDropsCharge) {
            extraStopsRow.className = 'fm-row';
            extraStopsRow.innerHTML = `<span class="fm-label">🛑 Extra Stops (${bd.extraDropsCount})</span><span class="fm-value" id="fb-extra-stops-val"></span>`;
            peakRow.parentNode.insertBefore(extraStopsRow, peakRow.nextSibling);
            document.getElementById('fb-extra-stops-val').textContent = `₹${bd.extraDropsCharge}`;
        } else {
            extraStopsRow.innerHTML = '';
            extraStopsRow.className = '';
        }

        // Special location charge row
        const specialRow = document.getElementById('fb-special-row') || document.createElement('div');
        specialRow.id = 'fb-special-row';
        if (bd.specialLocationCharge && bd.specialLocationCharge > 0) {
            specialRow.className = 'fm-row';
            specialRow.innerHTML = `<span class="fm-label">🏛️ ${bd.specialLocationName || 'Special Location'} (+${(bd.specialSurchargePct || 0).toFixed(0)}%)</span><span class="fm-value" style="color:#6c63ff;" id="fb-special-val"></span>`;
            const insertAfter = extraStopsRow.parentNode ? extraStopsRow : peakRow;
            insertAfter.parentNode.insertBefore(specialRow, insertAfter.nextSibling);
            document.getElementById('fb-special-val').textContent = `₹${bd.specialLocationCharge}`;
        } else {
            specialRow.innerHTML = '';
            specialRow.className = '';
        }

        overlay.classList.add('open');
    };

    // Open booking confirm modal (replaces old openBookingModal)
    window.openConfirmModal = function() {
        if (!selectedVehicleData) {
            alert('Please select a vehicle first.');
            return;
        }
        const user = JSON.parse(localStorage.getItem('cityride_member'));
        if (!user) {
            alert('Please login to confirm booking.');
            window.location.href = 'auth.html';
            return;
        }

        // Build pendingBookingData
        let bookingDate = document.getElementById('pickup-date').value;
        let bookingTime = document.getElementById('pickup-time').value;
        if (document.getElementById('booking-type') && document.getElementById('booking-type').value === 'now') {
            const now = new Date();
            bookingDate = now.toISOString().split('T')[0];
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            bookingTime = `${hours}:${minutes}`;
        }
        const extraDropRows = extraDropsContainer ? extraDropsContainer.querySelectorAll('.extra-drop-row') : [];
        const extraDropsArray = [];
        extraDropRows.forEach(row => {
            const input = row.querySelector('input');
            if (input && input.value && input.dataset.coords) {
                extraDropsArray.push({
                    address: input.value,
                    coords: input.dataset.coords
                });
            }
        });

        pendingBookingData = {
            userId: user.id,
            pickup: document.getElementById('pickup').value,
            pickupCoords: document.getElementById('pickup').dataset.coords,
            drop: document.getElementById('drop').value,
            dropCoords: document.getElementById('drop').dataset.coords,
            extraDrops: extraDropsArray.length > 0 ? extraDropsArray : null,
            date: bookingDate,
            time: bookingTime,
            passengers: parseInt(passengerInput.value) || 1,
            vehicle: selectedVehicleData.vType,
            tripType: selectedVehicleData.tripType,
            returnDate: selectedVehicleData.tripType === 'round' ? document.getElementById('return-date').value : null,
            rentalPackage: selectedVehicleData.tripType === 'rental' ? document.getElementById('rental-package').value : null,
            fare: `₹${selectedVehicleData.fare}`,
            distance: `${selectedVehicleData.distanceKm} KM`,
            estimatedDuration: window.selectedDuration || null,
            specialPlaceType: selectedVehicleData.specialPlaceType || null

        };

        const fareNum = selectedVehicleData.fare || 0;
        if (fareNum <= 0) {
            alert('⚠️ Fare Calculation Error. Please re-select vehicle.');
            return;
        }
        // Populate confirm modal
        const grid = document.getElementById('cm-summary-grid');
        if (grid) {
            let stopsHtml = '';
            if (pendingBookingData.extraDrops && pendingBookingData.extraDrops.length > 0) {
                pendingBookingData.extraDrops.forEach((stop, idx) => {
                    stopsHtml += `<div class="cm-info-row" style="padding-bottom:12px; border-bottom:1px solid var(--cr-border-light);"><div style="display:flex; align-items:center; gap:8px; color:var(--cr-text-muted); font-size:0.9rem; margin-bottom:4px;"><span style="font-size:1.1rem;">🛑</span> Stop #${idx+1}</div><div class="cm-info-value" style="font-size:0.85rem; font-weight:600; color:var(--cr-text-main); line-height:1.4;">${stop.address}</div></div>`;
                });
            }
            grid.innerHTML = `
                <div style="padding-bottom:12px; border-bottom:1px solid var(--cr-border-light);">
                    <div style="display:flex; align-items:center; gap:8px; color:var(--cr-text-muted); font-size:0.9rem; margin-bottom:4px;"><span style="font-size:1.1rem;">📍</span> Pickup</div>
                    <div id="cm-pickup" style="font-size:0.85rem; font-weight:600; color:var(--cr-text-main); line-height:1.4;">${pendingBookingData.pickup}</div>
                </div>
                ${stopsHtml}
                <div style="padding-bottom:12px; border-bottom:1px solid var(--cr-border-light);">
                    <div style="display:flex; align-items:center; gap:8px; color:var(--cr-text-muted); font-size:0.9rem; margin-bottom:4px;"><span style="font-size:1.1rem;">🏁</span> Destination</div>
                    <div id="cm-drop" style="font-size:0.85rem; font-weight:600; color:var(--cr-text-main); line-height:1.4;">${pendingBookingData.drop || 'Rental — No fixed drop'}</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid var(--cr-border-light);">
                    <div style="display:flex; align-items:center; gap:8px; color:var(--cr-text-muted); font-size:0.9rem;"><span style="font-size:1.1rem;">🚗</span> Vehicle</div>
                    <div id="cm-vehicle" style="text-align:right; font-size:0.85rem; font-weight:600; color:var(--cr-text-main);">${selectedVehicleData.vehicleName} (${selectedVehicleData.tripType.toUpperCase()})</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid var(--cr-border-light);">
                    <div style="display:flex; align-items:center; gap:8px; color:var(--cr-text-muted); font-size:0.9rem;"><span style="font-size:1.1rem;">🛣️</span> Distance</div>
                    <div id="cm-distance" style="text-align:right; font-size:0.85rem; font-weight:600; color:var(--cr-text-main);">${selectedVehicleData.distanceKm} KM</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid var(--cr-border-light);">
                    <div style="display:flex; align-items:center; gap:8px; color:var(--cr-text-muted); font-size:0.9rem;"><span style="font-size:1.1rem;">⏱️</span> Est. Duration</div>
                    <div id="cm-duration" style="text-align:right; font-size:0.85rem; font-weight:600; color:var(--cr-text-main);">${window.selectedDuration || '—'}</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid var(--cr-border-light);">
                    <div style="display:flex; align-items:center; gap:8px; color:var(--cr-text-muted); font-size:0.9rem;"><span style="font-size:1.1rem;">💰</span> Estimated Fare</div>
                    <div id="cm-fare" style="text-align:right; font-size:1.1rem; font-weight:800; color:var(--cr-primary);">₹${selectedVehicleData.fare}</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid var(--cr-border-light);">
                    <div style="display:flex; align-items:center; gap:8px; color:var(--cr-text-muted); font-size:0.9rem;"><span style="font-size:1.1rem;">💺</span> Seats Required</div>
                    <div id="cm-passengers" style="text-align:right; font-size:0.85rem; font-weight:600; color:var(--cr-text-main);">${pendingBookingData.passengers} Passengers</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px; color:var(--cr-text-muted); font-size:0.9rem;"><span style="font-size:1.1rem;">📅</span> Date &amp; Time</div>
                    <div id="cm-datetime" style="text-align:right; font-size:0.85rem; font-weight:600; color:var(--cr-text-main);">${bookingDate} at ${bookingTime || 'Now'}</div>
                </div>
            `;
        }
        document.getElementById('confirm-modal-overlay').classList.add('open');
    };

    let lastCalculatedDistance = 0;
    let lastCalculatedDuration = 0;

    function calculateLocalSlabFare(dist, config) {
        const baseFare = (config && config.base !== undefined) ? parseFloat(config.base) : 0;
        if (config && config.perKm !== undefined && config.slab1_rate === undefined) {
            const distanceFare = dist * config.perKm;
            return Math.max(baseFare, distanceFare);
        }

        let fare = baseFare;
        let d = dist;
        const r11 = (config && config.slab11_rate !== undefined) ? config.slab11_rate : 13;
        const r10 = (config && config.slab10_rate !== undefined) ? config.slab10_rate : 14;
        const r9 = (config && config.slab9_rate !== undefined) ? config.slab9_rate : 15;
        const r8 = (config && config.slab8_rate !== undefined) ? config.slab8_rate : 16;
        const r7 = (config && config.slab7_rate !== undefined) ? config.slab7_rate : 17;
        const r6 = (config && config.slab6_rate !== undefined) ? config.slab6_rate : 18;
        const r5 = (config && config.slab5_rate !== undefined) ? config.slab5_rate : 19;
        const r4 = (config && config.slab4_rate !== undefined) ? config.slab4_rate : 24;
        const r3 = (config && config.slab3_rate !== undefined) ? config.slab3_rate : 26;
        const r2 = (config && config.slab2_rate !== undefined) ? config.slab2_rate : 28;
        const r1 = (config && config.slab1_rate !== undefined) ? config.slab1_rate : 30;

        if (d > 90) { fare += (d - 90) * r11; d = 90; }
        if (d > 80) { fare += (d - 80) * r10; d = 80; }
        if (d > 70) { fare += (d - 70) * r9; d = 70; }
        if (d > 60) { fare += (d - 60) * r8; d = 60; }
        if (d > 50) { fare += (d - 50) * r7; d = 50; }
        if (d > 40) { fare += (d - 40) * r6; d = 40; }
        if (d > 30) { fare += (d - 30) * r5; d = 30; }
        if (d > 20) { fare += (d - 20) * r4; d = 20; }
        if (d > 10) { fare += (d - 10) * r3; d = 10; }
        if (d > 5) { fare += (d - 5) * r2; d = 5; }
        if (d > 0) { fare += d * r1; }
        return Math.round(fare); // rounding to nearest whole number to ensure clean fare amounts
    }

    function renderVehicleOptions(distance, duration = 0) {
        lastCalculatedDistance = distance;
        lastCalculatedDuration = duration;

        const passengers = parseInt(passengerInput.value) || 1;
        // Keep inline container cleared (SPA uses modal now)
        const container = document.getElementById('vehicle-selection-container');
        if (container) container.innerHTML = '';
        const grid = document.getElementById('vehicle-cards-grid');
        if (!grid) { return; }

        // Calculate Days for Round Trip
        const start = new Date(pickupDate.value);
        const end = new Date(returnDate.value);
        let tripDays = 1;
        if (end > start) {
            const diffTime = Math.abs(end - start);
            tripDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        if (!pricing) {
            grid.innerHTML = '<div style="padding: 2rem; text-align: center; color: #888;">Synchronizing Tariffs...</div>';
            return;
        }

        grid.innerHTML = ''; // Clear previous cards
        selectedVehicleData = null;
        const vmSelectBtn = document.getElementById('vm-select-btn');
        if (vmSelectBtn) vmSelectBtn.disabled = true;

        if (distance > 0 && currentCategory !== 'rental') {
            const distInfo = document.createElement('div');
            distInfo.style.textAlign = 'center';
            distInfo.style.marginBottom = '1.5rem';
            distInfo.style.padding = '12px';
            distInfo.style.background = 'rgba(183, 28, 28, 0.05)';
            distInfo.style.borderRadius = '12px';
            distInfo.style.border = '1px solid rgba(183, 28, 28, 0.1)';
            
            const durText = duration > 60 ? `${Math.floor(duration/60)}h ${duration%60}m` : `${duration}m`;
            distInfo.innerHTML = `
                <div style="font-weight:800; font-size:1.2rem; color:var(--primary-red); margin-bottom: 4px;">
                    🏁 Total Distance: <span id="di-dist"></span> KM
                </div>
                <div style="font-size:0.9rem; font-weight:600; color:var(--text-main);">
                    ⏱️ Estimated Travel Time: <span id="di-dur"></span>
                </div>
            `;
            distInfo.querySelector('#di-dist').textContent = distance;
            distInfo.querySelector('#di-dur').textContent = durText;
            container.appendChild(distInfo);
        }

        const allTripTypes = [
            { id: 'local', label: 'Local City Ride', category: 'local' },
            { id: 'oneway', label: 'One-Way Outstation', category: 'outstation' },
            { id: 'round', label: 'Round-Trip Outstation', category: 'outstation' },
            { id: 'rental', label: 'Hourly/KM Rental', category: 'rental' }
        ];

        // For outstation: use only the trip type selected by the round-trip toggle
        const tripTypeFilter = (currentCategory === 'outstation')
            ? (typeof currentTripType !== 'undefined' ? currentTripType : 'oneway')
            : currentCategory;
        const tripTypes = allTripTypes.filter(t => {
            if (currentCategory === 'outstation') return t.id === tripTypeFilter;
            return t.category === currentCategory;
        });

        tripTypes.forEach(tType => {
            // Header for Category
            const header = document.createElement('div');
            header.className = 'list-category-header';
            header.textContent = tType.label;
            container.appendChild(header);
            const vehicleOrder = ['bike', 'auto', 'hatchback', 'sedan', 'suv', '8plus1', 'van24'];
            const sortedVehicleTypes = Object.keys(pricing).sort((a, b) => {
                return vehicleOrder.indexOf(a) - vehicleOrder.indexOf(b);
            });

            sortedVehicleTypes.forEach(vType => {
                if (!allowedVehicleTypes.includes(vType)) return;
                const info = getTransformedType(pricing, vType);
                if (!info) return;

                // Restrict Omni Bus and Tempo Traveller from local rides
                if (tType.id === 'local' && (vType === 'van24' || vType === '8plus1')) return;

                // Restrict Bike and Auto to local rides only
                if (tType.id !== 'local' && (vType === 'bike' || vType === 'auto')) return;

                // Check if vehicle is available for this specific trip type
                if (allowedTripTypes.includes(tType.id) && !getTripPricing(info, tType.id)) return;

                let totalFare = 0;
                let displayDistance = distance;
                let detailLabel = '';

                const getPeakSurcharge = (timeStr) => {
                    if (!timeStr) return 0;
                    const [h, m] = timeStr.split(':').map(Number);
                    const tm = h * 60 + m;

                    let highestSurcharge = 0;
                    peakRules.forEach(rule => {
                        const [sh, sm] = rule.start_time.split(':').map(Number);
                        const [eh, em] = rule.end_time.split(':').map(Number);
                        const stm = sh * 60 + sm;
                        const etm = eh * 60 + em;

                        let inPeak = false;
                        if (stm <= etm) {
                            inPeak = (tm >= stm && tm <= etm);
                        } else {
                            // wraps around midnight (e.g. 22:00 to 06:00)
                            inPeak = (tm >= stm || tm <= etm);
                        }

                        if (inPeak) {
                            const surcharge = parseFloat(rule.surcharge_percentage) / 100;
                            if (surcharge > highestSurcharge) highestSurcharge = surcharge;
                        }
                    });
                    return highestSurcharge;
                };

                let timeForSurcharge = document.getElementById('pickup-time').value;
                if (document.getElementById('booking-type') && document.getElementById('booking-type').value === 'now') {
                    const now = new Date();
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    timeForSurcharge = `${hours}:${minutes}`;
                }

                const peakMult = currentCategory === 'local' ? getPeakSurcharge(timeForSurcharge) : 0;

                // Get selected special location surcharge
                const { placeType: selectedPlaceType, surchargePercent: specialSurchargePct, displayName: specialDisplayName } = getSelectedSpecialCharge();

                // Collect extra drops count
                const extraDropRows = extraDropsContainer ? extraDropsContainer.querySelectorAll('.extra-drop-row') : [];
                const extraDropsCount = Array.from(extraDropRows).filter(row => {
                    const input = row.querySelector('input');
                    return input && input.value && input.dataset.coords;
                }).length;

                let customerFee = 0;
                const getPlatformFee = (baseAmt) => {
                    if (!activeCommissionConfig) return 0;
                    if (activeCommissionConfig.customer_commission_type === 'fixed') {
                        return parseFloat(activeCommissionConfig.customer_commission_fixed) || 0;
                    }
                    return (baseAmt * (parseFloat(activeCommissionConfig.customer_commission_percent) || 0)) / 100;
                };

                if (tType.id === 'local') {
                    const config = info.local;
                    const minKm = typeof config.minKm === 'number' ? config.minKm : 0;
                    const billableDist = Math.max(distance, minKm);
                    const baseKmFare = calculateLocalSlabFare(billableDist, config);
                    const peakCharge = baseKmFare * peakMult;
                    const specialCharge = Math.round(baseKmFare * specialSurchargePct / 100);

                    const extraDropsCharge = extraDropsCount * 50;
                    const baseTotal = baseKmFare + peakCharge + specialCharge + extraDropsCharge;
                    customerFee = getPlatformFee(baseTotal);
                    totalFare = baseTotal + customerFee;

                    displayDistance = `${distance} KM`;
                    detailLabel = customerFee > 0 ? `Incl. ₹${customerFee.toFixed(2)} Platform Fee.` : `Fare Details`;
                    if (extraDropsCount > 0) {
                        detailLabel += ` (+₹${extraDropsCharge} for ${extraDropsCount} stop(s))`;
                    }
                    if (peakMult > 0) detailLabel += ` [Peak Hour +25%]`;
                    if (specialSurchargePct > 0) detailLabel += ` [🏗️ ${specialDisplayName} +${specialSurchargePct.toFixed(0)}%]`;
                    if (distance < minKm) detailLabel += ` [${minKm}KM Min Applied]`;
                } else if (tType.id === 'oneway') {
                    const config = info.oneway;
                    const minKm = config.minKm || 130;
                    const billableDist = Math.max(distance, minKm);
                    const distanceFare = billableDist * config.perKm;
                    const baseFareLimit = config.base || 0;
                    const baseKmFare = Math.max(baseFareLimit, distanceFare);
                    const driverAllowance = 400;
                    const specialCharge = Math.round(baseKmFare * specialSurchargePct / 100);

                    const extraDropsCharge = extraDropsCount * 50;
                    const baseTotal = baseKmFare + (vType === 'bike' ? 0 : driverAllowance) + specialCharge + extraDropsCharge;
                    customerFee = getPlatformFee(baseTotal);
                    totalFare = baseTotal + customerFee;
                    displayDistance = `${distance} KM`;
                    detailLabel = `Incl. Allowance${customerFee > 0 ? ` & ₹${customerFee.toFixed(2)} Platform Fee` : ''}.`;
                    if (extraDropsCount > 0) {
                        detailLabel += ` (+₹${extraDropsCharge} for ${extraDropsCount} stop(s))`;
                    }
                    if (specialSurchargePct > 0) detailLabel += ` [🏗️ ${specialDisplayName} +${specialSurchargePct.toFixed(0)}%]`;
                    if (distance < minKm) detailLabel += ` [${minKm}KM Min Applied]`;
                } else if (tType.id === 'round') {
                    const config = info.round;
                    const minKmForTrip = config.minKmPerDay || 250;
                    const actualTwoWayDist = distance * 2;
                    const billableDist = Math.max(actualTwoWayDist, minKmForTrip * tripDays);
                    const distanceFare = billableDist * config.perKm;
                    const baseFareLimit = config.base || 0;
                    const baseKmFare = Math.max(baseFareLimit, distanceFare);
                    const driverAllowance = 400;
                    const specialCharge = Math.round(baseKmFare * specialSurchargePct / 100);
                    const baseTotal = baseKmFare + (vType === 'bike' ? 0 : driverAllowance * tripDays) + specialCharge;
                    customerFee = getPlatformFee(baseTotal);
                    totalFare = baseTotal + customerFee;
                    displayDistance = `${distance} x 2 (${billableDist} KM Billable)`;
                    detailLabel = `${tripDays} Day(s) • Incl. Allowance${customerFee > 0 ? ` & ₹${customerFee.toFixed(2)} Platform Fee` : ''}.`;
                    if (specialSurchargePct > 0) detailLabel += ` [🏗️ ${specialDisplayName} +${specialSurchargePct.toFixed(0)}%]`;
                    if (actualTwoWayDist < minKmForTrip * tripDays) detailLabel += ` [${minKmForTrip * tripDays}KM Min Applied]`;
                } else if (tType.id === 'rental') {
                    if (!info.rental) return;
                    const packageVal = rentalPackageSelect ? rentalPackageSelect.value : '2-20';
                    const [pMaxHrs, pMaxKm] = packageVal.split('-').map(Number);
                    const config = getRentalConfig(info.rental, packageVal);
                    if (!config) return;
                    const extraKm = Math.max(0, distance - pMaxKm);
                    const baseFare = config.base + (extraKm * config.extraKm);
                    const specialCharge = Math.round(baseFare * specialSurchargePct / 100);
                    const baseTotal = baseFare + specialCharge;
                    customerFee = getPlatformFee(baseTotal);
                    totalFare = baseTotal + customerFee;
                    displayDistance = distance > 0 ? `${distance} KM` : 'Fixed Base';
                    detailLabel = `${pMaxHrs}Hr/${pMaxKm}KM • Extra ₹${config.extraHour}/hr, ₹${config.extraKm}/km${customerFee > 0 ? ` • Incl. ₹${customerFee.toFixed(2)} Platform Fee.` : '.'}`;
                    if (specialSurchargePct > 0) detailLabel += ` [🏗️ ${specialDisplayName} +${specialSurchargePct.toFixed(0)}%]`;
                }

                totalFare = Math.ceil(totalFare);
                const isDisabled = passengers > info.maxPassengers;

                let etaText = 'Choose';
                if (duration > 0) {
                    if (duration >= 60) {
                        const hrs = Math.floor(duration / 60);
                        const mins = duration % 60;
                        etaText = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
                    } else {
                        etaText = `${duration}m`;
                    }
                } else if (tType.id === 'rental') {
                    const packageVal = rentalPackageSelect ? rentalPackageSelect.value : '2-20';
                    const [pMaxHrs] = packageVal.split('-').map(Number);
                    etaText = `${pMaxHrs}h package`;
                }

                const card = document.createElement('div');
                card.className = `vc-card${isDisabled ? ' vc-disabled' : ''}`;
                card.style.opacity = isDisabled ? '0.4' : '1';
                card.style.cursor = isDisabled ? 'not-allowed' : 'pointer';

                const iconDiv = document.createElement('div');
                iconDiv.className = 'vc-icon';
                iconDiv.innerHTML = getVehicleIcon(vType);
                card.appendChild(iconDiv);

                const nameDiv = document.createElement('div');
                nameDiv.className = 'vc-name';
                nameDiv.textContent = info.name;
                if (isDisabled) {
                    const badge = document.createElement('span');
                    badge.className = 'vc-badge';
                    badge.style.background = 'rgba(255,50,50,0.2)';
                    badge.style.color = '#ff5252';
                    badge.style.marginLeft = '8px';
                    badge.style.display = 'inline-block';
                    badge.style.verticalAlign = 'middle';
                    badge.textContent = 'Over Cap';
                    nameDiv.appendChild(badge);
                }
                card.appendChild(nameDiv);

                const fareDiv = document.createElement('div');
                fareDiv.className = 'vc-fare';
                fareDiv.textContent = `₹${totalFare}`;
                card.appendChild(fareDiv);

                if (!isDisabled) {
                    card.addEventListener('click', () => {
                        grid.querySelectorAll('.vc-card').forEach(c => c.classList.remove('selected'));
                        card.classList.add('selected');

                        // Enable the select button
                        const vmBtn = document.getElementById('vm-select-btn');
                        if (vmBtn) { vmBtn.disabled = false; vmBtn.textContent = `Select ${info.name} • ₹${totalFare}`; }

                        // Build breakdown for fare popup
                        const gst = customerFee;
                        const driverAllowanceAmt = (tType.id === 'oneway' || tType.id === 'round') && vType !== 'bike' ? 400 : 0;
                        const extraDropsCharge = tType.id === 'local' ? (extraDropsCount * 50) : (tType.id === 'oneway' ? (extraDropsCount * 50) : 0);

                        // Get correct base fare for peak and special location charges
                        let baseKmFareForSurcharge = 0;
                        if (tType.id === 'local') {
                            const config = info.local;
                            const minKm = typeof config.minKm === 'number' ? config.minKm : 0;
                            const billableDist = Math.max(distance, minKm);
                            baseKmFareForSurcharge = calculateLocalSlabFare(billableDist, config);
                        } else {
                            const tripConfig = getTripPricing(info, tType.id);
                            if (tripConfig) {
                                const minKm = tripConfig.minKm || tripConfig.minKmPerDay || 0;
                                const billableDist = Math.max(distance, minKm);
                                baseKmFareForSurcharge = Math.max(tripConfig.base || 0, billableDist * (tripConfig.perKm || 0));
                            }
                        }

                        const peakSurcharge = tType.id === 'local' ? Math.round(getPeakSurcharge(document.getElementById('pickup-time')?.value) * baseKmFareForSurcharge) : 0;

                        // Compute special location charge for breakdown
                        let specialLocationCharge = 0;
                        if (specialSurchargePct > 0) {
                            specialLocationCharge = Math.round(baseKmFareForSurcharge * specialSurchargePct / 100);
                        }

                        // Store selected vehicle data
                        selectedVehicleData = {
                            vType,
                            vehicleName: info.name,
                            tripType: tType.id,
                            fare: totalFare,
                            distanceKm: distance,
                            displayDistance: displayDistance.toString(),
                            durationText: etaText,
                            specialPlaceType: selectedPlaceType,
                            breakdown: {
                                vehicleName: info.name,
                                distanceKm: distance,
                                durationText: etaText,
                                perKm: tType.id === 'local' ? (info.local?.perKm || 0) : (getTripPricing(info, tType.id)?.perKm || 0),
                                baseFare: getTripPricing(info, tType.id)?.base || 0,
                                driverAllowance: driverAllowanceAmt,
                                peakCharge: peakSurcharge,
                                extraDropsCount,
                                extraDropsCharge,
                                specialLocationCharge,
                                specialLocationName: specialDisplayName,
                                specialSurchargePct,
                                gst,
                                total: totalFare
                            }
                        };
                    });
                }

                grid.appendChild(card);
            });
        });
    }

    // --- ZERO KEY Autocomplete (Photon + Nominatim via server proxy) ---
    function setupAutocomplete(inputId, suggestionBoxId) {
        const input = document.getElementById(inputId);
        const box = document.getElementById(suggestionBoxId);
        let timeout = null;

        input.addEventListener('input', () => {
            clearTimeout(timeout);
            const query = input.value.trim();

            if (query.length < 2) {
                box.innerHTML = '';
                box.style.display = 'none';
                delete input.dataset.coords;
                return;
            }

            timeout = setTimeout(async () => {
                const url = `${API_BASE_URL}/api/proxy/geocode?q=${encodeURIComponent(query)}&limit=8&lang=en`;
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error('API Response Error');
                    const data = await res.json();
                    box.innerHTML = '';

                    if (data.features && data.features.length > 0) {
                        // Show "Did you mean" banner if query was spell-corrected
                        if (data.correctedQuery) {
                            const hint = document.createElement('div');
                            hint.style.cssText = 'padding: 6px 12px; font-size: 11px; color: #9ca3af; background: rgba(245₹58₹1,0.08); border-bottom: 1px solid rgba(255,255,255,0.06); font-style: italic;';
                            hint.innerHTML = `🔤 Showing results for: <strong style="color:#f59e0b">${data.correctedQuery}</strong>`;
                            box.appendChild(hint);
                        }

                        const gridContainer = document.createElement('div');
                        gridContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; padding: 12px;';
                        
                        data.features.forEach(feature => {
                            const p = feature.properties;
                            const c = feature.geometry.coordinates; // [lng, lat]

                            // Build a clean, readable label (includes village, shop, etc.)
                            const parts = [];
                            if (p.name) parts.push(p.name);
                            if (p.road && p.road !== p.name) parts.push(p.road);
                            if (p.village && p.village !== p.name && p.village !== p.suburb) parts.push(p.village);
                            if (p.suburb && p.suburb !== p.name && p.suburb !== p.road && p.suburb !== p.village) parts.push(p.suburb);
                            if (p.city && p.city !== p.village) parts.push(p.city);
                            if (p.state) parts.push(p.state);
                            const label = parts.length > 0 ? parts.join(', ') : (p.display_name || 'Unknown location');

                            const item = document.createElement('div');
                            item.className = 'suggestion-item';
                            item.textContent = label;
                            
                            // Apply grid card styles inline
                            item.style.cssText = 'border: 1px solid var(--cr-border-light, #e5e7eb); border-radius: 8px; padding: 10px 14px; background: #f8fafc; font-size: 0.85rem; line-height: 1.4; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.02); display: flex; align-items: center;';
                            item.onmouseover = () => { item.style.borderColor = 'var(--cr-primary, #B71C1C)'; item.style.background = '#fffafa'; };
                            item.onmouseout = () => { item.style.borderColor = 'var(--cr-border-light, #e5e7eb)'; item.style.background = '#f8fafc'; };

                            item.onclick = () => {
                                input.value = label;
                                input.dataset.coords = `${c[0]},${c[1]}`;
                                box.innerHTML = '';
                                box.style.display = 'none';
                                if (window.updateMapMarkers) window.updateMapMarkers();
                                calculateFare();
                            };
                            gridContainer.appendChild(item);
                        });
                        box.appendChild(gridContainer);
                        box.style.display = 'block';
                    } else {
                        // Show "no results" hint
                        const noResult = document.createElement('div');
                        noResult.style.cssText = 'padding: 10px 14px; font-size: 12px; color: #9ca3af; font-style: italic;';
                        noResult.textContent = `No results found for "${query}". Try a different spelling.`;
                        box.appendChild(noResult);
                        box.style.display = 'block';
                    }
                } catch (e) {
                    console.error('Autocomplete service unavailable', e);
                    box.style.display = 'none';
                }
            }, 350);
        });

        // Hide suggestions on click outside
        document.addEventListener('click', (e) => {
            if (e.target !== input) {
                box.innerHTML = '';
                box.style.display = 'none';
            }
        });
    }

    // --- GOOGLE PLAY LOCATION ACCURACY POPUP DIALOG ---
    window.showGpsTurnOnPopup = function() {
        let modal = document.getElementById('gps-popup-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gps-popup-modal';
            modal.className = 'gps-modal-overlay';
            modal.innerHTML = `
                <div class="gps-modal-card">
                    <h3 class="gps-modal-title">To continue, your device will need to use Location Accuracy</h3>
                    <p class="gps-modal-subtitle">The following settings should be on:</p>
                    
                    <div class="gps-setting-item">
                        <div class="gps-setting-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#21355A" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>
                        <div class="gps-setting-text">
                            <strong>Device location</strong>
                        </div>
                    </div>
                    
                    <div class="gps-setting-item">
                        <div class="gps-setting-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#21355A" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                        </div>
                        <div class="gps-setting-text">
                            <p><strong>Location Accuracy</strong>, which provides more accurate location for apps and services. To do this, Google periodically processes information about device sensors and wireless signals from your device to crowdsource wireless signal locations. These are used without identifying you to improve location accuracy and location-based services and to improve, provide, and maintain Google's services based on Google's and third parties' legitimate interests to serve users' needs.</p>
                        </div>
                    </div>
                    
                    <p class="gps-modal-footer-note">You can change this at any time in location settings. <a href="#" onclick="event.preventDefault(); alert('Please turn on GPS/Location in your device settings.');">Manage settings</a> or <a href="#" onclick="event.preventDefault();">learn more</a></p>
                    
                    <div class="gps-modal-actions">
                        <button type="button" class="gps-btn-secondary" onclick="closeGpsModal()">No thanks</button>
                        <button type="button" class="gps-btn-primary" onclick="retryEnableGps()">Turn on</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
    };

    window.closeGpsModal = function() {
        const modal = document.getElementById('gps-popup-modal');
        if (modal) modal.style.display = 'none';
    };

    window.retryEnableGps = function() {
        window.closeGpsModal();
        window.useLiveLocation(null, false);
    };

    // --- MAP PICKER LOGIC (Leaflet + OSM) ---
    window.useLiveLocation = function(event, silent = false) {
        const btn = document.getElementById('live-loc-btn');
        const pickupInput = document.getElementById('pickup');

        // Animate button
        if (btn) {
            btn.style.animation = 'liveLocPulse 0.8s ease-in-out infinite';
            btn.style.pointerEvents = 'none';
        }

        if (!silent && pickupInput) {
            pickupInput.placeholder = 'Detecting your location...';
            pickupInput.value = '';
        }

        if (!navigator.geolocation) {
            if (btn) { btn.style.animation = ''; btn.style.pointerEvents = ''; }
            if (!silent) window.showGpsTurnOnPopup();
            return;
        }

        // Analyze permissions if available
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                if (result.state === 'denied' && !silent) {
                    if (btn) { btn.style.animation = ''; btn.style.pointerEvents = ''; }
                    if (pickupInput) pickupInput.placeholder = 'Enter pickup address';
                    window.showGpsTurnOnPopup();
                }
            }).catch(() => {});
        }

        const getPositionSuccess = async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const coords = `${lng},${lat}`;

            if (pickupInput) {
                pickupInput.dataset.coords = coords;
                pickupCoords = coords;
            }

            if (window.lmap) {
                window.lmap.setView([lat, lng], 16, { animate: true });
            }

            // Reverse Geocode via Proxy
            try {
                const baseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
                const res = await fetch(`${baseUrl}/api/proxy/reverse?lon=${lng}&lat=${lat}`);
                const data = await res.json();
                if (data.features && data.features.length > 0) {
                    const p = data.features[0].properties;
                    const parts = [p.name, p.road, p.suburb, p.city, p.state].filter(Boolean);
                    const address = parts.length > 0 ? parts.join(', ') : (p.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                    if (pickupInput) {
                        pickupInput.value = address;
                        pickupInput.placeholder = 'Enter pickup address';
                    }
                    if (window.updateMapMarkers) window.updateMapMarkers();
                }
            } catch (e) {
                console.warn('Reverse geocode failed', e);
                if (pickupInput) pickupInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            }

            if (btn) { btn.style.animation = ''; btn.style.pointerEvents = ''; }
            if (typeof calculateFare === 'function') calculateFare();
        };

        const getPositionError = (err) => {
            // Try fallback with low accuracy if high accuracy timed out or failed
            navigator.geolocation.getCurrentPosition(
                getPositionSuccess,
                (fallbackErr) => {
                    if (btn) { btn.style.animation = ''; btn.style.pointerEvents = ''; }
                    if (pickupInput) pickupInput.placeholder = 'Enter pickup address';
                    console.warn('GPS location error:', fallbackErr);
                    if (!silent) {
                        window.showGpsTurnOnPopup();
                    }
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
            );
        };

        navigator.geolocation.getCurrentPosition(getPositionSuccess, getPositionError, { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 });
    };

    // Auto-detect pickup location silently on page load
    setTimeout(() => window.useLiveLocation(null, true), 800);

    let map = null;
    let mapMarker = null;

    window.openMapPicker = function (type, event) {
        if (event && event.currentTarget) {
            const btn = event.currentTarget;
            btn.style.transform = 'scale(0.85)';
            setTimeout(() => btn.style.transform = '', 150);
        }

        currentPickingType = type || (pickupCoords ? 'drop' : 'pickup');
        const overlay = document.getElementById('map-modal-overlay');
        const modal = document.getElementById('map-modal');
        if (overlay) overlay.classList.add('open');
        else if (modal) modal.style.display = 'flex';
        document.getElementById('picking-type').textContent = currentPickingType;
        document.getElementById('confirm-location').style.display = 'none';

        if (!map) {
            map = L.map('map-picker').setView([13.0827, 80.2707], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            map.on('click', (e) => {
                const { lat, lng } = e.latlng;
                tempCoords = `${lng},${lat}`;
                if (typeof mapMarker !== 'undefined' && mapMarker) map.removeLayer(mapMarker);
                mapMarker = L.marker([lat, lng]).addTo(map);
                document.getElementById('confirm-location').style.display = 'inline-block';
            });
        } else {
            setTimeout(() => map.invalidateSize(), 100);
            if (typeof mapMarker !== 'undefined' && mapMarker) { map.removeLayer(mapMarker); mapMarker = null; }
        }
    };

    window.closeMapPicker = function () {
        const overlay = document.getElementById('map-modal-overlay');
        const modal = document.getElementById('map-modal');
        if (overlay) overlay.classList.remove('open');
        else if (modal) modal.style.display = 'none';
    };

    window.confirmMapPoint = async function () {
        if (!tempCoords) return;

        const [lngStr, latStr] = tempCoords.split(',');
        const lng = parseFloat(lngStr);
        const lat = parseFloat(latStr);

        const inputId = currentPickingType;
        const input = document.getElementById(inputId);

        input.dataset.coords = tempCoords;
        if (currentPickingType === 'pickup') pickupCoords = tempCoords;
        else dropCoords = tempCoords;

        try {
            const res = await fetch(`${API_BASE_URL}/api/proxy/reverse?lon=${lng}&lat=${lat}`);
            const data = await res.json();
            if (data.features && data.features.length > 0) {
                const p = data.features[0].properties;
                const parts = [p.name, p.road, p.suburb, p.city, p.state].filter(Boolean);
                const address = parts.length > 0 ? parts.join(', ') : (p.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                input.value = address;
            } else {
                input.value = `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
        } catch (e) {
            input.value = `Selected Point (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
        }

        closeMapPicker();
        calculateFare();

        if (currentPickingType === 'pickup' && !dropCoords && currentCategory !== 'rental') {
            setTimeout(() => {
                if (confirm("Now select your destination on the map")) {
                    openMapPicker('drop');
                }
            }, 500);
        }
    };

    // Initialise Zero-Key Free Services
    setupAutocomplete('pickup', 'pickup-suggestions');
    setupAutocomplete('drop', 'drop-suggestions');

    document.getElementById('pickup').addEventListener('blur', () => {
        setTimeout(calculateFare, 250);
    });
    document.getElementById('drop').addEventListener('blur', () => {
        setTimeout(calculateFare, 250);
    });

    let pendingBookingData = null;

    window.openBookingModal = function() {
        const modal = document.getElementById('booking-modal');
        const summary = document.getElementById('booking-summary');
        
        if (pendingBookingData && summary) {
            summary.innerHTML = `
                <div style="padding: 1.2rem; background: #fff8f8; border: 1.5px solid var(--primary-red); border-radius: 16px; font-size: 0.9rem; line-height: 1.6; color: #333;">
                    <div style="font-weight: 800; color: var(--primary-red); margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 1px; font-size: 1.1rem;">📋 Booking Summary</div>
                    <div style="margin-bottom: 1.2rem; padding-bottom: 1.2rem; border-bottom: 1px dashed rgba(220, 20, 60, 0.2); font-size: 1.05rem;">
                        <div><b>Estimated Fare (Approx.):</b> <span style="color: var(--primary-red); font-weight: 800; font-size: 1.2rem;" id="bs-fare"></span></div>
                        <div><b>Distance:</b> <span id="bs-distance"></span></div>
                        <div id="bs-duration-row" style="display:none;"><b>Estimated Duration:</b> <span>🕒 <span id="bs-duration"></span></span></div>
                        <div style="font-size: 0.8rem; color: #666; margin-top: 5px;">* The amount is an approximate calculation. Tolls, state permits, parking charges, and route deviation adjustments based on actual path or time taken will be updated dynamically during the trip.</div>
                    </div>
                    <div style="font-weight: 800; color: var(--primary-red); margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 1px; font-size: 0.9rem;">📋 Important Policies</div>
                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
                        <div><b>@Additional:</b> Toll Fees, Inter-State Permit Airport Charges Parking Charges (if any) are extra.</div>
                        <div><b>@Driver Betta:</b> Rs. 400. [Rs. 600 for above 250kms]</div>
                        <div><b>@Hill Station Charges:</b> - Rs. 400</div>
                        <div><b>@One Way Drop Trips:</b> - Minimum running must be 130 kms</div>
                        <div><b>@Waiting Charges:</b> will be Rs.2 per min. (Except 30 min for food.)</div>
                        <div><b>@Max lagguage capacity by vehicle type:</b><br>-Sedan - 2 suitcases, Suv - 3 suitcases</div>
                    </div>
                </div>
            `;
            document.getElementById('bs-fare').textContent = pendingBookingData.fare;
            document.getElementById('bs-distance').textContent = pendingBookingData.distance;
            const durRow = document.getElementById('bs-duration-row');
            if (pendingBookingData.estimatedDuration) {
                durRow.style.display = 'block';
                document.getElementById('bs-duration').textContent = pendingBookingData.estimatedDuration;
            } else {
                durRow.style.display = 'none';
            }
        }
        
        if (modal) modal.style.display = 'flex';
    };

    window.closeBookingModal = function() {
        const oldModal = document.getElementById('booking-modal');
        if (oldModal) oldModal.style.display = 'none';
        const newModal = document.getElementById('confirm-modal-overlay');
        if (newModal) newModal.classList.remove('open');
        pendingBookingData = null;
    };

    window.applyAirBoostAndBook = async function(boostKm, incentiveFee) {
        if (typeof Swal !== 'undefined') Swal.close();
        if (!pendingBookingData) return;
        pendingBookingData.airDistanceBoostKm = boostKm;
        pendingBookingData.pickupIncentiveFare = incentiveFee;

        // Parse base fare & update total fare with incentive
        const baseFareNum = parseFloat(String(pendingBookingData.fare || '0').replace(/[^0-9.]/g, '')) || 0;
        const totalFareNum = baseFareNum + incentiveFee;
        pendingBookingData.fare = `₹${totalFareNum.toFixed(0)}`;

        confirmBookingWithTerms(true);
    };

    window.confirmBookingWithTerms = async function(skipCheck = false) {
        if (!pendingBookingData) return;
        const cmBtn = document.getElementById('cm-confirm-btn');
        if (cmBtn) { cmBtn.textContent = '⏳ Checking Driver Proximity...'; cmBtn.disabled = true; }
        
        try {
            // Pre-booking Air Distance check removed. This logic is now delayed and handled in active-ride.html.

            if (cmBtn) { cmBtn.textContent = '⏳ Booking...'; cmBtn.disabled = true; }

            const response = await fetch(`${API_BASE_URL}/api/bookings/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingBookingData)
            });

            if (response.ok) {
                const result = await response.json();
                if (window.CustomerNotifications) {
                    window.CustomerNotifications.notify(
                        'ride_booked',
                        '🚕 Ride Requested!',
                        `Booking #B${result.bookingId} placed successfully. OTP: ${result.journeyOtp}. Finding your nearest driver...`
                    );
                }
                alert(`🏨 BOOKING CONFIRMED!\nBooking ID: #B${result.bookingId}\nVerification OTP: ${result.journeyOtp}\n\nYour premium captain will be assigned shortly. Please keep this OTP safe.`);
                bookingForm.reset();
                if (extraDropsContainer) {
                    extraDropsContainer.innerHTML = '';
                    extraDropCount = 0;
                }
                if (fareEstimate) fareEstimate.classList.add('hidden');
                const strip = document.getElementById('fare-strip');
                if (strip) strip.classList.remove('visible');
                closeBookingModal();
                selectedVehicleData = null;

                if (typeof mapMarker !== 'undefined' && mapMarker) { map.removeLayer(mapMarker); mapMarker = null; }
                document.getElementById('pickup').removeAttribute('data-coords');
                document.getElementById('drop').removeAttribute('data-coords');
                pickupCoords = null;
                dropCoords = null;

                window.location.href = 'active-ride.html';
            } else {
                const errData = await response.json();
                console.error('Server Booking Error:', errData);
                alert(`Booking failed: ${errData.error || 'Please check your connection.'}`);
                if (cmBtn) { cmBtn.textContent = '✅ Accept & Book'; cmBtn.disabled = false; }
            }
        } catch (err) {
            console.error('Submission Error:', err);
            alert('A network error occurred.');
            if (cmBtn) { cmBtn.textContent = '✅ Accept & Book'; cmBtn.disabled = false; }
        }
    };

    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = JSON.parse(localStorage.getItem('cityride_member'));
        if (!user) {
            alert('Please login to CityRideTaxi to continue.');
            window.location.href = 'auth.html';
            return;
        }

        const pickupVal = document.getElementById('pickup').value.trim();
        if (!pickupVal) {
            alert('Please enter a pickup location.');
            return;
        }
        const pickupCoords = document.getElementById('pickup').dataset.coords;
        if (!pickupCoords) {
            alert('Please select a valid pickup location from the suggestions list or map.');
            return;
        }

        if (currentCategory !== 'rental') {
            const dropVal = document.getElementById('drop').value.trim();
            if (!dropVal) {
                alert('Please enter a destination.');
                return;
            }
            const dropCoords = document.getElementById('drop').dataset.coords;
            if (!dropCoords) {
                alert('Please select a valid destination from the suggestions list or map.');
                return;
            }
        }

        const btn = document.getElementById('search-vehicles-btn');
        if (btn) { btn.textContent = '🔄 Calculating...'; btn.disabled = true; }
        await calculateFare();
        if (btn) { btn.textContent = '🔍 Search Available Vehicles'; btn.disabled = false; }

        const grid = document.getElementById('vehicle-cards-grid');
        if (grid && grid.children.length > 0 && !grid.innerHTML.includes('Could not calculate route')) {
            openVehicleModal();
        } else {
            alert('⚠️ Fare Calculation Error: Could not retrieve route. Please select valid locations from the autocomplete list.');
        }
    });

    // --- Authentication UI Header Logic (SPA-aware) ---
    function updateAuthHeader() {
        const member = JSON.parse(localStorage.getItem('cityride_member'));

        const spaDbLink = document.getElementById('spa-dashboard-link');
        const spaLogout = document.getElementById('spa-logout-wrap');
        const spaLogin = document.getElementById('spa-login-wrap');
        const navDbLink = document.getElementById('nav-dashboard-link');

        if (member) {
            document.body.classList.add('authenticated');
            if (spaDbLink) spaDbLink.style.display = 'inline';
            if (spaLogout) spaLogout.style.display = 'inline';
            if (spaLogin) spaLogin.style.display = 'none';

            if (navDbLink) {
                navDbLink.textContent = 'Dashboard'; navDbLink.href = '/dashboard';
            }
        } else {
            document.body.classList.remove('authenticated');
            if (spaDbLink) spaDbLink.style.display = 'none';
            if (spaLogout) spaLogout.style.display = 'none';
            if (spaLogin) spaLogin.style.display = 'block';
        }

        const navLinks = document.querySelector('.nav-links');
        const guestActions = document.querySelectorAll('.guest-action');
        const authActions = document.querySelectorAll('.auth-action');
        const heroDashBtn = document.getElementById('hero-dashboard-btn');

        if (!navLinks) return;
        navLinks.querySelectorAll('.auth-link').forEach(l => l.remove());

        if (member) {
            const li = document.createElement('li');
            li.className = 'auth-link';
            li.innerHTML = `<a href='/dashboard' style="color:var(--primary-red); font-weight:700;">My Dashboard</a>`;
            navLinks.insertBefore(li, navLinks.firstChild);

            const logoutLi = document.createElement('li');
            logoutLi.className = 'auth-link menu-button-item mobile-only-item';
            logoutLi.innerHTML = `<button class="btn logout-btn" onclick="logoutUser()" style="display:flex !important;">🚪 Sign Out</button>`;
            navLinks.appendChild(logoutLi);

            const bookLi = document.createElement('li');
            bookLi.className = 'auth-link menu-button-item mobile-only-item';
            bookLi.innerHTML = `<button class="btn btn-primary" onclick="openMapPicker()">Book Now</button>`;
            navLinks.appendChild(bookLi);

            if (heroDashBtn) heroDashBtn.style.display = 'inline-block';
            guestActions.forEach(el => el.style.display = 'none');
            authActions.forEach(el => el.style.display = 'inline-block');
        } else {
            const li = document.createElement('li');
            li.className = 'auth-link';
            li.innerHTML = `<a href='/auth'>Login</a>`;
            navLinks.appendChild(li);

            const bookLi = document.createElement('li');
            bookLi.className = 'auth-link menu-button-item mobile-only-item';
            bookLi.innerHTML = `<button class="btn btn-primary" onclick="openMapPicker()">Book Now</button>`;
            navLinks.appendChild(bookLi);

            if (heroDashBtn) heroDashBtn.style.display = 'none';
            guestActions.forEach(el => el.style.display = 'inline-block');
            authActions.forEach(el => el.style.display = 'none');
        }
    }

    window.logoutUser = function () {
        fetch('/api/auth/logout', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'user' })
        }).catch(() => {});
        localStorage.removeItem('cityride_member');
        window.location.reload();
    }

    updateAuthHeader();

    const mainLogo = document.querySelector('.logo');
    if (mainLogo) {
        mainLogo.addEventListener('dblclick', () => {
            if (confirm("Enter Admin Panel")) window.location.href = 'admin.html';
        });
    }
});

/**
 * GOOGLE MAPS INTEGRATION NOTES:
 * To enable real distance calculation, add the following script to /:
 * <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places"></script>
 * 
 * Then use:
 * let autocompletePickup = new google.maps.places.Autocomplete(document.getElementById('pickup'));
 * let autocompleteDrop = new google.maps.places.Autocomplete(document.getElementById('drop'));
 * 
 */
let currentRouteLayer = null;
let currentMapMarkers = [];

function _makePickupIcon() {
    const html = `
        <div style="position:relative; width:28px; height:36px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36" width="28" height="36">
                <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="#10b981"/>
                <circle cx="14" cy="14" r="6" fill="white"/>
                <circle cx="14" cy="14" r="3" fill="#10b981"/>
            </svg>
            <div style="position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:8px;height:4px;background:rgba(0,0,0,0.2);border-radius:50%;"></div>
        </div>`;
    return L.divIcon({ html, className: '', iconSize: [28, 36], iconAnchor: [14, 36] });
}

function _makeDropIcon() {
    const html = `
        <div style="position:relative; width:32px; height:40px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40">
                <path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 16 24 16 24S32 26.667 32 16C32 7.163 24.837 0 16 0z" fill="#ef4444"/>
                <rect x="12" y="7" width="12" height="2" rx="1" fill="white"/>
                <rect x="12" y="7" width="2" height="12" rx="1" fill="white"/>
                <polygon points="14,7 20,11 14,15" fill="white"/>
            </svg>
            <div style="position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:10px;height:4px;background:rgba(0,0,0,0.2);border-radius:50%;"></div>
        </div>`;
    return L.divIcon({ html, className: '', iconSize: [32, 40], iconAnchor: [16, 40] });
}

function _makeStopIcon(num) {
    const html = `
        <div style="position:relative; width:30px; height:38px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 38" width="30" height="38">
                <path d="M15 0C6.716 0 0 6.716 0 15c0 10 15 23 15 23S30 25 30 15C30 6.716 23.284 0 15 0z" fill="#f59e0b"/>
                <circle cx="15" cy="15" r="9" fill="white"/>
                <text x="15" y="20" text-anchor="middle" font-size="11" font-weight="800" font-family="Arial,sans-serif" fill="#f59e0b">${num}</text>
            </svg>
            <div style="position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:8px;height:4px;background:rgba(0,0,0,0.2);border-radius:50%;"></div>
        </div>`;
    return L.divIcon({ html, className: '', iconSize: [30, 38], iconAnchor: [15, 38] });
}

window.drawRouteOnMap = function(route, pickupCoords, extraCoordsArray, dropCoords) {
    if (!window.lmap) return;

    // Clear previous layers
    if (currentRouteLayer) {
        window.lmap.removeLayer(currentRouteLayer);
        currentRouteLayer = null;
    }
    currentMapMarkers.forEach(m => window.lmap.removeLayer(m));
    currentMapMarkers = [];

    const bounds = [];

    // Draw route polyline
    if (route && route.geometry && route.geometry.coordinates) {
        const latLngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
        currentRouteLayer = L.polyline(latLngs, {
            color: '#10b981',
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round',
            lineCap: 'round'
        }).addTo(window.lmap);
        latLngs.forEach(ll => bounds.push(ll));
    }

    // Place pickup marker (green location pin)
    if (pickupCoords) {
        const [lng, lat] = pickupCoords.split(',').map(Number);
        const m = L.marker([lat, lng], { icon: _makePickupIcon() }).addTo(window.lmap);
        m.bindTooltip('Pickup', { permanent: false, direction: 'top' });
        currentMapMarkers.push(m);
        bounds.push([lat, lng]);
    }

    // Place numbered stop markers (amber with number)
    extraCoordsArray.forEach((coordStr, i) => {
        if (!coordStr) return;
        const [lng, lat] = coordStr.split(',').map(Number);
        const m = L.marker([lat, lng], { icon: _makeStopIcon(i + 1) }).addTo(window.lmap);
        m.bindTooltip(`Stop ${i + 1}`, { permanent: false, direction: 'top' });
        currentMapMarkers.push(m);
        bounds.push([lat, lng]);
    });

    // Place drop marker (red destination flag)
    if (dropCoords) {
        const [lng, lat] = dropCoords.split(',').map(Number);
        const m = L.marker([lat, lng], { icon: _makeDropIcon() }).addTo(window.lmap);
        m.bindTooltip('Destination', { permanent: false, direction: 'top' });
        currentMapMarkers.push(m);
        bounds.push([lat, lng]);
    }

    // Fit map bounds
    if (bounds.length > 1) {
        window.lmap.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (bounds.length === 1) {
        window.lmap.setView(bounds[0], 14, { animate: true });
    }
};

window.updateMapMarkers = async function() {
    const pickupEl = document.getElementById('pickup');
    const dropEl = document.getElementById('drop');
    const pickupCoords = pickupEl && pickupEl.dataset.coords;
    const dropCoords = dropEl && dropEl.dataset.coords;

    // Collect extra stop coords
    const extraCoordsArray = [];
    const extraContainer = document.getElementById('extra-drops-container');
    if (extraContainer) {
        extraContainer.querySelectorAll('.extra-drop-row input').forEach(inp => {
            if (inp.dataset.coords) extraCoordsArray.push(inp.dataset.coords);
        });
    }

    // If nothing selected, do nothing
    if (!pickupCoords) return;

    // Only pickup selected — just pan to it and show pin
    if (!dropCoords) {
        window.drawRouteOnMap(null, pickupCoords, [], null);
        return;
    }

    // Both pickup and drop present — fetch real route from OSRM
    try {
        let url = `/api/proxy/route?pickup=${pickupCoords}&drop=${dropCoords}`;
        if (extraCoordsArray.length > 0) {
            url += `&extraDrops=${extraCoordsArray.join(';')}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
            window.drawRouteOnMap(data.routes[0], pickupCoords, extraCoordsArray, dropCoords);
        } else {
            window.drawRouteOnMap(null, pickupCoords, extraCoordsArray, dropCoords);
        }
    } catch(e) {

        console.warn('Route fetch for map failed:', e);
        window.drawRouteOnMap(null, pickupCoords, extraCoordsArray, dropCoords);
    }
};
