// pricingEngine.js - Canonical Pricing & Commission Engine

// Validates and coerces numerical values, clamping to min if necessary
function safeNum(val, defaultVal = 0, minVal = null) {
    let parsed = parseFloat(val);
    if (isNaN(parsed) || !isFinite(parsed)) parsed = defaultVal;
    if (minVal !== null && parsed < minVal) parsed = minVal;
    return parsed;
}

// 20. Money Rounding
function roundMoney(amount) {
    return Math.ceil(safeNum(amount));
}

// Calculates the canonical fare for a ride
async function calculateCanonicalFare(db, {
    distanceKm, 
    durationMins, 
    vehicleType, 
    category, 
    pickupTime, 
    extraDrops, 
    specialPlaceType, 
    vendorId, 
    rentalPackage, 
    returnDate, 
    pickupDate, 
    preRideWaitingCharge = 0 
}) {
    // 5. INPUT VALIDATION
    const dist = safeNum(distanceKm, 0, 0);
    const dur = safeNum(durationMins, 0, 0);
    const vType = typeof vehicleType === 'string' ? vehicleType : 'sedan';
    const cat = typeof category === 'string' ? category : 'local';

    let activeCommissionConfig = null;
    if (db) {
        try {
            const [commRows] = await db.query("SELECT * FROM taxi_commission_configs WHERE status = 'active' ORDER BY version DESC LIMIT 1");
            if (commRows.length > 0) activeCommissionConfig = commRows[0];
        } catch (err) {
            console.error("[PricingEngine] Error fetching commission config:", err.message);
        }
    }

    // 17. CUSTOMER PLATFORM FEE
    const getPlatformFee = (subtotalAmt) => {
        if (!activeCommissionConfig) return 0;
        if (activeCommissionConfig.customer_commission_type === 'fixed') {
            return safeNum(activeCommissionConfig.customer_commission_fixed, 0, 0);
        }
        const pct = safeNum(activeCommissionConfig.customer_commission_percent, 0, 0);
        return (subtotalAmt * pct) / 100;
    };

    // 1. Fetch Pricing Config
    let pricingConfig = null;
    if (db) {
        try {
            if (vendorId) {
                const [vendorTariffRows] = await db.query(
                    'SELECT config FROM taxi_vendor_tariffs WHERE vendor_id = ? AND vehicle_type = ? AND category = ?', 
                    [vendorId, vType, cat]
                );
                if (vendorTariffRows.length > 0) {
                    pricingConfig = typeof vendorTariffRows[0].config === 'string' ? JSON.parse(vendorTariffRows[0].config) : vendorTariffRows[0].config;
                }
            }
            if (!pricingConfig) {
                const [tariffRows] = await db.query(
                    'SELECT config FROM taxi_tariffs WHERE vehicle_type = ? AND category = ?', 
                    [vType, cat]
                );
                if (tariffRows.length > 0) {
                    pricingConfig = typeof tariffRows[0].config === 'string' ? JSON.parse(tariffRows[0].config) : tariffRows[0].config;
                }
            }
        } catch (e) {
            console.error("[PricingEngine] Error fetching pricing config:", e.message);
        }
    }

    // 2. Fetch Active Peak Rules
    let peakMult = 0;
    if (db && cat === 'local') {
        try {
            const [peakRules] = await db.query('SELECT * FROM taxi_peak_rules WHERE is_active = 1');
            peakMult = getPeakMultiplier(pickupTime || new Date(), peakRules);
        } catch (e) {
            console.error("[PricingEngine] Error fetching peak rules:", e.message);
        }
    }

    // 3. Fetch Special Location Charge
    let specialSurchargePct = 0;
    if (db && specialPlaceType) {
        try {
            const [spFinishRows] = await db.query(
                'SELECT surcharge_percentage FROM taxi_special_location_charges WHERE place_type = ? AND is_active = 1', 
                [specialPlaceType]
            );
            if (spFinishRows.length > 0) {
                specialSurchargePct = safeNum(spFinishRows[0].surcharge_percentage, 0, 0) / 100;
            }
        } catch (e) {
            console.error("[PricingEngine] Error fetching special surcharge:", e.message);
        }
    }

    // 4. Calculate Extra Drops
    let extraDropsCharge = 0;
    let extraDropsCount = 0;
    try {
        if (extraDrops && (cat === 'local' || cat === 'oneway')) {
            const stops = typeof extraDrops === 'string' ? JSON.parse(extraDrops) : extraDrops;
            if (Array.isArray(stops)) {
                extraDropsCount = stops.length;
                extraDropsCharge = extraDropsCount * 50;
            }
        }
    } catch (e) {
        console.error("[PricingEngine] Failed to parse extra_drops:", e.message);
    }

    let baseKmFare = 0;
    let waitingCharge = safeNum(preRideWaitingCharge, 0, 0);
    let driverAllowance = 0;
    let tripDays = 1;
    let subtotal = 0;

    // RENTAL
    if (cat === 'rental') {
        const packageVal = rentalPackage || '2-20';
        const [pMaxHrs, pMaxKm] = packageVal.split('-').map(Number);
        
        const rentalAllowedMins = safeNum(pMaxHrs, 2) * 60;
        if (dur > rentalAllowedMins) {
            waitingCharge += Math.ceil((dur - rentalAllowedMins)) * 2;
        }

        if (pricingConfig && pricingConfig[packageVal]) {
            const packageConfig = pricingConfig[packageVal];
            const extraKm = Math.max(0, dist - safeNum(pMaxKm, 20));
            const extraKmCharge = extraKm * safeNum(packageConfig.extraKm, 0);
            const durationHrs = dur / 60;
            const extraHrs = Math.max(0, Math.ceil(durationHrs - safeNum(pMaxHrs, 2)));
            const extraHrCharge = extraHrs * safeNum(packageConfig.extraHour, 0);

            const totalExtra = extraKmCharge + extraHrCharge;
            baseKmFare = safeNum(packageConfig.base, 0) + totalExtra;
        } else {
            baseKmFare = 500; // Fallback
        }
        const specialCharge = baseKmFare * specialSurchargePct;
        subtotal = baseKmFare + specialCharge + waitingCharge;

    // LOCAL
    } else if (cat === 'local') {
        const config = pricingConfig || { base: 150, perKm: 20, minKm: 0 };
        const minKm = safeNum(config.minKm, 0);
        const billableDist = Math.max(dist, minKm);
        
        const allowedMins = billableDist * 2;
        if (dur > allowedMins) {
            waitingCharge += Math.ceil(dur - allowedMins) * 2;
        }

        baseKmFare = calculateLocalSlabFare(billableDist, config);
        const peakCharge = baseKmFare * peakMult;
        const specialCharge = baseKmFare * specialSurchargePct;
        subtotal = baseKmFare + peakCharge + specialCharge + waitingCharge + extraDropsCharge;

    // ONEWAY
    } else if (cat === 'oneway') {
        const config = pricingConfig || { base: 0, perKm: 13, minKm: 130 };
        const baseFare = safeNum(config.base, 0);
        const minKm = safeNum(config.minKm, 130);
        const billableDist = Math.max(dist, minKm);
        
        const distanceFare = billableDist * safeNum(config.perKm, 13);
        baseKmFare = Math.max(baseFare, distanceFare);
        
        driverAllowance = vType === 'bike' ? 0 : (dist > 250 ? 600 : 400);
        const specialCharge = baseKmFare * specialSurchargePct;
        subtotal = baseKmFare + driverAllowance + specialCharge + waitingCharge + extraDropsCharge;

    // ROUND
    } else if (cat === 'round') {
        const config = pricingConfig || { base: 0, perKm: 12, minKmPerDay: 250 };
        const baseFare = safeNum(config.base, 0);
        
        if (returnDate && pickupDate) {
            const start = new Date(pickupDate);
            const end = new Date(returnDate);
            if (end > start) {
                const diffTime = Math.abs(end - start);
                tripDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }
        }
        
        const minKmForTrip = safeNum(config.minKmPerDay, 250) * tripDays;
        const billableDist = Math.max(dist, minKmForTrip);
        
        const distanceFare = billableDist * safeNum(config.perKm, 12);
        baseKmFare = Math.max(baseFare, distanceFare);
        
        driverAllowance = vType === 'bike' ? 0 : (tripDays * 400); // Wait, if dist > 250 logic applies? Prompt says "400 * tripDays".
        const specialCharge = baseKmFare * specialSurchargePct;
        subtotal = baseKmFare + driverAllowance + specialCharge + waitingCharge;
    }

    const platformFee = getPlatformFee(subtotal);
    const finalFare = roundMoney(subtotal + platformFee);

    return {
        baseKmFare,
        waitingCharge,
        extraDropsCharge,
        peakCharge: baseKmFare * peakMult,
        specialCharge: baseKmFare * specialSurchargePct,
        driverAllowance,
        platformFee,
        subtotal,
        finalFare,
        tripDays,
        pricingConfig
    };
}

