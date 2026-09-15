// pricingEngine.js - Canonical Pricing & Commission Engine

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
    // Fetch active commission config for dynamic customer platform fee
    let activeCommissionConfig = null;
    if (db) {
        try {
            const [commRows] = await db.query("SELECT * FROM taxi_commission_configs WHERE status = 'active' ORDER BY version DESC LIMIT 1");
            if (commRows.length > 0) activeCommissionConfig = commRows[0];
        } catch (err) {
            console.error("Error fetching active commission config in pricingEngine:", err);
        }
    }

    const getPlatformFee = (baseAmt) => {
        if (!activeCommissionConfig) return 0;
        if (activeCommissionConfig.customer_commission_type === 'fixed') {
            return parseFloat(activeCommissionConfig.customer_commission_fixed) || 0;
        }
        return (baseAmt * (parseFloat(activeCommissionConfig.customer_commission_percent) || 0)) / 100;
    };

    // 1. Fetch Pricing Config (check vendor first, then fallback)
    let pricingConfig = null;
    if (vendorId) {
        const [vendorTariffRows] = await db.query(
            'SELECT config FROM taxi_vendor_tariffs WHERE vendor_id = ? AND vehicle_type = ? AND category = ?', 
            [vendorId, vehicleType, category]
        );
        if (vendorTariffRows.length > 0) {
            pricingConfig = typeof vendorTariffRows[0].config === 'string' ? JSON.parse(vendorTariffRows[0].config) : vendorTariffRows[0].config;
        }
    }
    
    if (!pricingConfig) {
        const [tariffRows] = await db.query(
            'SELECT config FROM taxi_tariffs WHERE vehicle_type = ? AND category = ?', 
            [vehicleType, category]
        );
        if (tariffRows.length > 0) {
            pricingConfig = typeof tariffRows[0].config === 'string' ? JSON.parse(tariffRows[0].config) : tariffRows[0].config;
        }
    }

    // 2. Fetch Active Peak Rules
    const [peakRules] = await db.query('SELECT * FROM taxi_peak_rules WHERE is_active = 1');
    const peakMult = category === 'local' ? getPeakMultiplier(pickupTime || new Date(), peakRules) : 0;

    // 3. Fetch Special Location Charge
    let specialSurchargePct = 0;
    if (specialPlaceType) {
        const [spFinishRows] = await db.query(
            'SELECT surcharge_percentage FROM taxi_special_location_charges WHERE place_type = ? AND is_active = 1', 
            [specialPlaceType]
        );
        if (spFinishRows.length > 0) {
            specialSurchargePct = parseFloat(spFinishRows[0].surcharge_percentage) / 100;
        }
    }

    // 4. Calculate Extra Drops
    let extraDropsCharge = 0;
    try {
        if (extraDrops) {
            const stops = typeof extraDrops === 'string' ? JSON.parse(extraDrops) : extraDrops;
            if (Array.isArray(stops)) {
                if (category === 'local' || category === 'oneway') {
                    extraDropsCharge = stops.length * 50;
                }
            }
        }
    } catch (e) {
        console.error("Failed to parse extra_drops in canonical engine", e);
    }

    // 5. Calculate base fare & waiting charge
    let totalFare = 0;
    let waitingCharge = 0;
    let baseKmFare = 0;
    
    // Rental is preserved as-is but not extended
    if (category === 'rental') {
        const packageVal = rentalPackage || '2-20';
        const [pMaxHrs, pMaxKm] = packageVal.split('-').map(Number);
        
        const rentalAllowedMins = (pMaxHrs || 2) * 60;
        if (durationMins > rentalAllowedMins) {
            waitingCharge = (durationMins - rentalAllowedMins) * 2;
        }

        if (pricingConfig && pricingConfig[packageVal]) {
            const packageConfig = pricingConfig[packageVal];
            const extraKm = Math.max(0, distanceKm - pMaxKm);
            const extraKmCharge = extraKm * packageConfig.extraKm;
            const durationHrs = durationMins / 60;
            const extraHrs = Math.max(0, Math.ceil(durationHrs - pMaxHrs));
            const extraHrCharge = extraHrs * packageConfig.extraHour;

            const totalExtra = extraKmCharge + extraHrCharge;
            baseKmFare = packageConfig.base + totalExtra;
            const specialCharge = baseKmFare * specialSurchargePct;
            const baseTotal = baseKmFare + specialCharge + waitingCharge;
            totalFare = baseTotal + getPlatformFee(baseTotal);
        } else {
            // Fallback for rental if no config
            totalFare = 500;
        }
    } else if (category === 'local') {
        waitingCharge = preRideWaitingCharge;
        const config = pricingConfig || { base: 150, perKm: 20, minKm: 0 };
        const minKm = typeof config.minKm === 'number' ? config.minKm : 0;
        const billableDist = Math.max(distanceKm, minKm);
        
        const allowedMins = billableDist * 2;
        if (durationMins > allowedMins) {
            waitingCharge += Math.ceil((durationMins - allowedMins) * 2);
        }

        baseKmFare = calculateLocalSlabFare(billableDist, config);
        const peakCharge = baseKmFare * peakMult;
        const specialCharge = baseKmFare * specialSurchargePct;
        const baseTotal = baseKmFare + peakCharge + specialCharge + waitingCharge + extraDropsCharge;
        totalFare = baseTotal + getPlatformFee(baseTotal);
    } else if (category === 'oneway') {
        waitingCharge = preRideWaitingCharge;
        const config = pricingConfig || { base: 0, perKm: 13, minKm: 130 };
        const baseFare = config.base || 0;
        const minKm = typeof config.minKm === 'number' ? config.minKm : 130;
        const billableDist = Math.max(distanceKm, minKm);
        const distanceFare = billableDist * (config.perKm || 13);
        baseKmFare = Math.max(baseFare, distanceFare);
        
        const driverAllowance = 400;
        const specialCharge = baseKmFare * specialSurchargePct;
        const baseTotal = baseKmFare + (vehicleType === 'bike' ? 0 : driverAllowance) + specialCharge + waitingCharge + extraDropsCharge;
        totalFare = baseTotal + getPlatformFee(baseTotal);
    } else if (category === 'round') {
        waitingCharge = preRideWaitingCharge;
        const config = pricingConfig || { base: 0, perKm: 12, minKmPerDay: 250 };
        const baseFare = config.base || 0;
        
        let tripDays = 1;
        if (returnDate && pickupDate) {
            const start = new Date(pickupDate);
            const end = new Date(returnDate);
            if (end > start) {
                const diffTime = Math.abs(end - start);
                tripDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }
        }
        
        const minKmForTrip = (typeof config.minKmPerDay === 'number' ? config.minKmPerDay : 250) * tripDays;
        const billableDist = Math.max(distanceKm, minKmForTrip);
        const distanceFare = billableDist * (config.perKm || 12);
        baseKmFare = Math.max(baseFare, distanceFare);
        
        const driverAllowance = 400;
        const specialCharge = baseKmFare * specialSurchargePct;
        const baseTotal = baseKmFare + (vehicleType === 'bike' ? 0 : driverAllowance * tripDays) + specialCharge + waitingCharge;
        totalFare = baseTotal + getPlatformFee(baseTotal);
    }

    const platformFee = Math.ceil(totalFare - (totalFare / (1 + (activeCommissionConfig && activeCommissionConfig.customer_commission_type === 'percent' ? parseFloat(activeCommissionConfig.customer_commission_percent)/100 : 0))));
    // Actually, getPlatformFee(baseTotal) was already added to totalFare.
    const calculatedPlatformFee = totalFare - (totalFare - getPlatformFee(totalFare - getPlatformFee(0))); // Simplified below

    return {
        baseKmFare,
        waitingCharge,
        extraDropsCharge,
        peakCharge: baseKmFare * peakMult,
        specialCharge: baseKmFare * specialSurchargePct,
        finalFare: Math.ceil(totalFare),
        platformFee: getPlatformFee(Math.ceil(totalFare - getPlatformFee(0))), // approximated base
        driverAllowance: (category === 'oneway' || category === 'round') ? (vehicleType === 'bike' ? 0 : 400) : 0,
        pricingConfig
    };
}

