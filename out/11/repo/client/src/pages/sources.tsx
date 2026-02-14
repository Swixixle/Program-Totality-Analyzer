import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, FileText } from "lucide-react";
import { apiGet } from "@/lib/auth";

interface Source {
  source_id: string;
  corpus_id: string;
  role: string;
  filename: string;
  uploaded_at: string;
  sha256_hex: string;
}

export default function Sources() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const corpusId = params.get("corpusId") || "corpus-demo-001";

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!corpusId) {
      setLoading(false);
      return;
    }

    const fetchSources = async () => {
      const result = await apiGet<{ sources: Source[] }>(`/api/corpus/${corpusId}/sources`);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSources(result.data.sources || []);
      }
      setLoading(false);
    };

    fetchSources();
  }, [corpusId]);

  if (!corpusId) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <p className="text-muted-foreground">No corpus_id provided.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">LANTERN</h1>
          </div>
          <p className="text-muted-foreground">Sources</p>
          <p className="text-xs font-mono text-muted-foreground mt-1" data-testid="corpus-id-display">
            corpus_id: {corpusId}
          </p>
        </header>

        {error && (
          <Card className="mb-6 border-red-500/30">
            <CardContent className="py-3 text-sm text-red-400">
              {error}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading sources...</p>
        ) : sources.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No sources in this corpus.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Corpus Sources ({sources.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="sources-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">role</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">filename</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">sha256_hex</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">uploaded_at</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">source_id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source) => (
                      <tr key={source.source_id} className="border-b border-border/50" data-testid={`source-row-${source.source_id}`}>
                        <td className="py-2 px-2">{source.role}</td>
                        <td className="py-2 px-2 truncate max-w-[150px]">{source.filename}</td>
                        <td className="py-2 px-2 font-mono text-xs truncate max-w-[180px]" title={source.sha256_hex}>
                          {source.sha256_hex.slice(0, 16)}...
                        </td>
                        <td className="py-2 px-2 text-xs">{new Date(source.uploaded_at).toLocaleString()}</td>
                        <td className="py-2 px-2 font-mono text-xs truncate max-w-[120px]" title={source.source_id}>
                          {source.source_id.slice(0, 8)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
