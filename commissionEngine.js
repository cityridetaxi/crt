// commissionEngine.js - Handles Financial Settlements, Ledgers, and Snapshots

async function settleRideFinancials(db, {
    bookingId,
    distanceKm,
    category,
    vehicleType,
    baseKmFare,
    waitingCharge,
    extraDropsCharge,
    peakCharge,
    specialCharge,
    platformFee,
    finalFare,
    vendorMarkup,
    driverId,
    vendorId,
    associationId,
    assocCustomerOverrideAmount
}) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Fetch Active Commission Config
        const [configRows] = await conn.query("SELECT * FROM taxi_commission_configs WHERE status = 'active' ORDER BY version DESC LIMIT 1");
        if (configRows.length === 0) throw new Error("No active commission configuration found.");
        const config = configRows[0];
        const commissionVersionId = config.version;
        const custPct = parseFloat(config.customer_commission_percent) || 0;
        const drvPct = parseFloat(config.driver_commission_percent) || 0;
        const maintPct = parseFloat(config.maintenance_percent) || 0;
        const assocPct = parseFloat(config.association_percent) || 0;
        const cityPct = parseFloat(config.cityride_percent) || 0;
        const totalPct = parseFloat(config.total_commission_percent) || 0;

        const custFix = parseFloat(config.customer_commission_fixed) || 0;
        const drvFix = parseFloat(config.driver_commission_fixed) || 0;
        const maintFix = parseFloat(config.maintenance_fixed) || 0;
        const assocFix = parseFloat(config.association_fixed) || 0;
        const cityFix = parseFloat(config.cityride_fixed) || 0;

        // 2. Fetch Active Tariff Version (for snapshot)
        // (Assuming we query taxi_tariff_versions or just use id 1 as a placeholder if not fully implemented)
        let tariffVersionId = null;
        try {
            const [tariffVer] = await conn.query("SELECT id FROM taxi_tariff_versions WHERE status = 'active' LIMIT 1");
            if (tariffVer.length > 0) tariffVersionId = tariffVer[0].id;
        } catch (e) { /* Ignore if table doesn't exist */ }

        // 3. Create Pricing Snapshot (non-critical, wrapped so it can't abort settlement)
        try {
            await conn.query(`
                INSERT INTO taxi_ride_pricing_snapshots 
                (booking_id, distance_km, ride_category, vehicle_type, tariff_version_id, commission_version_id, base_fare, distance_charge, peak_charge, special_location_charge, extra_drops_charge, waiting_charge, vendor_markup, final_fare, customer_commission_pct, driver_commission_pct, maintenance_pct, association_pct, cityride_pct)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE final_fare = VALUES(final_fare)
            `, [
                bookingId, distanceKm, category, vehicleType, tariffVersionId, commissionVersionId,
                baseKmFare, 0, peakCharge, specialCharge, extraDropsCharge, waitingCharge, vendorMarkup, finalFare,
                custPct, drvPct, maintPct, assocPct, cityPct
            ]);
        } catch (snapshotErr) {
            console.warn(`[FINANCE] Pricing snapshot insert skipped for B#${bookingId}:`, snapshotErr.message);
        }

        // 4. Calculate Absolute Amounts (Platform standard)
        let customerCommissionAmount = platformFee || 0;

        let driverCommissionAmount = 0;
        if (config.driver_commission_type === 'fixed') {
            driverCommissionAmount = drvFix;
        } else {
            driverCommissionAmount = (finalFare * drvPct) / 100;
        }

        const totalCommissionAmount = driverCommissionAmount + customerCommissionAmount;

        let maintAmount = 0;
        let assocAmount = 0;
        let cityAmount = 0;

        // --- 100% District-Based Profit Routing ---
        // If the ride was booked within an Association's district (associationId is present),
        // 100% of the profit goes to that Association.
        // If there is no Association, 100% of the profit goes to the main Admin (CityRide).
        
        if (associationId) {
            assocAmount = totalCommissionAmount;
        } else {
            cityAmount = totalCommissionAmount;
        }

        // --- Hybrid Association Commission Overrides ---
        let assocNote = `Commission share from Finish Trip #B${bookingId}`;
        if (associationId) {
            const [assocRows] = await conn.query('SELECT commission_driver_pct, commission_driver_fixed FROM taxi_associations WHERE id = ?', [associationId]);
            if (assocRows.length > 0) {
                const cDrvPct = parseFloat(assocRows[0].commission_driver_pct) || 0;
                const cDrvFixed = parseFloat(assocRows[0].commission_driver_fixed) || 0;
                
                let customDriverDeduction = 0;
                if (cDrvPct > 0 || cDrvFixed > 0) {
                    customDriverDeduction = (finalFare * (cDrvPct / 100)) + cDrvFixed;
                    driverCommissionAmount += customDriverDeduction;
                }
                
                // The Association earns the 100% platform profit PLUS whatever extra hybrid commission they set
                const cCustOverride = parseFloat(assocCustomerOverrideAmount) || 0;
                if (cCustOverride > 0 || customDriverDeduction > 0) {
                    assocAmount += (cCustOverride + customDriverDeduction);
                    assocNote = `100% District Profit + Hybrid Commission: Cust(₹${cCustOverride.toFixed(2)}) + Drv(₹${customDriverDeduction.toFixed(2)}) for Trip #B${bookingId}`;
                } else {
                    assocNote = `100% District Profit Share for Trip #B${bookingId}`;
                }
            }
        }

        // 5. Idempotent Ledger Entries
        const insertLedger = async (type, amt) => {
            await conn.query(`
                INSERT INTO taxi_financial_ledger (booking_id, transaction_type, amount, reference_version_id, status)
                VALUES (?, ?, ?, ?, 'completed')
                ON DUPLICATE KEY UPDATE amount = VALUES(amount)
            `, [bookingId, type, amt, commissionVersionId]);
        };

        await insertLedger('ride_fare', finalFare);
        await insertLedger('driver_commission', driverCommissionAmount);
        await insertLedger('maintenance_allocation', maintAmount);
        if (associationId) {
            await insertLedger('association_allocation', assocAmount);
        }
        await insertLedger('cityride_allocation', cityAmount);

        // 6. Wallet Updates
        // Driver Wallet deduction
        if (driverId) {
            // Note: driverCommissionAmount is deducted upfront at ride acceptance. Avoid double-charging.
            // However, customerCommissionAmount is collected in cash by the driver and deducted at the end of the trip!
            if (customerCommissionAmount > 0) {
                await conn.query('UPDATE taxi_drivers SET wallet_balance = wallet_balance - ? WHERE id = ?', [customerCommissionAmount, driverId]);
                
                await conn.query(`
                    INSERT INTO wallet_transactions (driver_id, type, amount, note, updated_by, created_at)
                    VALUES (?, 'debit', ?, ?, 'System', NOW())
                `, [driverId, customerCommissionAmount, `Customer Platform Fee for Ride #B${bookingId}`]);
            }
        }

        // Association Wallet credit
        if (associationId && assocAmount > 0) {
            await conn.query(`
                INSERT INTO taxi_association_wallets (association_id, balance) 
                VALUES (?, ?) 
                ON DUPLICATE KEY UPDATE balance = balance + ?
            `, [associationId, assocAmount, assocAmount]);
            
            await conn.query(`
                INSERT INTO taxi_association_wallet_transactions (association_id, booking_id, driver_id, amount, type, note) 
                VALUES (?, ?, ?, ?, 'credit', ?)
            `, [associationId, bookingId, driverId, assocAmount, assocNote]);
        }

        await conn.commit();
        console.log(`[FINANCE] Settlement complete for B#${bookingId}`);
    } catch (err) {
        await conn.rollback();
        console.error(`[FINANCE ERROR] Settlement failed for B#${bookingId}:`, err);
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = { settleRideFinancials };
