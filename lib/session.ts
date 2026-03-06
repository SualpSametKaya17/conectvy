/**
 * Edge-runtime uyumlu oturum yönetimi (Web Crypto API)
 * Next.js middleware + API route'larında çalışır.
 */

export const SESSION_COOKIE  = "conectvy_session";
export const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 saat

export interface SessionPayload {
  userId:   number;
  username: string;
  exp:      number;
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr as Uint8Array<ArrayBuffer>;
}

function b64uEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64uDecode(str: string): string {
  return decodeURIComponent(
    escape(atob(str.replace(/-/g, "+").replace(/_/g, "/")))
  );
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET ?? "conectvy-session-secret-change-me!";
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// ─── Token oluştur ────────────────────────────────────────────────────────────
export async function createSessionToken(userId: number, username: string): Promise<string> {
  const payload: SessionPayload = { userId, username, exp: Date.now() + SESSION_DURATION };
  const payloadB64 = b64uEncode(JSON.stringify(payload));
  const key = await getKey();
  const sig  = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  return `${payloadB64}.${toHex(sig)}`;
}

// ─── Token doğrula ────────────────────────────────────────────────────────────
export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const dot = token.lastIndexOf(".");
  if (dot < 0) throw new Error("Geçersiz token formatı");

  const payloadB64 = token.slice(0, dot);
  const sigHex     = token.slice(dot + 1);

  const key   = await getKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromHex(sigHex),
    enc.encode(payloadB64)
  );
  if (!valid) throw new Error("Geçersiz imza");

  const payload: SessionPayload = JSON.parse(b64uDecode(payloadB64));
  if (payload.exp < Date.now()) throw new Error("Oturum süresi doldu");

  return payload;
}