function calculateLocalSlabFare(distance, config) {
    const minKm = (config && config.minKm) ? parseFloat(config.minKm) : 0;
    const baseFare = (config && config.base !== undefined) ? parseFloat(config.base) : 0;
    const d = Math.max(distance, minKm);

    let distanceFare = 0;

    const r1 = (config && config.slab1_rate !== undefined) ? parseFloat(config.slab1_rate) : (config.perKm || 20); 
    const r2 = (config && config.slab2_rate !== undefined) ? parseFloat(config.slab2_rate) : r1; 
    const r3 = (config && config.slab3_rate !== undefined) ? parseFloat(config.slab3_rate) : r2; 
    const r4 = (config && config.slab4_rate !== undefined) ? parseFloat(config.slab4_rate) : r3; 
    const r5 = (config && config.slab5_rate !== undefined) ? parseFloat(config.slab5_rate) : r4; 
    const r6 = (config && config.slab6_rate !== undefined) ? parseFloat(config.slab6_rate) : r5; 
    const r7 = (config && config.slab7_rate !== undefined) ? parseFloat(config.slab7_rate) : r6; 
    const r8 = (config && config.slab8_rate !== undefined) ? parseFloat(config.slab8_rate) : r7; 
    const r9 = (config && config.slab9_rate !== undefined) ? parseFloat(config.slab9_rate) : r8; 
    const r10 = (config && config.slab10_rate !== undefined) ? parseFloat(config.slab10_rate) : r9;
    const r11 = (config && config.slab11_rate !== undefined) ? parseFloat(config.slab11_rate) : r10;
    const rAbove100 = (config && config.above100_rate !== undefined) ? parseFloat(config.above100_rate) : (config.perKm || r11);

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

function getPeakMultiplier(timeStr, rules) {
    if (!rules || rules.length === 0) return 0;
    const now = new Date(timeStr);
    const currMins = now.getHours() * 60 + now.getMinutes();

    let maxSurcharge = 0;
    for (const rule of rules) {
        if (!rule.is_active || !rule.start_time || !rule.end_time) continue;

        let [sH, sM] = rule.start_time.split(':').map(Number);
        let [eH, eM] = rule.end_time.split(':').map(Number);

        const startMins = sH * 60 + (sM || 0);
        const endMins = eH * 60 + (eM || 0);

        let isActive = false;
        if (startMins <= endMins) {
            if (currMins >= startMins && currMins <= endMins) isActive = true;
        } else {
            if (currMins >= startMins || currMins <= endMins) isActive = true;
        }

        if (isActive) {
            const pct = parseFloat(rule.surcharge_percentage) || 0;
            if (pct > maxSurcharge) maxSurcharge = pct;
        }
    }
    return maxSurcharge / 100;
}

async function resolveRideCategory(db, distanceKm, requestedCategory) {
    // Check config
    const [settings] = await db.query("SELECT setting_key, setting_value FROM taxi_settings WHERE setting_key IN ('classification_mode', 'local_enabled', 'outstation_enabled', 'local_threshold_km')");
    let mode = 'AUTOMATIC';
    let threshold = 100;
    let localEnabled = true;
    let outstationEnabled = true;

    for (const row of settings) {
        if (row.setting_key === 'classification_mode') mode = row.setting_value.toUpperCase();
        if (row.setting_key === 'local_threshold_km') threshold = parseFloat(row.setting_value) || 100;
        if (row.setting_key === 'local_enabled') localEnabled = (row.setting_value === 'true');
        if (row.setting_key === 'outstation_enabled') outstationEnabled = (row.setting_value === 'true');
    }

    let finalCategory = 'local';
    const reqCat = (requestedCategory || '').toLowerCase();
    
    if (mode === 'MANUAL' && requestedCategory) {
        finalCategory = reqCat;
    } else {
        if (reqCat === 'oneway' || reqCat === 'round' || reqCat === 'outstation') {
            finalCategory = reqCat === 'outstation' ? 'oneway' : reqCat;
        } else if (reqCat === 'rental') {
            finalCategory = 'rental';
        } else if (distanceKm >= threshold) {
            finalCategory = 'outstation'; // Use outstation for distance >= threshold
        } else {
            finalCategory = 'local';
        }
    }

    // Apply specific category mappings if requested category is oneway or round
    if (finalCategory === 'outstation') {
        finalCategory = 'oneway'; 
        if (reqCat === 'round') finalCategory = 'round';
    }

    if (!localEnabled && finalCategory === 'local') throw new Error("Local rides are disabled by admin.");
    if (!outstationEnabled && (finalCategory === 'oneway' || finalCategory === 'round')) throw new Error("Outstation rides are disabled by admin.");

    return finalCategory;
}

module.exports = {
    calculateCanonicalFare,
    resolveRideCategory,
    calculateLocalSlabFare,
    getPeakMultiplier
};
