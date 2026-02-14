import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, MessageCircle, Send, User, Bot, Play } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

const DEMO_RECEIPT_ID = "halo-demo-receipt-001";

interface ThreadMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface FollowupResponse {
  status: string;
  threadId: string;
  receiptId: string;
  verification_status: string;
  messages: ThreadMessage[];
}

interface BlockedResponse {
  status: "blocked";
  reason: string;
  verification_status?: string;
}

export default function Lantern() {
  const [receiptId, setReceiptId] = useState("");
  const [userText, setUserText] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [blockedInfo, setBlockedInfo] = useState<BlockedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTryDemo = async () => {
    try {
      await fetch("/api/demo/seed", { method: "POST" });
      setReceiptId(DEMO_RECEIPT_ID);
      setActiveThreadId(null);
      setActiveReceiptId(null);
      setBlockedInfo(null);
      setError(null);
    } catch {
      setError("Failed to load demo receipt");
    }
  };

  const messagesQuery = useQuery<{ threadId: string; receiptId: string; messages: ThreadMessage[] }>({
    queryKey: ["/api/lantern/thread", activeThreadId, "messages"],
    queryFn: async () => {
      if (!activeThreadId) throw new Error("No thread");
      const res = await fetch(`/api/lantern/thread/${activeThreadId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!activeThreadId,
  });

  const followupMutation = useMutation({
    mutationFn: async (body: { receiptId: string; userText: string; threadId?: string }) => {
      const res = await fetch("/api/lantern/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 403) {
        throw Object.assign(new Error(data.reason || "Blocked"), { blocked: data as BlockedResponse });
      }
      if (!res.ok) {
        throw new Error(data.error?.message || "Request failed");
      }
      return data as FollowupResponse;
    },
    onSuccess: (data) => {
      setActiveThreadId(data.threadId);
      setActiveReceiptId(data.receiptId);
      setBlockedInfo(null);
      setError(null);
      setUserText("");
      queryClient.invalidateQueries({ queryKey: ["/api/lantern/thread", data.threadId, "messages"] });
    },
    onError: (err: any) => {
      if (err.blocked) {
        setBlockedInfo(err.blocked);
        setError(null);
      } else {
        setError(err.message);
        setBlockedInfo(null);
      }
    },
  });

  const handleSubmit = () => {
    if (!receiptId.trim() || !userText.trim()) return;
    setError(null);
    setBlockedInfo(null);
    followupMutation.mutate({
      receiptId: receiptId.trim(),
      userText: userText.trim(),
      ...(activeThreadId ? { threadId: activeThreadId } : {}),
    });
  };

  const handleNewThread = () => {
    setActiveThreadId(null);
    setActiveReceiptId(null);
    setBlockedInfo(null);
    setError(null);
    setUserText("");
  };

  const messages = messagesQuery.data?.messages ?? [];
  const displayMessages = followupMutation.data?.messages ?? messages;

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <MessageCircle className="w-6 h-6" />
        <h1 className="text-2xl font-bold" data-testid="text-lantern-title">Lantern</h1>
        <Badge variant="secondary" data-testid="badge-proof-gated">Proof-Gated</Badge>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Ask questions about verified receipts. Lantern only responds when the receipt passes all integrity checks.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Start or Continue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="lantern-receipt-id">Receipt ID</Label>
            <div className="flex items-center gap-2">
              <Input
                id="lantern-receipt-id"
                data-testid="input-lantern-receipt-id"
                placeholder="Enter a verified receipt ID"
                value={receiptId}
                onChange={(e) => setReceiptId(e.target.value)}
                className="font-mono flex-1"
                disabled={!!activeThreadId}
              />
              {!activeThreadId && (
                <Button
                  variant="outline"
                  onClick={handleTryDemo}
                  data-testid="button-lantern-try-demo"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Try Demo
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="lantern-user-text">Your Question</Label>
            <Textarea
              id="lantern-user-text"
              data-testid="input-lantern-user-text"
              placeholder="Ask about this receipt..."
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleSubmit}
              disabled={!receiptId.trim() || !userText.trim() || followupMutation.isPending}
              data-testid="button-lantern-send"
            >
              <Send className="w-4 h-4 mr-2" />
              {followupMutation.isPending ? "Sending..." : "Send"}
            </Button>
            {activeThreadId && (
              <Button variant="outline" onClick={handleNewThread} data-testid="button-lantern-new-thread">
                New Thread
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {blockedInfo && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive" data-testid="text-lantern-blocked">
              <ShieldAlert className="w-5 h-5" />
              <span className="font-medium">Proof Gate: Blocked</span>
            </div>
            <p className="mt-2 text-sm">{blockedInfo.reason}</p>
            {blockedInfo.verification_status && (
              <p className="text-xs text-muted-foreground mt-1">
                Status: {blockedInfo.verification_status}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm" data-testid="text-lantern-error">{error}</p>
          </CardContent>
        </Card>
      )}

      {activeThreadId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <Shield className="w-4 h-4 text-green-600" />
              Thread
              <span className="font-mono text-xs text-muted-foreground">{activeThreadId.slice(0, 8)}...</span>
              {activeReceiptId && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-thread-receipt">
                  {activeReceiptId}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4" data-testid="lantern-messages">
              {displayMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "assistant" ? "bg-muted/50 rounded-md p-3" : "p-3"}`}
                  data-testid={`message-${msg.role}-${msg.id}`}
                >
                  <div className="shrink-0 mt-0.5">
                    {msg.role === "user" ? (
                      <User className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {msg.role === "user" ? "You" : "Lantern"}
                    </p>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
