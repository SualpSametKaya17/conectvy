/**
 * TOTP (Time-based One-Time Password) yardımcıları
 * Google Authenticator uyumlu 6 haneli kod üretimi ve doğrulama
 */

import { authenticator } from "otplib";
import QRCode from "qrcode";

const APP_NAME = "Conectvy";

// Daha güvenilir doğrulama için 1 zaman dilimi tolerans (±30s)
authenticator.options = { window: 1 };

/** Yeni bir TOTP gizli anahtarı üretir */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** otpauth:// URI oluşturur (QR için) */
export function generateTotpUri(secret: string, username: string): string {
  return authenticator.keyuri(username, APP_NAME, secret);
}

/** QR kodu data URL olarak döner */
export async function generateQrDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

/** 6 haneli kodu doğrular */
export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ""), secret });
  } catch {
    return false;
  }
}
