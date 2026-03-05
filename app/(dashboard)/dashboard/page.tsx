/**
 * Dashboard Sayfası
 *
 * Acceptance Criteria:
 * - Toplam bağlantı, aktif bağlantı, firma ve bölge sayıları kart olarak gösterilir.
 * - Son 5 güncellenen bağlantı listelenir.
 * - Araç dağılımı (RustDesk/AnyDesk/Diğer) badge olarak görünür.
 * - Sayfa server component olarak çalışır (SSR/RSC).
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Building2, Map, Wifi, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDate, getToolLabel } from "@/lib/utils";
import Link from "next/link";

interface MaintenanceAlert {
  id: number;
  name: string;
  maintenanceEndDate: string;
  daysLeft: number;
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
  toolStats: Array<{ tool: string; count: number }>;
  maintenanceAlerts: MaintenanceAlert[];
}

async function getDashboardData(): Promise<DashboardData | null> {
  try {
    const res = await fetch("http://localhost:3000/api/dashboard", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

const toolVariant: Record<string, "default" | "secondary" | "outline"> = {
  RUSTDESK: "default",
  ANYDESK: "secondary",
  OTHER: "outline",
};

function MaintenanceBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0)
    return <Badge variant="destructive">Süresi doldu ({Math.abs(daysLeft)} gün önce)</Badge>;
  if (daysLeft === 0)
    return <Badge variant="destructive">Bugün bitiyor</Badge>;
  if (daysLeft <= 14)
    return <Badge variant="destructive">{daysLeft} gün kaldı</Badge>;
  if (daysLeft <= 30)
    return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">{daysLeft} gün kaldı</Badge>;
  return <Badge variant="outline" className="text-yellow-600 border-yellow-400">{daysLeft} gün kaldı</Badge>;
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const alerts = data?.maintenanceAlerts ?? [];

  const statCards = [
    { label: "Toplam Bağlantı", value: data?.stats.totalConnections ?? "—", icon: Monitor,   href: "/connections" },
    { label: "Aktif Bağlantı",  value: data?.stats.activeConnections ?? "—", icon: Wifi,      href: "/connections" },
    { label: "Firma",           value: data?.stats.totalCompanies    ?? "—", icon: Building2, href: "/companies"   },
    { label: "Bölge",           value: data?.stats.totalRegions      ?? "—", icon: Map,       href: "/regions"     },
  ];

  return (
    <div className="space-y-6">
      {/* Bakım Uyarıları */}
      {alerts.length > 0 && (
        <Card className="border-orange-300 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              Bakım Sözleşmesi Uyarıları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <Link href="/companies" className="font-medium hover:underline">
                    {a.name}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.maintenanceEndDate).toLocaleDateString("tr-TR")}
                    </span>
                    <MaintenanceBadge daysLeft={a.daysLeft} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
        {/* Recent Connections */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Son Bağlantılar</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.recentConnections?.length ? (
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

        {/* Tool Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Araç Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.toolStats?.length ? (
              <p className="text-sm text-muted-foreground">Veri yok.</p>
            ) : (
              <div className="space-y-3">
                {data.toolStats.map(({ tool, count }) => (
                  <div key={tool} className="flex items-center justify-between">
                    <Badge variant={toolVariant[tool] ?? "outline"}>{getToolLabel(tool)}</Badge>
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            )}
            {alerts.length === 0 && (
              <div className="mt-4 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Bakım uyarısı yok</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
