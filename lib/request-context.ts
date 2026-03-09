// lib/request-context.ts

type RequestLike =
  | Request
  | Headers
  | {
      headers: Headers;
      nextUrl?: { pathname?: string };
      url?: string;
    }
  | null
  | undefined;

function getHeaders(source: RequestLike): Headers | null {
  if (!source) return null;

  if (source instanceof Headers) {
    return source;
  }

  if (source instanceof Request) {
    return source.headers;
  }

  if ("headers" in source && source.headers instanceof Headers) {
    return source.headers;
  }

  return null;
}

export function getClientIp(source: RequestLike): string | null {
  const headers = getHeaders(source);
  if (!headers) return null;

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const vercelForwardedFor = headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const firstIp = vercelForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  return null;
}

export function getUserAgent(source: RequestLike): string | null {
  const headers = getHeaders(source);
  if (!headers) return null;

  return headers.get("user-agent")?.trim() || null;
}

export function getRequestRoute(source: RequestLike): string | null {
  if (!source) return null;

  if ("nextUrl" in (source as object)) {
    const nextUrl = (source as { nextUrl?: { pathname?: string } }).nextUrl;
    if (nextUrl?.pathname) return nextUrl.pathname;
  }

  if ("url" in (source as object)) {
    const url = (source as { url?: string }).url;
    if (url) {
      try {
        return new URL(url).pathname;
      } catch {
        return null;
      }
    }
  }

  return null;
}
