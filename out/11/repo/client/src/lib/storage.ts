import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { LanternPack } from "./lanternExtract";
import { Pack, PackSchema } from "./schema/pack_v1";
import { migratePack } from "./migrations";

// --- Types ---

// The Discriminated Union
export type AnyPack = LanternPack | Pack;

// Type Guards for robust discrimination
export function isExtractPack(p: AnyPack): p is LanternPack {
  return "schema" in p && p.schema === "lantern.extract.pack.v1";
}

export function isDossierPack(p: AnyPack): p is Pack {
  // Detect both v1 and v2 dossier packs (packId present + NOT an extract pack)
  return "packId" in p && !("schema" in p && (p as any).schema === "lantern.extract.pack.v1");
}

const DB_NAME = "lantern-db";
const DB_VERSION = 1;

export const SCHEMA_VERSION = 1;

// The core data shape
export type LibraryState = {
  packs: AnyPack[];
};

// The persistent record shape
export type PersistentRecord = {
  schemaVersion: number;
  updatedAt: string;
  library: LibraryState;
};

export type StorageStatus = "idle" | "saving" | "saved" | "error";

interface LanternDBSchema extends DBSchema {
  root: {
    key: string;
    value: PersistentRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<LanternDBSchema>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<LanternDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("root");
      },
    });
  }
  return dbPromise;
}

// Migration Stub
function migrate(record: any): PersistentRecord {
    // Identity migration for v1
    if (!record.schemaVersion) {
        return {
            schemaVersion: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            library: { packs: [] }
        };
    }
    return record as PersistentRecord;
}

export const persistence = {
  async loadLibrary(): Promise<LibraryState | null> {
    try {
      const db = await getDB();
      const record = await db.get("root", "main");
      
      if (!record) return null;
      
      // Migrate Persistence Record
      const migratedRecord = migrate(record);
      
      // Migrate Packs Content (V1 -> V2)
      const migratedPacks = migratedRecord.library.packs.map(p => {
          if (isDossierPack(p)) {
              return migratePack(p);
          }
          return p;
      });

      return { packs: migratedPacks };
    } catch (e) {
      console.error("Failed to load library:", e);
      return null;
    }
  },

  async saveLibrary(library: LibraryState): Promise<void> {
    const db = await getDB();
    const record: PersistentRecord = {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        library
    };
    await db.put("root", record, "main");
  },

  async clearLibrary(): Promise<void> {
    const db = await getDB();
    await db.clear("root");
  }
};

// --- Coalescing (Debounce) ---

let saveTimeout: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 1000;

export const debouncedSave = (
    library: LibraryState, 
    onStatus: (s: StorageStatus) => void
) => {
    onStatus("saving");
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
        try {
            await persistence.saveLibrary(library);
            onStatus("saved");
            setTimeout(() => onStatus("idle"), 2000);
        } catch (e) {
            console.error("Save failed:", e);
            onStatus("error");
        }
    }, DEBOUNCE_MS);
};
