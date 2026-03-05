"use client";

/**
 * Settings Sayfası
 *
 * - DB bağlantı durumu (health check) gösterilir.
 * - Bakım desteği uyarı eşikleri ayarlanır (localStorage'da saklanır).
 * - Uygulama bilgileri gösterilir.
 */

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, XCircle, Database, Info, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  loadMaintenanceSettings,
  saveMaintenanceSettings,
  DEFAULT_MAINTENANCE_SETTINGS,
  type MaintenanceSettings,
} from "@/lib/maintenance-settings";

interface HealthData {
  status: "ok" | "error";
  db: "connected" | "disconnected";
  error?: string;
  timestamp: string;
  version: string;
}

function maskDbUrl(url: string | undefined): string {
  if (!url) return "—";
  try {
    return url.replace(/(password=)[^;]+/i, "$1****");
  } catch {
    return "—";
  }
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [checking, setChecking] = useState(false);

  // Bakım uyarı eşiği ayarları
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings>(
    DEFAULT_MAINTENANCE_SETTINGS
  );
  const [warnDaysInput, setWarnDaysInput] = useState(String(DEFAULT_MAINTENANCE_SETTINGS.warnDays));
  const [urgentDaysInput, setUrgentDaysInput] = useState(
    String(DEFAULT_MAINTENANCE_SETTINGS.urgentDays)
  );

  useEffect(() => {
    const saved = loadMaintenanceSettings();
    setMaintenanceSettings(saved);
    setWarnDaysInput(String(saved.warnDays));
    setUrgentDaysInput(String(saved.urgentDays));
  }, []);

  async function checkHealth() {
    setChecking(true);
    try {
      const res = await fetch("/api/health");
      const json = await res.json();
      setHealth(json);
    } catch {
      setHealth({
        status: "error",
        db: "disconnected",
        error: "Sunucuya ulaşılamadı",
        timestamp: new Date().toISOString(),
        version: "—",
      });
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { checkHealth(); }, []);

  function handleSaveMaintenanceSettings() {
    const warn = parseInt(warnDaysInput, 10);
    const urgent = parseInt(urgentDaysInput, 10);

    if (!warn || warn < 1) {
      toast.error("'Yakında Bitiyor' eşiği en az 1 gün olmalıdır");
      return;
    }
    if (!urgent || urgent < 1) {
      toast.error("'Kritik' eşiği en az 1 gün olmalıdır");
      return;
    }
    if (urgent >= warn) {
      toast.error("'Kritik' eşiği, 'Yakında Bitiyor' eşiğinden küçük olmalıdır");
      return;
    }

    const newSettings: MaintenanceSettings = { warnDays: warn, urgentDays: urgent };
    saveMaintenanceSettings(newSettings);
    setMaintenanceSettings(newSettings);
    toast.success("Uyarı eşikleri kaydedildi");
  }

  function handleResetMaintenanceSettings() {
    saveMaintenanceSettings(DEFAULT_MAINTENANCE_SETTINGS);
    setMaintenanceSettings(DEFAULT_MAINTENANCE_SETTINGS);
    setWarnDaysInput(String(DEFAULT_MAINTENANCE_SETTINGS.warnDays));
    setUrgentDaysInput(String(DEFAULT_MAINTENANCE_SETTINGS.urgentDays));
    toast.success("Varsayılan değerlere sıfırlandı");
  }

  const isOk = health?.status === "ok";

  return (
    <div className="max-w-2xl space-y-6">
      {/* DB Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Veritabanı Bağlantısı</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkHealth}
            disabled={checking}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Kontrol ediliyor..." : "Yenile"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {isOk ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    isOk
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-red-100 text-red-800 border-red-200"
                  }
                  variant="outline"
                >
                  {isOk ? "Bağlı" : "Bağlantı Yok"}
                </Badge>
              </div>
              {health?.error && (
                <p className="mt-1 text-sm text-destructive">{health.error}</p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Son kontrol</span>
              <span>{health ? formatDate(health.timestamp) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">DB URL</span>
              <span className="font-mono text-xs max-w-[300px] truncate text-right">
                {maskDbUrl(process.env.NEXT_PUBLIC_DB_URL_HINT)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bakım Uyarı Eşikleri */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Bakım Desteği Uyarı Eşikleri</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bakım bitiş tarihine kaç gün kaldığında hangi uyarı gösterileceğini belirleyin.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="warnDays" className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
                Yakında Bitiyor (gün)
              </Label>
              <Input
                id="warnDays"
                type="number"
                min={2}
                value={warnDaysInput}
                onChange={(e) => setWarnDaysInput(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Şu an: <strong>{maintenanceSettings.warnDays} gün</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="urgentDays" className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
                Kritik (gün)
              </Label>
              <Input
                id="urgentDays"
                type="number"
                min={1}
                value={urgentDaysInput}
                onChange={(e) => setUrgentDaysInput(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Şu an: <strong>{maintenanceSettings.urgentDays} gün</strong>
              </p>
            </div>
          </div>

          <Separator />

          {/* Örnek gösterim */}
          <div className="space-y-1 text-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Badge Önizleme
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-green-600 hover:bg-green-700">Aktif</Badge>
              <span className="text-xs text-muted-foreground self-center">
                → {maintenanceSettings.warnDays}+ gün kala
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-orange-500 hover:bg-orange-600">Yakında Bitiyor</Badge>
              <span className="text-xs text-muted-foreground self-center">
                → {maintenanceSettings.urgentDays + 1}–{maintenanceSettings.warnDays} gün kala
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-red-600 hover:bg-red-700">Kritik</Badge>
              <span className="text-xs text-muted-foreground self-center">
                → 1–{maintenanceSettings.urgentDays} gün kala
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="destructive">Süresi Doldu</Badge>
              <span className="text-xs text-muted-foreground self-center">
                → Bitiş tarihi geçmiş
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSaveMaintenanceSettings}>Kaydet</Button>
            <Button variant="outline" onClick={handleResetMaintenanceSettings}>
              Varsayılana Sıfırla
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Uygulama Bilgisi</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              ["Uygulama Adı", process.env.NEXT_PUBLIC_APP_NAME ?? "Conectvy"],
              ["Sürüm", process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"],
              ["Ortam", process.env.NODE_ENV ?? "—"],
              ["Platform", "Windows (Electron)"],
              ["Next.js", "14+"],
              ["ORM", "Prisma (SQL Server)"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
