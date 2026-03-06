/**
 * Çift katmanlı şifreleme:
 *   Katman 1 — AES-256-GCM  (bütünlük doğrulamalı)
 *   Katman 2 — AES-256-CBC  (dış zarf)
 *
 * Ortam değişkeni: ENCRYPTION_KEY (en az 32 karakter öneridir)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";

const MASTER = process.env.ENCRYPTION_KEY ?? "conectvy-default-key-change-in-production!";

// Katman anahtarlarını uygulama başlangıcında bir kez türet
const LAYER1_KEY = scryptSync(MASTER, "conectvy-gcm-layer1", 32);
const LAYER2_KEY = scryptSync(MASTER, "conectvy-cbc-layer2", 32);

// ─── Şifrele ──────────────────────────────────────────────────────────────────
export function encrypt(plaintext: string): string {
  // Katman 1: AES-256-GCM
  const iv1 = randomBytes(12); // 96-bit IV (GCM standardı)
  const c1  = createCipheriv("aes-256-gcm", LAYER1_KEY, iv1);
  const enc1 = Buffer.concat([c1.update(plaintext, "utf8"), c1.final()]);
  const tag1 = c1.getAuthTag(); // 16 bayt kimlik doğrulama etiketi

  // Paket: iv1(12) | tag1(16) | şifreli_veri
  const packed1 = Buffer.concat([iv1, tag1, enc1]);

  // Katman 2: AES-256-CBC
  const iv2 = randomBytes(16); // 128-bit IV (CBC standardı)
  const c2  = createCipheriv("aes-256-cbc", LAYER2_KEY, iv2);
  const enc2 = Buffer.concat([c2.update(packed1), c2.final()]);

  // Son paket: iv2(16) | şifreli_veri  → base64
  return Buffer.concat([iv2, enc2]).toString("base64");
}

// ─── Çöz ──────────────────────────────────────────────────────────────────────
export function decrypt(ciphertext: string): string {
  const packed2 = Buffer.from(ciphertext, "base64");

  // Katman 2 çöz: AES-256-CBC
  const iv2  = packed2.subarray(0, 16);
  const d2   = createDecipheriv("aes-256-cbc", LAYER2_KEY, iv2);
  const packed1 = Buffer.concat([d2.update(packed2.subarray(16)), d2.final()]);

  // Katman 1 çöz: AES-256-GCM
  const iv1  = packed1.subarray(0, 12);
  const tag1 = packed1.subarray(12, 28);
  const enc1 = packed1.subarray(28);
  const d1   = createDecipheriv("aes-256-gcm", LAYER1_KEY, iv1);
  d1.setAuthTag(tag1);
  const plain = Buffer.concat([d1.update(enc1), d1.final()]);

  return plain.toString("utf8");
}

// ─── Parola hash (scrypt) ──────────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(derived, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
