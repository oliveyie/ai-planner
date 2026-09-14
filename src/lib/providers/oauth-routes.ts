// Route Handler factories shared by app/api/auth/{google,microsoft}/** so the
// two providers can't drift in how the OAuth dance itself is handled — only
// ./oauth-providers.ts differs per provider.

import { NextResponse, type NextRequest } from "next/server";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  fetchDisplayName,
  getAppBaseUrl,
  refreshAccessToken,
} from "./oauth-providers";
import type { CalendarProvider } from "../utils/types";

function stateCookieName(provider: CalendarProvider): string {
  return `oauth_state_${provider}`;
}

export function createStartHandler(provider: CalendarProvider) {
  return function GET() {
    const state = crypto.randomUUID();
    const response = NextResponse.redirect(buildAuthorizeUrl(provider, state));
    response.cookies.set(stateCookieName(provider), state, {
      httpOnly: true,
      maxAge: 300,
      sameSite: "lax",
      path: "/",
    });
    return response;
  };
}

export function createCallbackHandler(provider: CalendarProvider) {
  return async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const cookieName = stateCookieName(provider);
    const expectedState = request.cookies.get(cookieName)?.value;

    function failRedirect(message: string) {
      const response = NextResponse.redirect(
        `${getAppBaseUrl()}/?calendar_error=${encodeURIComponent(message)}`,
      );
      response.cookies.delete(cookieName);
      return response;
    }

    if (!code || !state || !expectedState || state !== expectedState) {
      return failRedirect("Calendar connection failed (invalid state) — please try again.");
    }

    try {
      const tokens = await exchangeCodeForTokens(provider, code);
      const displayName = await fetchDisplayName(provider, tokens.accessToken);
      const fragment = new URLSearchParams({
        calendar_connected: provider,
        access_token: tokens.accessToken,
        expires_at: tokens.expiresAt,
        ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
        ...(displayName ? { display_name: displayName } : {}),
      });
      const response = NextResponse.redirect(`${getAppBaseUrl()}/#${fragment.toString()}`);
      response.cookies.delete(cookieName);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Calendar connection failed";
      return failRedirect(message);
    }
  };
}

export function createRefreshHandler(provider: CalendarProvider) {
  return async function POST(request: NextRequest) {
    const body = (await request.json()) as { refreshToken?: string };
    if (!body.refreshToken) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
    }

    try {
      const tokens = await refreshAccessToken(provider, body.refreshToken);
      return NextResponse.json(tokens);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token refresh failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
