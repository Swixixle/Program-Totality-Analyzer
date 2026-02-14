import { useEffect, useState } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, Layers, AlertTriangle, HelpCircle, Clock } from "lucide-react";
import { MOCK_CONSTRAINTS, type ConstraintItem, type ConstraintType } from "@/lib/schema/constraints";
import { apiGet } from "@/lib/auth";

function ConstraintCard({ item }: { item: ConstraintItem }) {
  const [, navigate] = useLocation();

  const handleViewEvidence = () => {
    if (item.anchor_ids.length > 0) {
      navigate(`/anchors?ids=${item.anchor_ids.join(",")}`);
    }
  };

  const typeLabels: Record<ConstraintType, string> = {
    CONFLICT: "Conflict",
    MISSING_EVIDENCE: "Missing Evidence",
    TIME_MISMATCH: "Time Mismatch"
  };

  return (
    <Card 
      className={`border-l-4 ${
        item.type === "CONFLICT" ? "border-l-red-500" :
        item.type === "MISSING_EVIDENCE" ? "border-l-amber-500" :
        "border-l-blue-500"
      }`}
      data-testid={`constraint-${item.id}`}
    >
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Badge variant="outline" className="text-xs mb-2">
              {typeLabels[item.type]}
            </Badge>
            <p className="text-sm mb-3">{item.summary}</p>

            {item.type === "CONFLICT" && item.conflict && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-2 bg-muted/30 rounded text-xs">
                  <p className="font-mono text-muted-foreground mb-1">{item.conflict.left.anchor_id}</p>
                  <p>{item.conflict.left.source_document}</p>
                  <p className="text-muted-foreground">{item.conflict.left.page_ref}</p>
                </div>
                <div className="p-2 bg-muted/30 rounded text-xs">
                  <p className="font-mono text-muted-foreground mb-1">{item.conflict.right.anchor_id}</p>
                  <p>{item.conflict.right.source_document}</p>
                  <p className="text-muted-foreground">{item.conflict.right.page_ref}</p>
                </div>
              </div>
            )}

            {item.type === "MISSING_EVIDENCE" && item.missing && (
              <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
                <p className="font-semibold mb-1">{item.missing.requested_assertion}</p>
                <p className="text-muted-foreground">{item.missing.reason}</p>
              </div>
            )}

            {item.type === "TIME_MISMATCH" && item.time_context && (
              <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
                <div className="flex gap-4 mb-2">
                  {item.time_context.earlier_date && (
                    <span>Earlier: {item.time_context.earlier_date}</span>
                  )}
                  {item.time_context.later_date && (
                    <span>Later: {item.time_context.later_date}</span>
                  )}
                </div>
                <p className="text-muted-foreground">{item.time_context.note}</p>
              </div>
            )}

            {item.anchor_ids.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground italic">
                No anchors are available for this item in the current corpus.
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleViewEvidence}
              disabled={item.anchor_ids.length === 0}
              className="text-xs"
              data-testid={`view-evidence-${item.id}`}
            >
              <Eye className="w-3 h-3 mr-1" />
              View Evidence
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConstraintSection({
  title,
  icon,
  items,
  emptyMessage
}: {
  title: string;
  icon: React.ReactNode;
  items: ConstraintItem[];
  emptyMessage: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
        {icon}
        {title}
        <Badge variant="secondary" className="ml-2 text-xs">{items.length}</Badge>
      </h2>

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ConstraintCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Constraints() {
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const corpusId = params.get("corpusId") || "corpus-demo-001";

  const [constraints, setConstraints] = useState<ConstraintItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConstraints = async () => {
      const result = await apiGet<{ constraints: ConstraintItem[] }>(`/api/constraints?corpusId=${corpusId}`);
      if (result.ok) {
        setConstraints(result.data.constraints);
      } else {
        setConstraints(MOCK_CONSTRAINTS);
      }
      setLoading(false);
    };

    fetchConstraints();
  }, [corpusId]);

  const conflicts = constraints.filter(c => c.type === "CONFLICT");
  const missingEvidence = constraints.filter(c => c.type === "MISSING_EVIDENCE");
  const timeMismatches = constraints.filter(c => c.type === "TIME_MISMATCH");

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">LANTERN</h1>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-4" 
            data-testid="button-back"
            onClick={() => navigate(`/?corpusId=${corpusId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Claim Space
          </Button>

          <h2 className="text-lg font-semibold">Constraints & Friction</h2>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Corpus: {corpusId}
          </p>
        </header>

        {loading ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Loading constraints...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ConstraintSection
              title="Conflicts"
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
              items={conflicts}
              emptyMessage="No conflicts identified."
            />

            <ConstraintSection
              title="Missing Evidence"
              icon={<HelpCircle className="w-5 h-5 text-amber-500" />}
              items={missingEvidence}
              emptyMessage="No missing evidence identified."
            />

            <ConstraintSection
              title="Time Mismatches"
              icon={<Clock className="w-5 h-5 text-blue-500" />}
              items={timeMismatches}
              emptyMessage="No time mismatches identified."
            />
          </>
        )}

        <footer className="mt-12 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
          <p>No resolutions. No rankings. No conclusions.</p>
        </footer>
      </div>
    </div>
  );
}
