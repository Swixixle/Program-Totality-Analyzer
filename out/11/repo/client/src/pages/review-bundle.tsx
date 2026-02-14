import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function ReviewBundle() {
  const params = useParams<{ corpusId: string }>();
  const corpusId = params.corpusId;

  const downloadUrl = `/api/review/${corpusId}/bundle?deterministic=true`;

  return (
    <div className="container max-w-2xl mx-auto py-16 px-4" data-testid="review-bundle-page">
      <h1 className="text-2xl font-bold mb-6" data-testid="review-bundle-title">
        Download Corpus Bundle
      </h1>
      
      <div className="mb-6">
        <p className="text-sm text-muted-foreground mb-2">Corpus ID:</p>
        <code className="text-sm bg-muted px-2 py-1 rounded" data-testid="review-bundle-corpus-id">
          {corpusId}
        </code>
      </div>
      
      <a href={downloadUrl} data-testid="review-bundle-download-link">
        <Button data-testid="review-bundle-download-button">
          <Download className="w-4 h-4 mr-2" />
          Download Deterministic Bundle (ZIP)
        </Button>
      </a>
    </div>
  );
}
