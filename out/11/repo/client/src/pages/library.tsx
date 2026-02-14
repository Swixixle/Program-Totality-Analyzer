import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { persistence, isExtractPack, isDossierPack, type AnyPack } from "@/lib/storage";
import type { LanternPack } from "@/lib/lanternExtract";
import type { Pack } from "@/lib/schema/pack_v1";
import { FileText, Search, GitCompare, Plus, FolderOpen, Clock, Layers } from "lucide-react";

export default function Library() {
  const [packs, setPacks] = useState<AnyPack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    persistence.loadLibrary().then((lib) => {
      if (lib) setPacks(lib.packs);
      setLoading(false);
    });
  }, []);

  const extractPacks = packs.filter(isExtractPack) as LanternPack[];
  const dossierPacks = packs.filter(isDossierPack) as Pack[];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-cyan-500/30">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-app-title">
              LANTERN
            </h1>
          </div>
          <p className="text-muted-foreground text-lg mt-2">
            Evidentiary Record System
          </p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            Record claims. Link evidence. Inspect heuristic boundaries. Export audit artifacts.
          </p>
        </header>

        <section className="grid md:grid-cols-3 gap-4 mb-12">
          <Link href="/extract">
            <Card className="cursor-pointer hover:border-cyan-500/50 transition-colors group" data-testid="card-new-extract">
              <CardHeader className="pb-2">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-2 group-hover:bg-cyan-500/20 transition-colors">
                  <Plus className="w-5 h-5 text-cyan-500" />
                </div>
                <CardTitle className="text-lg">New Extract</CardTitle>
                <CardDescription>Extract entities, quotes, and timeline from text</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/compare">
            <Card className="cursor-pointer hover:border-purple-500/50 transition-colors group" data-testid="card-compare">
              <CardHeader className="pb-2">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2 group-hover:bg-purple-500/20 transition-colors">
                  <GitCompare className="w-5 h-5 text-purple-500" />
                </div>
                <CardTitle className="text-lg">Compare Dossiers</CardTitle>
                <CardDescription>Cross-reference packs. Verify structural alignment.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Card className="border-dashed opacity-60" data-testid="card-quick-stats">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-2">
                <Layers className="w-5 h-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg">Library Stats</CardTitle>
              <CardDescription>
                {extractPacks.length} extracts, {dossierPacks.length} dossiers
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-500" />
              Extract Packs
            </h2>
            <Badge variant="outline" className="text-xs">
              schema: lantern.extract.pack.v1
            </Badge>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : extractPacks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No extract packs yet.</p>
                <Link href="/extract">
                  <Button variant="link" className="mt-2">Create your first extract</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {extractPacks.map((pack) => (
                <Link key={pack.pack_id} href="/extract">
                  <Card className="cursor-pointer hover:border-cyan-500/30 transition-colors" data-testid={`card-extract-${pack.pack_id}`}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{pack.source.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {pack.source.retrieved_at}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {pack.items.entities.length} entities
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Dossier Packs
            </h2>
            <Badge variant="outline" className="text-xs">
              schemaVersion: 2
            </Badge>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : dossierPacks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No dossier packs yet.</p>
                <p className="text-sm mt-1">Promote an extract to create a dossier.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {dossierPacks.map((pack) => (
                <Card key={pack.packId} className="hover:border-amber-500/30 transition-colors" data-testid={`card-dossier-${pack.packId}`}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{pack.subjectName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {pack.timestamps.updated}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {pack.entities.length} entities
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {pack.claims.length} claims
                      </Badge>
                      <Link href={`/dossier/${pack.packId}`}>
                        <Button variant="outline" size="sm" data-testid={`button-edit-${pack.packId}`}>
                          <FolderOpen className="w-4 h-4 mr-1" />
                          Open
                        </Button>
                      </Link>
                      <Link href={`/dossier/${pack.packId}/report`}>
                        <Button variant="outline" size="sm" data-testid={`button-report-${pack.packId}`}>
                          Report
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-16 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
          <p>Lantern v1.0 — Evidentiary Record System</p>
          <p className="mt-1">Hybrid execution: packs persist locally; large extracts run as durable server jobs.</p>
        </footer>
      </div>
    </div>
  );
}
