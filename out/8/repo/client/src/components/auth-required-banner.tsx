import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface AuthRequiredBannerProps {
  title?: string;
}

export function AuthRequiredBanner({ title }: AuthRequiredBannerProps) {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {title && <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">{title}</h1>}
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-destructive font-medium" data-testid="text-auth-error">Missing/invalid API key</p>
          <p className="text-sm text-muted-foreground mt-2" data-testid="text-auth-hint">
            Private endpoints require a valid API key
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function isAuthError(error: unknown): boolean {
  const msg = (error as Error)?.message || "";
  return msg.startsWith("401:") || msg.startsWith("403:");
}