// 9. LOCAL FARE — SLAB SYSTEM
function calculateLocalSlabFare(distance, config) {
    const minKm = safeNum(config?.minKm, 0);
    const baseFare = safeNum(config?.base, 0);
    const d = Math.max(distance, minKm);

    // If config explicitly does not have slab1_rate but has perKm, use fallback
    if (config && config.perKm !== undefined && config.slab1_rate === undefined) {
        return Math.max(baseFare, d * safeNum(config.perKm, 20));
    }

    let distanceFare = 0;

    const r1 = safeNum(config?.slab1_rate, safeNum(config?.perKm, 20)); 
    const r2 = safeNum(config?.slab2_rate, r1); 
    const r3 = safeNum(config?.slab3_rate, r2); 
    const r4 = safeNum(config?.slab4_rate, r3); 
    const r5 = safeNum(config?.slab5_rate, r4); 
    const r6 = safeNum(config?.slab6_rate, r5); 
    const r7 = safeNum(config?.slab7_rate, r6); 
    const r8 = safeNum(config?.slab8_rate, r7); 
    const r9 = safeNum(config?.slab9_rate, r8); 
    const r10 = safeNum(config?.slab10_rate, r9);
    const r11 = safeNum(config?.slab11_rate, r10);
    const rAbove100 = safeNum(config?.above100_rate, safeNum(config?.perKm, r11));

    let rem = d;
    if (rem > 100) { distanceFare += (rem - 100) * rAbove100; rem = 100; }
    if (rem > 90) { distanceFare += (rem - 90) * r11; rem = 90; }
    if (rem > 80) { distanceFare += (rem - 80) * r10; rem = 80; }
    if (rem > 70) { distanceFare += (rem - 70) * r9; rem = 70; }
    if (rem > 60) { distanceFare += (rem - 60) * r8; rem = 60; }
    if (rem > 50) { distanceFare += (rem - 50) * r7; rem = 50; }
    if (rem > 40) { distanceFare += (rem - 40) * r6; rem = 40; }
    if (rem > 30) { distanceFare += (rem - 30) * r5; rem = 30; }
    if (rem > 20) { distanceFare += (rem - 20) * r4; rem = 20; }
    if (rem > 10) { distanceFare += (rem - 10) * r3; rem = 10; }
    if (rem > 5) { distanceFare += (rem - 5) * r2; rem = 5; }
    if (rem > 0) { distanceFare += rem * r1; }

    return Math.max(baseFare, distanceFare);
}

