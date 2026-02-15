/**
 * Portal URL builder for Replit deep linking
 * Works across local dev, Replit preview, and deployed domains
 */
export function getPortalUrl(path: string): string {
  const base = window.location.origin;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}
