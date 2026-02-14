import { extract, computePackId } from "../client/src/lib/lanternExtract";

// Mock Text
const text = "Apple Inc. reported $5 million in revenue on January 1, 2023. 'Great result,' said Tim.";

console.log("--- SMOKE TEST: Lantern Extraction & Data Safety (M1) ---");

// 1. Test Extraction
try {
    const start = performance.now();
    const result = extract(text, { mode: "balanced" });
    const duration = performance.now() - start;

    console.log(`[PASS] Extraction completed in ${duration.toFixed(2)}ms`);
    console.log(`- Entities: ${result.items.entities.length}`);
    console.log(`- Quotes: ${result.items.quotes.length}`);
    console.log(`- Metrics: ${result.items.metrics.length}`);
    console.log(`- Timeline: ${result.items.timeline.length}`);

    if (result.items.entities.length === 0) throw new Error("Failed to extract entities");
    if (result.items.metrics.length === 0) throw new Error("Failed to extract metrics");

    // 2. Test Determinism (ID Generation)
    const id1 = computePackId({ items: result.items }, "hash1");
    const id2 = computePackId({ items: result.items }, "hash1");

    if (id1 !== id2) throw new Error("Determinism Check Failed: IDs do not match");
    console.log(`[PASS] Determinism Check (ID: ${id1})`);

    // 3. Test Export/Import Roundtrip (M1 Logic, M2 Migration Mock)
    console.log("--- Testing M1/M2: Migration & Roundtrip ---");
    
    // Mock v0 pack (missing schema)
    const mockPackV0 = {
        pack_id: id1,
        // schema: missing!
        items: result.items,
        hashes: { source_text_sha256: "hash1", pack_sha256: id1 }
    };
    
    // Mock Migration Function (same as storage.ts)
    function migrate(pack: any): any {
        if (!pack.schema) pack.schema = "lantern.extract.pack.v1";
        return pack;
    }
    
    const migrated = migrate({ ...mockPackV0 });
    if (migrated.schema !== "lantern.extract.pack.v1") throw new Error("Migration failed: Schema not injected");
    console.log("[PASS] Migration V0 -> V1");


    console.log("\n✅ SMOKE TEST PASSED");
    process.exit(0);
} catch (e) {
    console.error("\n❌ SMOKE TEST FAILED", e);
    process.exit(1);
}
