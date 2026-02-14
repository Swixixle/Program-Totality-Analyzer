/**
 * P4 Authentication Middleware
 * 
 * API key authentication for private endpoints.
 * Public verify endpoint remains public.
 * P7.5: Security audit events for auth failures.
 */

import type { Request, Response, NextFunction } from "express";
import { logAuthFailure } from "./security-audit";

const API_KEY_HEADER = "x-api-key";

const VALID_API_KEYS = new Set<string>();

export function initializeApiKeys(): void {
  const envKey = process.env.API_KEY;
  if (envKey) {
    VALID_API_KEYS.add(envKey);
  }
  
  if (process.env.NODE_ENV !== "production") {
    VALID_API_KEYS.add("dev-test-key-12345");
  }
}

export function addApiKey(key: string): void {
  VALID_API_KEYS.add(key);
}

export function removeApiKey(key: string): boolean {
  return VALID_API_KEYS.delete(key);
}

export function validateApiKey(key: string): boolean {
  return VALID_API_KEYS.has(key);
}

function getClientIp(req: Request): string {
  // In production, do not trust X-Forwarded-For
  if (process.env.NODE_ENV === "production") {
    return req.socket.remoteAddress || "unknown";
  }
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers[API_KEY_HEADER] as string | undefined;
  const ip = getClientIp(req);
  
  if (!apiKey) {
    // P7.5: Log auth failure
    logAuthFailure(req.path, ip, "UNAUTHORIZED", 401);
    
    res.status(401).json({
      error: "Unauthorized",
      message: "API key required. Provide via x-api-key header.",
    });
    return;
  }
  
  if (!validateApiKey(apiKey)) {
    // P7.5: Log auth failure
    logAuthFailure(req.path, ip, "FORBIDDEN", 403);
    
    res.status(403).json({
      error: "Forbidden",
      message: "Invalid API key.",
    });
    return;
  }
  
  next();
}

initializeApiKeys();
