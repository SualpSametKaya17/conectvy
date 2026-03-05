export interface MaintenanceSettings {
  /** "Yakında Bitiyor" badge için eşik (gün). Varsayılan: 30 */
  warnDays: number;
  /** "Kritik" badge için eşik (gün). Varsayılan: 7 */
  urgentDays: number;
}

export const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  warnDays: 30,
  urgentDays: 7,
};

const STORAGE_KEY = "conectvy_maintenance_settings";

export function loadMaintenanceSettings(): MaintenanceSettings {
  if (typeof window === "undefined") return DEFAULT_MAINTENANCE_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MAINTENANCE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<MaintenanceSettings>;
    return {
      warnDays:
        typeof parsed.warnDays === "number" && parsed.warnDays > 0
          ? parsed.warnDays
          : DEFAULT_MAINTENANCE_SETTINGS.warnDays,
      urgentDays:
        typeof parsed.urgentDays === "number" && parsed.urgentDays > 0
          ? parsed.urgentDays
          : DEFAULT_MAINTENANCE_SETTINGS.urgentDays,
    };
  } catch {
    return DEFAULT_MAINTENANCE_SETTINGS;
  }
}

export function saveMaintenanceSettings(settings: MaintenanceSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
