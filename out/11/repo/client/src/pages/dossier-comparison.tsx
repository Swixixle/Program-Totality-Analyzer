import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { generateComparisonMarkdown } from "@/lib/comparison-export";
import { downloadFile } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, GitCompare, Users, ArrowRightLeft, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { computeReportHash, computeComparisonHash } from "@/lib/integrity";
import { computeInfluenceHubs } from "@/lib/heuristics/influenceHubs";
import { computeFundingGravity } from "@/lib/heuristics/fundingGravity";
import { computeEnforcementMap } from "@/lib/heuristics/enforcementMap";
import { CopyID } from "@/components/copy-id";
import { listPacks, loadPack, comparePacks, ComparisonResult } from "@/lib/comparison";

export default function DossierComparison() {
    const [, setLocation] = useLocation();
    const [packs, setPacks] = useState<{id: string, name: string}[]>([]);
    
    const [selectedIdA, setSelectedIdA] = useState<string>("");
    const [selectedIdB, setSelectedIdB] = useState<string>("");
    
    const [comparison, setComparison] = useState<ComparisonResult | null>(null);

    useEffect(() => {
        listPacks().then(list => setPacks(list));
    }, []);

    useEffect(() => {
        if (selectedIdA && selectedIdB && selectedIdA !== selectedIdB) {
            Promise.all([loadPack(selectedIdA), loadPack(selectedIdB)])
                .then(async ([packA, packB]) => {
                    if (packA && packB) {
                        const result = comparePacks(packA, packB);
                        
                        // M12: Compute Integrity Fingerprints
                        const heuristicsA = {
                            influence: computeInfluenceHubs(packA),
                            funding: computeFundingGravity(packA),
                            enforcement: computeEnforcementMap(packA)
                        };
                        const heuristicsB = {
                            influence: computeInfluenceHubs(packB),
                            funding: computeFundingGravity(packB),
                            enforcement: computeEnforcementMap(packB)
                        };
                        
                        const fingerprintA = await computeReportHash(packA, heuristicsA);
                        const fingerprintB = await computeReportHash(packB, heuristicsB);
                        
                        const comparisonHash = await computeComparisonHash(fingerprintA, fingerprintB, result);
                        result.fingerprint = comparisonHash;
                        
                        setComparison(result);
                    }
                });
        }
    }, [selectedIdA, selectedIdB]);

    const handleDownloadReport = () => {
        if (!comparison) return;
        const md = generateComparisonMarkdown(comparison);
        const filename = `Comparison_${comparison.packA.name.slice(0,10)}_${comparison.packB.name.slice(0,10)}.md`.replace(/\s+/g, "_");
        downloadFile(md, filename, "text/markdown");
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <header className="flex items-center justify-between pb-6 border-b border-gray-200">
                     <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
                        </Button>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <GitCompare className="w-6 h-6" /> Cross-Dossier Analysis
                        </h1>
                     </div>
                     <div className="flex gap-4 items-center">
                         {comparison && comparison.fingerprint && (
                             <div className="hidden md:block text-right">
                                 <div className="text-[10px] font-mono text-gray-400 uppercase">Comparison Fingerprint</div>
                                 <div className="text-xs font-mono font-bold text-gray-600 break-all max-w-[120px] truncate" title={comparison.fingerprint}>
                                     {comparison.fingerprint.slice(0, 16)}...
                                 </div>
                             </div>
                         )}
                         {comparison && (
                             <Button variant="outline" onClick={handleDownloadReport}>
                                 <Download className="w-4 h-4 mr-2" /> Download Report
                             </Button>
                         )}
                     </div>
                </header>

                {/* Selection Controls */}
                <Card>
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-500">Dossier A (Baseline)</label>
                            <Select value={selectedIdA} onValueChange={setSelectedIdA}>
                                <SelectTrigger className="font-serif text-lg">
                                    <SelectValue placeholder="Select Dossier A" />
                                </SelectTrigger>
                                <SelectContent>
                                    {packs.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2 border-l pl-8 border-gray-100">
                            <label className="text-xs font-bold uppercase text-gray-500">Dossier B (Comparison)</label>
                            <Select value={selectedIdB} onValueChange={setSelectedIdB}>
                                <SelectTrigger className="font-serif text-lg">
                                    <SelectValue placeholder="Select Dossier B" />
                                </SelectTrigger>
                                <SelectContent>
                                    {packs.filter(p => p.id !== selectedIdA).map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Comparison Results */}
                {comparison ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        
                        {/* High Level Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <Card className="bg-blue-50 border-blue-100">
                                <CardContent className="pt-6 text-center">
                                    <div className="text-4xl font-bold text-blue-900">{comparison.sharedEntities.length}</div>
                                    <div className="text-xs font-mono uppercase text-blue-700 mt-1">Shared Entities</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-purple-50 border-purple-100">
                                <CardContent className="pt-6 text-center">
                                    <div className="text-4xl font-bold text-purple-900">{(comparison.overlapScore * 100).toFixed(1)}%</div>
                                    <div className="text-xs font-mono uppercase text-purple-700 mt-1">Jaccard Overlap</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-gray-50 border-gray-200">
                                <CardContent className="pt-6 text-center">
                                    <div className="text-4xl font-bold text-gray-900">
                                        {comparison.commonHubs.length + comparison.commonFunders.length}
                                    </div>
                                    <div className="text-xs font-mono uppercase text-gray-600 mt-1">Structural Alignments</div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Shared Actors Table */}
                        <div className="grid md:grid-cols-2 gap-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Shared Entities
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {comparison.sharedEntities.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500 italic text-sm">No shared entities found.</div>
                                    ) : (
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                            {comparison.sharedEntities.map((match, i) => (
                                                <div key={i} className="flex justify-between items-center p-2 border-b border-gray-100 text-sm">
                                                    <span className="font-bold">{match.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] uppercase">
                                                            {match.confidence === "exact_id" ? "Exact ID" : "Name Match"}
                                                        </Badge>
                                                        {match.confidence !== "exact_id" && (
                                                            <span className="text-[10px] text-amber-600 font-bold" title="Verify identity manually">⚠️</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                                        <ArrowRightLeft className="w-4 h-4" /> Structural Alignment
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    
                                    {/* Common Funders */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase text-emerald-600 mb-2">Common Top Funders</h4>
                                        {comparison.heuristics.funding.statusA === "insufficient" || comparison.heuristics.funding.statusB === "insufficient" ? (
                                            <div className="text-xs text-gray-400 bg-gray-100 p-2 rounded border border-dashed">
                                                Analysis Unavailable: Insufficient data in one or both dossiers.
                                            </div>
                                        ) : comparison.commonFunders.length === 0 ? (
                                             <div className="text-xs text-gray-400 italic">No shared top funders.</div>
                                        ) : (
                                            comparison.commonFunders.map((c, i) => (
                                                <div key={i} className="flex justify-between text-sm p-2 bg-emerald-50 mb-1 rounded">
                                                    <span className="font-bold">{c.name}</span>
                                                    <span className="font-mono text-xs">Rank #{c.rankA} ↔ #{c.rankB}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Common Hubs */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase text-purple-600 mb-2">Common Influence Hubs</h4>
                                        {comparison.heuristics.influence.statusA === "insufficient" || comparison.heuristics.influence.statusB === "insufficient" ? (
                                            <div className="text-xs text-gray-400 bg-gray-100 p-2 rounded border border-dashed">
                                                Analysis Unavailable: Insufficient data in one or both dossiers.
                                            </div>
                                        ) : comparison.commonHubs.length === 0 ? (
                                             <div className="text-xs text-gray-400 italic">No shared influence hubs.</div>
                                        ) : (
                                            comparison.commonHubs.map((c, i) => (
                                                <div key={i} className="flex justify-between text-sm p-2 bg-purple-50 mb-1 rounded">
                                                    <span className="font-bold">{c.name}</span>
                                                    <span className="font-mono text-xs">Rank #{c.rankA} ↔ #{c.rankB}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white border border-dashed rounded-lg">
                        <div className="text-gray-400 mb-2">Select two dossiers to begin comparison</div>
                    </div>
                )}
            </div>
        </div>
    );
}
