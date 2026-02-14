
import { extract } from '../lib/lanternExtract';
import fixtures from '../fixtures/metric_and_attribution_edge_cases.json';

// Simple script to run extraction on fixtures and report provenance stats
const run = () => {
    let totalItems = 0;
    let discardedCount = 0; // Hard to track internally without instrumentation, but we can check validity
    let invalidOffsets = 0;
    
    console.log("=== PROVENANCE REGRESSION METRICS ===");
    
    fixtures.forEach((fixture: any) => {
        const { items, stats } = extract(fixture.text, { mode: 'balanced' });
        
        const allItems = [
            ...items.entities,
            ...items.quotes,
            ...items.metrics,
            ...items.timeline
        ];
        
        allItems.forEach(item => {
            totalItems++;
            if (item.provenance.start < 0 || item.provenance.end < 0 || item.provenance.end < item.provenance.start) {
                invalidOffsets++;
            }
            // Check if ID is stable
            // We can't re-compute hash easily here without logic duplication, 
            // but we assume unit tests cover that.
        });
        
        discardedCount += stats.invalid_dropped;
    });
    
    console.log(`Total Items Extracted: ${totalItems}`);
    console.log(`Discarded (Invalid/No Offset): ${discardedCount}`);
    console.log(`Items with Invalid Offsets in Output: ${invalidOffsets} (Should be 0)`);
    console.log(`Precision/Recall: See Quality Dashboard for semantic accuracy.`);
};

run();
