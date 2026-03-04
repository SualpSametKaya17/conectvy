import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

// ─── Tailwind class merge helper ──────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── API response helpers ─────────────────────────────────────────────────────
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function apiValidationError(error: ZodError) {
  return NextResponse.json(
    { success: false, error: "Validation failed", details: error.flatten() },
    { status: 422 }
  );
}

// ─── Date format helpers ──────────────────────────────────────────────────────
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// ─── Connection tool display ──────────────────────────────────────────────────
export const CONNECTION_TOOLS = [
  { value: "RUSTDESK", label: "RustDesk" },
  { value: "ANYDESK", label: "AnyDesk" },
  { value: "OTHER", label: "Diğer" },
] as const;

export type ConnectionTool = (typeof CONNECTION_TOOLS)[number]["value"];

export function getToolLabel(tool: string): string {
  return CONNECTION_TOOLS.find((t) => t.value === tool)?.label ?? tool;
}

// ─── Device type display ──────────────────────────────────────────────────────
export const DEVICE_TYPES = [
  { value: "COMPUTER", label: "Bilgisayar" },
  { value: "SERVER", label: "Sunucu" },
  { value: "VIRTUAL_SERVER", label: "Sanal Sunucu" },
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number]["value"];

export function getDeviceTypeLabel(type: string): string {
  return DEVICE_TYPES.find((t) => t.value === type)?.label ?? type;
}
