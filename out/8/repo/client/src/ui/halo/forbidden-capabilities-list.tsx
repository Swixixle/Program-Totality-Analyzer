/**
 * ForbiddenCapabilitiesList - Component for displaying forbidden capabilities
 * 
 * Imports from forbidden-capabilities.ts which is the ONLY allowlisted location
 * for forbidden terms in UI copy.
 */

import { FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST } from "./forbidden-capabilities";

interface ForbiddenCapabilitiesListProps {
  className?: string;
}

export function ForbiddenCapabilitiesList({ className }: ForbiddenCapabilitiesListProps) {
  return (
    <ul className={className} data-testid="list-forbidden">
      {FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST.map((cap) => (
        <li key={cap} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-3 h-3 text-center">✕</span>
          {cap}
        </li>
      ))}
    </ul>
  );
}
