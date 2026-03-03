"use client";

/**
 * Settings Sayfası
 *
 * Acceptance Criteria:
 * - DB bağlantı durumu (health check) gösterilir; "Yenile" butonu ile tekrar kontrol edilir.
 * - Uygulama adı, sürüm ve DB URL (maskelenmiş) bilgileri gösterilir.
 * - Durum: yeşil (ok) / kırmızı (error) badge ile gösterilir.
 */

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, XCircle, Database, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";

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
    // Hide password: replace password=xxx with password=****
    return url.replace(/(password=)[^;]+/i, "$1****");
  } catch {
    return "—";
  }
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [checking, setChecking] = useState(false);

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