// 11. PEAK PRICING
function getPeakMultiplier(timeStr, rules) {
    if (!rules || rules.length === 0) return 0;
    const now = new Date(timeStr);
    const currMins = now.getHours() * 60 + now.getMinutes();

    let maxSurcharge = 0;
    for (const rule of rules) {
        if (!rule.is_active || !rule.start_time || !rule.end_time) continue;

        let [sH, sM] = rule.start_time.split(':').map(Number);
        let [eH, eM] = rule.end_time.split(':').map(Number);

        const startMins = safeNum(sH) * 60 + safeNum(sM);
        const endMins = safeNum(eH) * 60 + safeNum(eM);

        let isActive = false;
        if (startMins <= endMins) {
            if (currMins >= startMins && currMins <= endMins) isActive = true;
        } else {
            // Overnight rule
            if (currMins >= startMins || currMins <= endMins) isActive = true;
        }

        if (isActive) {
            const pct = safeNum(rule.surcharge_percentage, 0);
            if (pct > maxSurcharge) maxSurcharge = pct;
        }
    }
    return maxSurcharge / 100;
}

// 7 & 8. AUTOMATIC LOCAL / OUTSTATION CLASSIFICATION & ADMIN MODE
async function resolveRideCategory(db, distanceKm, requestedCategory) {
    const dist = safeNum(distanceKm, 0);
    
    let mode = 'AUTOMATIC';
    let threshold = 100;
    let localEnabled = true;
    let outstationEnabled = true;

    if (db) {
        try {
            const [settings] = await db.query("SELECT setting_key, setting_value FROM taxi_settings WHERE setting_key IN ('classification_mode', 'local_enabled', 'outstation_enabled', 'local_threshold_km')");
            for (const row of settings) {
                if (row.setting_key === 'classification_mode') mode = String(row.setting_value).toUpperCase();
                if (row.setting_key === 'local_threshold_km') threshold = safeNum(row.setting_value, 100);
                if (row.setting_key === 'local_enabled') localEnabled = (row.setting_value === 'true');
                if (row.setting_key === 'outstation_enabled') outstationEnabled = (row.setting_value === 'true');
            }
        } catch (e) {
            console.error("[PricingEngine] Error fetching classification config:", e.message);
        }
    }

    let reqCat = String(requestedCategory || '').toLowerCase();
    if (reqCat === 'outstation') reqCat = 'oneway';

    let finalCategory = 'local';
    
    if (mode === 'MANUAL' && reqCat) {
        const validCats = ['local', 'oneway', 'round', 'rental'];
        if (validCats.includes(reqCat)) {
            finalCategory = reqCat;
        } else {
            throw new Error(`Invalid manual category requested: ${requestedCategory}`);
        }
    } else {
        // AUTOMATIC: calculate category from server-side road distance
        // ignore client category except for explicit rental/round
        if (reqCat === 'rental' || reqCat === 'round') {
            finalCategory = reqCat;
        } else if (dist >= threshold) {
            finalCategory = 'oneway';
        } else {
            finalCategory = 'local';
        }
    }

    if (!localEnabled && finalCategory === 'local') throw new Error("Local rides are disabled by admin.");
    if (!outstationEnabled && (finalCategory === 'oneway' || finalCategory === 'round')) throw new Error("Outstation rides are disabled by admin.");

    return finalCategory;
}

module.exports = {
    calculateCanonicalFare,
    resolveRideCategory,
    calculateLocalSlabFare,
    getPeakMultiplier,
    safeNum
};
