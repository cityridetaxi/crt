const { calculateCanonicalFare, resolveRideCategory, calculateLocalSlabFare, getPeakMultiplier } = require('./pricingEngine');

// Mock Database
class MockDB {
    constructor() {
        this.queries = [];
    }
    async query(sql, params) {
        this.queries.push({ sql, params });
        
        if (sql.includes("taxi_settings")) {
            return [[
                { setting_key: 'classification_mode', setting_value: 'AUTOMATIC' },
                { setting_key: 'local_threshold_km', setting_value: '100' },
                { setting_key: 'local_enabled', setting_value: 'true' },
                { setting_key: 'outstation_enabled', setting_value: 'true' }
            ]];
        }
        if (sql.includes("taxi_commission_configs")) {
            return [[
                { 
                    status: 'active', 
                    customer_commission_type: 'percent',
                    customer_commission_percent: '10',
                    customer_commission_fixed: '0'
                }
            ]];
        }
        if (sql.includes("taxi_vendor_tariffs")) return [[]];
        if (sql.includes("taxi_tariffs")) {
            const category = params[1];
            if (category === 'local') {
                return [[
                    {
                        config: JSON.stringify({
                            base: 150,
                            minKm: 0,
                            slab1_rate: 30,
                            slab2_rate: 28,
                            slab3_rate: 26,
                            slab4_rate: 24,
                            slab5_rate: 22,
                            slab6_rate: 20,
                            slab7_rate: 18,
                            slab8_rate: 16,
                            slab9_rate: 15,
                            slab10_rate: 14,
                            slab11_rate: 13,
                            above100_rate: 13
                        })
                    }
                ]];
            }
            if (category === 'oneway') {
                return [[
                    {
                        config: JSON.stringify({
                            base: 0, perKm: 13, minKm: 130
                        })
                    }
                ]];
            }
            if (category === 'round') {
                return [[
                    {
                        config: JSON.stringify({
                            base: 0, perKm: 12, minKmPerDay: 250
                        })
                    }
                ]];
            }
            return [[]];
        }
        if (sql.includes("taxi_peak_rules")) {
            return [[
                {
                    is_active: 1,
                    start_time: '09:00',
                    end_time: '18:00',
                    surcharge_percentage: 25
                }
            ]];
        }
        if (sql.includes("taxi_special_location_charges")) {
            return [[
                { surcharge_percentage: 10 }
            ]];
        }
        return [[]];
    }
}

async function runTests() {
    const db = new MockDB();
    let passed = 0;
    let failed = 0;

    function assertEqual(name, actual, expected, epsilon = 0.01) {
        if (Math.abs(actual - expected) <= epsilon) {
            console.log(`✅ PASS: ${name}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${name} (Expected ${expected}, got ${actual})`);
            failed++;
        }
    }

    function assertDeepEqual(name, actual, expected) {
        if (actual === expected) {
            console.log(`✅ PASS: ${name}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${name} (Expected ${expected}, got ${actual})`);
            failed++;
        }
    }

    console.log("--- TESTING resolveRideCategory ---");
    assertDeepEqual("resolveRideCategory 99.9 km", await resolveRideCategory(db, 99.9, 'unknown'), 'local');
    assertDeepEqual("resolveRideCategory 100 km", await resolveRideCategory(db, 100, 'unknown'), 'oneway');
    assertDeepEqual("resolveRideCategory 100.1 km", await resolveRideCategory(db, 100.1, 'unknown'), 'oneway');
    
    // Manual overrides
    db.query = async (sql) => {
        if (sql.includes("taxi_settings")) return [[{ setting_key: 'classification_mode', setting_value: 'MANUAL' }]];
        return [[]];
    };
    assertDeepEqual("resolveRideCategory MANUAL round", await resolveRideCategory(db, 10, 'round'), 'round');
    
    // Reset DB mock for next tests
    const normalDB = new MockDB();

    console.log("\n--- TESTING calculateLocalSlabFare ---");
    const localConfig = JSON.parse((await normalDB.query("taxi_tariffs", ['sedan', 'local']))[0][0].config);
    // 0km -> base 150
    assertEqual("Slab 0km", calculateLocalSlabFare(0, localConfig), 150);
    // 3km -> 3 * 30 = 90 (max with base 150) -> 150
    assertEqual("Slab 3km", calculateLocalSlabFare(3, localConfig), 150);
    // 5km -> 5 * 30 = 150
    assertEqual("Slab 5km", calculateLocalSlabFare(5, localConfig), 150);
    // 10km -> 150 + 5*28=140 = 290
    assertEqual("Slab 10km", calculateLocalSlabFare(10, localConfig), 290);
    // 100km -> 5*30 + 5*28 + 10*26 + 10*24 + 10*22 + 10*20 + 10*18 + 10*16 + 10*15 + 10*14 + 10*13 = 1970
    assertEqual("Slab 100km", calculateLocalSlabFare(100, localConfig), 1970);
    // 120km -> 1970 + 20*13 = 2230
    assertEqual("Slab 120km", calculateLocalSlabFare(120, localConfig), 2230);

    console.log("\n--- TESTING calculateCanonicalFare - Oneway ---");
    // Oneway 338km (User's issue)
    const onewayRes = await calculateCanonicalFare(normalDB, {
        distanceKm: 338,
        durationMins: 300,
        vehicleType: 'sedan',
        category: 'oneway',
        pickupTime: new Date("2026-09-15T02:00:00Z"), // outside peak
        extraDrops: '[]'
    });
    // Expected distance fare: 100km slab = 1970, 238km * 13 = 3094 -> 5064
    // BaseKmFare = 5064.
    // Driver Allowance = 600 (since > 250km).
    // Subtotal = 5064 + 600 = 5664.
    // Platform fee = 10% of 5664 = 566.4
    // Final = ceil(5664 + 566.4) = 6231
    assertEqual("Oneway baseKmFare", onewayRes.baseKmFare, 4394);
    assertEqual("Oneway driverAllowance", onewayRes.driverAllowance, 600);
    assertEqual("Oneway subtotal", onewayRes.subtotal, 4994);
    assertEqual("Oneway platformFee", onewayRes.platformFee, 499.4);
    assertEqual("Oneway finalFare", onewayRes.finalFare, 5494);

    console.log("\n--- TESTING calculateCanonicalFare - Local Waiting ---");
    // 10 km -> 290. Allowed mins = 10*2 = 20. 
    // Duration 21 -> 1 min excess -> 2 waiting charge.
    const localWaitRes = await calculateCanonicalFare(normalDB, {
        distanceKm: 10,
        durationMins: 21,
        vehicleType: 'sedan',
        category: 'local',
        pickupTime: new Date("2026-09-15T02:00:00Z"),
        extraDrops: '[]'
    });
    assertEqual("Local waiting 1min", localWaitRes.waitingCharge, 2);

    console.log("\n--- TESTING Input Validation ---");
    const nanRes = await calculateCanonicalFare(normalDB, {
        distanceKm: -5,
        durationMins: NaN,
        vehicleType: 'sedan',
        category: 'local'
    });
    assertEqual("Negative distance clamped to 0", nanRes.baseKmFare, 150);
    assertEqual("NaN duration clamped to 0 waiting", nanRes.waitingCharge, 0);

    console.log(`\nRESULTS: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
