import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, Check, Lock, Unlock, Link as LinkIcon, Eye, EyeOff, FileText } from "lucide-react";
import { ForbiddenCapabilitiesList } from "@/ui/halo/forbidden-capabilities-list";

interface HaloHeaderProps {
  killSwitchEngaged: boolean;
  verificationStatus: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | null;
  transcriptMode: "full" | "redacted" | "hidden";
  eventLogHash?: string;
}

const IMPLEMENTED_CAPABILITIES = [
  "Hash verification",
  "Forensic detectors",
  "Forensic export",
  "Signature verification",
  "Chain verification",
  "Key governance",
  "Public verification",
  "Rate limiting",
  "API authentication",
  "Research export",
  "LLM sensor (observer-only)",
];

export function HaloHeader({
  killSwitchEngaged,
  verificationStatus,
  transcriptMode,
  eventLogHash,
}: HaloHeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    if (eventLogHash) {
      navigator.clipboard.writeText(eventLogHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncateHash = (hash: string) => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const getVerificationBadge = () => {
    switch (verificationStatus) {
      case "VERIFIED":
        return <Badge className="bg-green-600" data-testid="halo-badge-verified">VERIFIED</Badge>;
      case "PARTIALLY_VERIFIED":
        return <Badge className="bg-yellow-600" data-testid="halo-badge-partial">PARTIALLY VERIFIED</Badge>;
      case "UNVERIFIED":
        return <Badge variant="destructive" data-testid="halo-badge-unverified">UNVERIFIED</Badge>;
      default:
        return <Badge variant="secondary" data-testid="halo-badge-none">—</Badge>;
    }
  };

  const getTranscriptModeIcon = () => {
    switch (transcriptMode) {
      case "full":
        return <Eye className="w-3 h-3" />;
      case "redacted":
        return <FileText className="w-3 h-3" />;
      case "hidden":
        return <EyeOff className="w-3 h-3" />;
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-background border-b px-4 py-2" data-testid="halo-header">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Block 1: Kill Switch Status */}
        <div className="flex flex-col items-start" data-testid="halo-kill-switch">
          <div className="flex items-center gap-1.5">
            {killSwitchEngaged ? (
              <>
                <Lock className="w-4 h-4 text-destructive" />
                <Badge variant="destructive">KILL SWITCH: ENGAGED</Badge>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 text-muted-foreground" />
                <Badge variant="outline">KILL SWITCH: OFF</Badge>
              </>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            Interpretation and sensor outputs are disabled when the kill switch is engaged.
          </span>
        </div>

        {/* Block 2: Verification Status */}
        <div className="flex flex-col items-start" data-testid="halo-verification">
          {getVerificationBadge()}
          <span className="text-[10px] text-muted-foreground mt-0.5">
            This status reflects cryptographic and chain checks only.
          </span>
        </div>

        {/* Block 3: Capability Matrix */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="halo-capability-link">
              <LinkIcon className="w-3 h-3" />
              View full capability matrix
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Capability Matrix</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <h4 className="font-medium mb-2 text-green-600">Implemented</h4>
                <ul className="text-sm space-y-1" data-testid="list-implemented">
                  {IMPLEMENTED_CAPABILITIES.map((cap) => (
                    <li key={cap} className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-600" />
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-destructive">Forbidden</h4>
                <ForbiddenCapabilitiesList className="text-sm space-y-1" />
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Block 4: Transcript Mode */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5" data-testid="halo-transcript-mode">
              {getTranscriptModeIcon()}
              <Badge variant="outline" className="text-xs">
                {transcriptMode.toUpperCase()}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-xs">
              Transcript mode controls rendering only. Raw transcripts are never persisted.
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Block 5: Event Log Integrity */}
        {eventLogHash && (
          <div className="flex items-center gap-1.5 ml-auto" data-testid="halo-event-log">
            <span className="text-xs text-muted-foreground">Event log: hash-chained</span>
            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
              {truncateHash(eventLogHash)}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={copyHash}
              data-testid="button-copy-hash"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
