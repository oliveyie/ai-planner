// Server-only OAuth config for Google and Microsoft calendar connections
// (SPEC.md §3 tension note). Only this file (and its callers in
// app/api/auth/**) ever sees a client secret; nothing here persists tokens —
// that's the client's job (IndexedDB), matching the "stateless relay" design.

import type { CalendarProvider } from "../utils/types";

type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  extraAuthorizeParams?: Record<string, string>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (see .env.local)`);
  }
  return value;
}

export function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}

export function getRedirectUri(provider: CalendarProvider): string {
  return `${getAppBaseUrl()}/api/auth/${provider}/callback`;
}

export function getProviderConfig(provider: CalendarProvider): ProviderConfig {
  if (provider === "google") {
    return {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      // Full access, not calendar.readonly: pushing a plan creates a
      // dedicated calendar, which read-only access can't do. `openid email
      // profile` is only for reading the user's display name (AppHeader) —
      // never used for auth/identity. Anyone who connected before this
      // widened needs to reconnect (SPEC.md §7).
      scope: "https://www.googleapis.com/auth/calendar openid email profile",
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      // Google only returns a refresh_token on first consent unless forced.
      extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    };
  }

  return {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    // User.Read is only for reading the display name (AppHeader) via /me.
    scope: "offline_access Calendars.ReadWrite User.Read",
    clientId: requireEnv("MICROSOFT_CLIENT_ID"),
    clientSecret: requireEnv("MICROSOFT_CLIENT_SECRET"),
  };
}

export function buildAuthorizeUrl(provider: CalendarProvider, state: string): string {
  const config = getProviderConfig(provider);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getRedirectUri(provider),
    response_type: "code",
    scope: config.scope,
    state,
    ...config.extraAuthorizeParams,
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

export type TokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string; // ISO datetime
};

type RawTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

function toTokenResult(json: RawTokenResponse): TokenResult {
  const expiresInSeconds = json.expires_in ?? 3600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
}

export async function exchangeCodeForTokens(provider: CalendarProvider, code: string): Promise<TokenResult> {
  const config = getProviderConfig(provider);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: getRedirectUri(provider),
    grant_type: "authorization_code",
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`${provider} token exchange failed: ${await response.text()}`);
  }

  return toTokenResult(await response.json());
}

export async function refreshAccessToken(provider: CalendarProvider, refreshToken: string): Promise<TokenResult> {
  const config = getProviderConfig(provider);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`${provider} token refresh failed: ${await response.text()}`);
  }

  const result = toTokenResult(await response.json());
  // Neither provider reliably returns a new refresh_token on every refresh; keep the old one if absent.
  return { ...result, refreshToken: result.refreshToken ?? refreshToken };
}

// Best-effort only — a failure here (missing scope from a pre-widening
// connection, a transient error) shouldn't block the connection itself, so
// the caller just gets undefined and AppHeader falls back to "Guest".
export async function fetchDisplayName(provider: CalendarProvider, accessToken: string): Promise<string | undefined> {
  try {
    if (provider === "google") {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return undefined;
      const data = (await response.json()) as { name?: string };
      return data.name;
    }

    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { displayName?: string };
    return data.displayName;
  } catch {
    return undefined;
  }
}
