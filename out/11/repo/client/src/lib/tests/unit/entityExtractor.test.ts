
import { describe, it, expect } from 'vitest';
import { extractEntities } from '../../heuristics/entities/entityExtractor';
import { normalizeEntity } from '../../heuristics/entities/entityCanonicalizer';

describe('Entity Extraction & Tiering', () => {

    it('Should normalize corporate suffixes correctly', () => {
        expect(normalizeEntity("Apple, Inc.")).toBe("Apple Inc");
        expect(normalizeEntity("Microsoft Corp.")).toBe("Microsoft Corp"); 
        expect(normalizeEntity("Google, LLC")).toBe("Google LLC");
    });

    it('Should extract PRIMARY entities (Legal Suffix)', () => {
        const text = "I visited Apple, Inc. yesterday.";
        const entities = extractEntities(text);
        const apple = entities.find(e => e.canonical === "Apple Inc");
        
        expect(apple).toBeDefined();
        expect(apple?.tier).toBe("PRIMARY");
        expect(apple?.text).toBe("Apple, Inc."); // Exact substring
    });

    it('Should extract PRIMARY entities (Multi-token)', () => {
        const text = "New York City is big.";
        const entities = extractEntities(text);
        const nyc = entities.find(e => e.canonical === "New York City");
        
        expect(nyc?.tier).toBe("PRIMARY");
    });

    it('Should handle repeated acronyms as PRIMARY/SECONDARY', () => {
        const text = "NASA is cool. NASA goes to space.";
        const entities = extractEntities(text);
        
        expect(entities.length).toBe(2);
        expect(entities[0].canonical).toBe("NASA");
        expect(entities[0].tier).toBe("PRIMARY"); // Acronym + Repeated
        expect(entities[1].tier).toBe("PRIMARY");
    });

    it('Should classify single sentence-initial common words as NOISE', () => {
        const text = "There is a cat. When is it?";
        const entities = extractEntities(text);
        
        const there = entities.find(e => e.text === "There");
        const when = entities.find(e => e.text === "When");
        
        if (there) expect(there.tier).toBe("NOISE");
        if (when) expect(when.tier).toBe("NOISE");
    });

    it('Should tier repeated sentence-initial words as NOISE (unless whitelisted)', () => {
        const text = "However, I went. However, I stayed.";
        const entities = extractEntities(text);
        
        const however = entities.filter(e => e.canonical === "However");
        if (however.length > 0) {
            expect(however[0].tier).toBe("NOISE");
        }
    });

    it('Should respect offsets exactly', () => {
        const text = "Hello World";
        //            01234567890
        const entities = extractEntities(text);
        
        expect(entities[0].text).toBe("Hello World");
        expect(entities[0].start).toBe(0);
        expect(entities[0].end).toBe(11);
    });
    
    it('Should handle "Apple" vs "Apple, Inc."', () => {
        const text = "Apple is great. Apple, Inc. is the company.";
        const entities = extractEntities(text);
        
        const apple = entities.find(e => e.text === "Apple");
        const appleInc = entities.find(e => e.text === "Apple, Inc.");
        
        expect(apple).toBeDefined();
        expect(appleInc).toBeDefined();
        expect(appleInc?.tier).toBe("PRIMARY");
    });

    // --- GAP CLOSURE TESTS ---

    it('Should generate consistent entity_ids from canonicals', () => {
        const text = "Apple, Inc. vs Apple Inc.";
        const entities = extractEntities(text);
        
        const e1 = entities[0]; // Apple, Inc.
        const e2 = entities[1]; // Apple Inc.
        
        // Assert Canonicals Match
        expect(e1.canonical).toBe("Apple Inc");
        expect(e2.canonical).toBe("Apple Inc");
        
        // Assert IDs Match
        expect(e1.entity_id).toBe(e2.entity_id);
    });

    it('Should generate different entity_ids for different canonicals', () => {
        const text = "Apple Inc. vs Microsoft Corp.";
        const entities = extractEntities(text);
        
        expect(entities[0].entity_id).not.toBe(entities[1].entity_id);
    });
});
