import { useParams } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export default function Review() {
  const params = useParams<{ corpusId: string }>();
  const corpusId = params.corpusId;

  const { data: config } = useQuery({
    queryKey: ["/api/config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      return res.json();
    }
  });

  const isPublicReadOnly = config?.public_readonly === true;

  const buttons = [
    { label: "Claim Space", href: `/?corpusId=${corpusId}` },
    { label: "Sources", href: `/sources?corpusId=${corpusId}` },
    { label: "Anchors", href: `/anchors/browse?corpusId=${corpusId}` },
    { label: "Ledger", href: `/ledger?corpusId=${corpusId}` },
    { label: "Snapshots", href: `/snapshots?corpusId=${corpusId}` },
    { label: "Download Bundle", href: `/review/${corpusId}/bundle` },
    { label: "Audit Lines", href: `/review/${corpusId}/audit_lines` }
  ];

  return (
    <div className="container max-w-2xl mx-auto py-16 px-4" data-testid="review-landing-page">
      <h1 className="text-2xl font-bold mb-6" data-testid="review-title">
        Case Review
      </h1>
      
      <div className="mb-8">
        <p className="text-sm text-muted-foreground mb-1">Corpus ID:</p>
        <code className="text-sm bg-muted px-2 py-1 rounded" data-testid="review-corpus-id">
          {corpusId}
        </code>
      </div>

      {!isPublicReadOnly && (
        <p className="text-sm text-destructive mb-4" data-testid="review-disabled-text">
          Public review disabled
        </p>
      )}
      
      <div className="flex flex-col gap-3" data-testid="review-buttons">
        {buttons.map((btn, idx) => (
          isPublicReadOnly ? (
            <Link key={idx} href={btn.href} data-testid={`review-link-${idx}`}>
              <Button className="w-full justify-start" data-testid={`review-button-${idx}`}>
                {btn.label}
              </Button>
            </Link>
          ) : (
            <Button 
              key={idx} 
              className="w-full justify-start" 
              disabled 
              data-testid={`review-button-${idx}`}
            >
              {btn.label}
            </Button>
          )
        ))}
      </div>
    </div>
  );
}
