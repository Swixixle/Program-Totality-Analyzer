import { useParams } from "wouter";
import { Button } from "@/components/ui/button";

export default function ReviewAuditLines() {
  const params = useParams<{ corpusId: string }>();
  const corpusId = params.corpusId;

  return (
    <div className="container max-w-2xl mx-auto py-16 px-4" data-testid="audit-lines-page">
      <h1 className="text-2xl font-bold mb-6" data-testid="audit-lines-title">
        Audit Lines
      </h1>
      
      <div className="mb-8">
        <p className="text-sm text-muted-foreground mb-1">Corpus ID:</p>
        <code className="text-sm bg-muted px-2 py-1 rounded" data-testid="audit-lines-corpus-id">
          {corpusId}
        </code>
      </div>
      
      <a href={`/api/review/${corpusId}/audit_lines`} download="audit_lines.txt">
        <Button data-testid="download-audit-lines-button">
          Download audit_lines.txt
        </Button>
      </a>
    </div>
  );
}
