import {
  PublicClientApplication,
  BrowserCacheLocation,
  type Configuration,
} from "@azure/msal-browser";

const clientId = process.env.NEXT_PUBLIC_MS_CLIENT_ID;
const authority = process.env.NEXT_PUBLIC_MS_AUTHORITY;
const redirectUri = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!clientId) {
  throw new Error("Brak NEXT_PUBLIC_MS_CLIENT_ID w .env.local");
}

if (!authority) {
  throw new Error("Brak NEXT_PUBLIC_MS_AUTHORITY w .env.local");
}

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const graphScopes = ["User.Read", "Files.ReadWrite"];
