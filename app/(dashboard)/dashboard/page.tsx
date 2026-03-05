"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monitor, Building2, Map, Wifi, AlertTriangle, RefreshCw } from "lucide-react";
import { formatDate, getToolLabel } from "@/lib/utils";
import Link from "next/link";
import {
  loadMaintenanceSettings,
  type MaintenanceSettings,
  DEFAULT_MAINTENANCE_SETTINGS,
} from "@/lib/maintenance-settings";

interface MaintenanceAlert {
  id: number;
  name: string;
  maintenanceEndDate: string;
}

interface DashboardData {
  stats: {
    totalConnections: number;
    activeConnections: number;
    totalCompanies: number;
    totalRegions: number;
  };
  recentConnections: Array<{
    id: number;
    name: string;
    tool: string;
    remoteId: string;
    updatedAt: string;
    company: { name: string } | null;
    region: { name: string } | null;
  }>;
  maintenanceAlerts: MaintenanceAlert[];
}

/** İki tarihi yerel gece yarısında karşılaştırarak kalan gün sayısını hesaplar */
function calcDaysLeft(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate.substring(0, 10) + "T00:00:00");
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function MaintenanceBadge({
  endDate,
  settings,
}: {
  endDate: string;
  settings: MaintenanceSettings;
}) {
  const daysLeft = calcDaysLeft(endDate);

  if (daysLeft < 0)
    return (
      <Badge variant="destructive">
        Süresi doldu ({Math.abs(daysLeft)} gün önce)
      </Badge>
    );
  if (daysLeft === 0)
    return <Badge variant="destructive">Bugün bitiyor</Badge>;
  if (daysLeft <= settings.urgentDays)
    return <Badge className="bg-red-600 hover:bg-red-700 text-white">{daysLeft} gün kaldı</Badge>;
  if (daysLeft <= settings.warnDays)
    return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">{daysLeft} gün kaldı</Badge>;
  return (
    <Badge variant="outline" className="text-yellow-600 border-yellow-400">
      {daysLeft} gün kaldı
    </Badge>
  );
}

const toolVariant: Record<string, "default" | "secondary" | "outline"> = {
  RUSTDESK: "default",
  ANYDESK: "secondary",
  OTHER: "outline",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<MaintenanceSettings>(DEFAULT_MAINTENANCE_SETTINGS);

  useEffect(() => {
    setSettings(loadMaintenanceSettings());
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // warnDays'i query param olarak gönder; API bu eşiğe göre filtreleme yapar
      const params = new URLSearchParams({ warnDays: String(settings.warnDays) });
      const res = await fetch(`/api/dashboard?${params}`, { cache: "no-store" });
      if (!res.ok) { setData(null); return; }
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [settings.warnDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Bakım alertlerini client tarafında warnDays eşiğine göre filtrele ve daysLeft'e göre sırala
  const alerts: MaintenanceAlert[] = (data?.maintenanceAlerts ?? [])
    .filter((a) => calcDaysLeft(a.maintenanceEndDate) <= settings.warnDays)
    .sort((a, b) => calcDaysLeft(a.maintenanceEndDate) - calcDaysLeft(b.maintenanceEndDate));

  const statCards = [
    { label: "Toplam Bağlantı", value: data?.stats.totalConnections ?? "—", icon: Monitor,   href: "/connections" },
    { label: "Aktif Bağlantı",  value: data?.stats.activeConnections ?? "—", icon: Wifi,      href: "/connections" },
    { label: "Firma",           value: data?.stats.totalCompanies    ?? "—", icon: Building2, href: "/companies"   },
    { label: "Bölge",           value: data?.stats.totalRegions      ?? "—", icon: Map,       href: "/regions"     },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Son Bağlantılar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Son Bağlantılar</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor...</p>
            ) : !data?.recentConnections?.length ? (
              <p className="text-sm text-muted-foreground">Henüz bağlantı yok.</p>
            ) : (
              <div className="space-y-3">
                {data.recentConnections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">{conn.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {conn.company?.name ?? "—"} / {conn.region?.name ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={toolVariant[conn.tool] ?? "outline"}>
                        {getToolLabel(conn.tool)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(conn.updatedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bakım Sözleşmesi Uyarıları */}
        <Card className="border-orange-300 dark:border-orange-800 flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-4 w-4" />
                Bakım Uyarıları
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="h-7 gap-1 text-xs text-muted-foreground"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Yenile
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden min-h-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor...</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Yaklaşan uyarı yok.</p>
            ) : (
              <div className="space-y-2 h-full overflow-y-auto pr-1">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <Link href="/companies" className="font-medium hover:underline truncate mr-2">
                      {a.name}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {a.maintenanceEndDate.substring(0, 10).split("-").reverse().join(".")}
                      </span>
                      <MaintenanceBadge endDate={a.maintenanceEndDate} settings={settings} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
