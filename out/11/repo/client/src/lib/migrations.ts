import { Pack, PackSchema, EdgeTypeEnum } from "./schema/pack_v1";

export function migratePack(raw: any): Pack {
    // 1. Identity Check: If it's already V2 with valid shape, return as-is
    if (raw.schemaVersion === 2 && raw.timestamps && raw.packType) {
        return raw as Pack;
    }

    // 2. Migration V1 -> V2
    console.log(`Migrating pack ${raw.packId} from v${raw.schemaVersion || 1} to v2`);

    const migrationLog: string[] = raw.migrationLog || [];
    const now = new Date().toISOString();
    
    // --- Field Transformations ---
    
    // Timestamps: v1 uses flat createdAt/updatedAt, v2 uses nested timestamps object
    const timestamps = raw.timestamps || {
        created: raw.createdAt || now,
        updated: raw.updatedAt || now
    };
    
    // PackType: v1 might not have it, default to public_figure
    const packType = raw.packType || "public_figure";
    
    // SubjectName: v1 might use title, v2 uses subjectName
    const subjectName = raw.subjectName || raw.title || "Untitled Dossier";
    
    // --- Edge Migration ---
    let edges = raw.edges || [];
    if (edges.length > 0) {
        let remappedCount = 0;
        let fieldFixCount = 0;
        
        edges = edges.map((edge: any) => {
            const migratedEdge = { ...edge };
            
            // Field name migration: sourceId/targetId → fromEntityId/toEntityId
            if (edge.sourceId && !edge.fromEntityId) {
                migratedEdge.fromEntityId = edge.sourceId;
                delete migratedEdge.sourceId;
                fieldFixCount++;
            }
            if (edge.targetId && !edge.toEntityId) {
                migratedEdge.toEntityId = edge.targetId;
                delete migratedEdge.targetId;
                fieldFixCount++;
            }
            
            // Type validation
            const isValidType = EdgeTypeEnum.safeParse(migratedEdge.type).success;
            if (!isValidType) {
                console.warn(`[Migration] Remapping unknown edge type '${migratedEdge.type}' in edge ${migratedEdge.id}`);
                migratedEdge.notes = migratedEdge.notes 
                    ? `${migratedEdge.notes} (Original type: ${migratedEdge.type})` 
                    : `(Original type: ${migratedEdge.type})`;
                migratedEdge.type = "affiliated_with";
                remappedCount++;
            }
            
            return migratedEdge;
        });
        
        if (remappedCount > 0) {
            migrationLog.push(`${now}: Remapped ${remappedCount} edges with unknown types to 'affiliated_with'.`);
        }
        if (fieldFixCount > 0) {
            migrationLog.push(`${now}: Migrated ${fieldFixCount} edge field names (sourceId/targetId → fromEntityId/toEntityId).`);
        }
    }
    
    // --- Build V2 Pack ---
    const migrated = {
        packId: raw.packId,
        packType,
        schemaVersion: 2 as const,
        subjectName,
        timestamps,
        entities: raw.entities || [],
        edges,
        evidence: raw.evidence || [],
        claims: raw.claims || [],
        sourceExtractPackId: raw.sourceExtractPackId,
        migrationLog: migrationLog.length > 0 ? migrationLog : [`${now}: Migrated from v${raw.schemaVersion || 1} to v2.`]
    };

    // Validate Final Shape
    try {
        return PackSchema.parse(migrated);
    } catch (e) {
        console.error("Migration failed validation:", e);
        throw new Error(`Migration of pack ${raw.packId} failed validation: ${e}`);
    }
}
