// lib/share-url.ts

export function encodeShareUrlForGraph(url: string): string {
  const base64 = Buffer.from(url, "utf8").toString("base64");
  return `u!${base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}
