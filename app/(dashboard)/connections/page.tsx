"use client";

/**
 * Connections Sayfası
 *
 * Acceptance Criteria:
 * - Bağlantılar tablo şeklinde listelenir (Ad, Araç, Remote ID, Firma, Bölge, Güncelleme).
 * - Üstte arama (name/remoteId) ve araç filtresi bulunur.
 * - "Yeni Bağlantı" butonu dialog açar.
 * - Her satırda düzenle ve sil aksiyonları (DropdownMenu) bulunur.
 * - Silme işlemi onay ister (soft delete).
 * - Sayfalama gösterilir.
 * - Şifre listede gösterilmez; düzenleme modalında maskelenmiş gelir.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Copy, Eye, EyeOff, MonitorPlay, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConnectionForm } from "@/components/connections/ConnectionForm";
import { formatDate, getToolLabel, CONNECTION_TOOLS } from "@/lib/utils";
import type { CreateConnectionInput } from "@/lib/validations/connection";

function getConnectUrl(tool: string, remoteId: string): string | null {
  if (tool === "RUSTDESK") return `rustdesk://${remoteId}`;
  if (tool === "ANYDESK")  return `anydesk:${remoteId}`;
  return null;
}

interface Connection {
  id: number;
  name: string;
  tool: string;
  remoteId: string;
  company: { id: number; name: string } | null;
  region: { id: number; name: string } | null;
  computer: { id: number; name: string } | null;
  notes: string | null;
  updatedAt: string;
}

interface Company  { id: number; name: string }
interface Region   { id: number; name: string }
interface Computer { id: number; name: string; company: { id: number; name: string } }

const toolBadge: Record<string, "default" | "secondary" | "outline"> = {
  RUSTDESK: "default",
  ANYDESK: "secondary",
  OTHER: "outline",
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [search, setSearch] = useState("");
  const [toolFilter, setToolFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);

  const [companies, setCompanies]   = useState<Company[]>([]);
  const [regions, setRegions]       = useState<Region[]>([]);
  const [computers, setComputers]   = useState<Computer[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [editDefaults, setEditDefaults] = useState<Partial<CreateConnectionInput> | undefined>();

  // Visible password cell
  const [visiblePassId, setVisiblePassId] = useState<number | null>(null);
  const [passwords, setPasswords]         = useState<Record<number, string>>({});
  const [connectingId, setConnectingId]   = useState<number | null>(null);
  const [exporting, setExporting]         = useState(false);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
        ...(toolFilter !== "ALL" ? { tool: toolFilter } : {}),
      });
      const res = await fetch(`/api/connections?${params}`);
      const json = await res.json();
      if (json.success) {
        setConnections(json.data.items);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, toolFilter]);

  const fetchMeta = useCallback(async () => {
    const [cRes, rRes, compRes] = await Promise.all([
      fetch("/api/companies?pageSize=200"),
      fetch("/api/regions?pageSize=200"),
      fetch("/api/computers?pageSize=500"),
    ]);
    const [cJson, rJson, compJson] = await Promise.all([cRes.json(), rRes.json(), compRes.json()]);
    if (cJson.success)    setCompanies(cJson.data.items);
    if (rJson.success)    setRegions(rJson.data.items);
    if (compJson.success) setComputers(compJson.data.items);
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);
  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  function openCreate() {
    setEditingConnection(null);
    setEditDefaults(undefined);
    setDialogOpen(true);
  }

  async function openEdit(conn: Connection) {
    // Fetch full record (with password) from single-record endpoint
    const res = await fetch(`/api/connections/${conn.id}`);
    const json = await res.json();
    if (json.success) {
      const d = json.data;
      setEditingConnection(conn);
      setEditDefaults({
        name: d.name,
        tool: d.tool,
        remoteId: d.remoteId,
        password: d.password ?? "",
        companyId: d.companyId,
        regionId: d.regionId,
        computerId: d.computerId,
        notes: d.notes ?? "",
      });
      setDialogOpen(true);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu bağlantıyı silmek istediğinize emin misiniz?")) return;
    const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.success("Bağlantı silindi");
      fetchConnections();
    } else {
      toast.error(json.error ?? "Silinemedi");
    }
  }

  async function togglePassword(id: number) {
    if (visiblePassId === id) {
      setVisiblePassId(null);
      return;
    }
    if (!passwords[id]) {
      const res = await fetch(`/api/connections/${id}`);
      const json = await res.json();
      if (json.success) {
        setPasswords((p) => ({ ...p, [id]: json.data.password ?? "" }));
      }
    }
    setVisiblePassId(id);
  }

  function copyRemoteId(remoteId: string) {
    navigator.clipboard.writeText(remoteId);
    toast.success("Remote ID kopyalandı");
  }

  async function connectToRemote(conn: Connection) {
    setConnectingId(conn.id);
    try {
      let pwd = passwords[conn.id];
      if (!pwd) {
        const res  = await fetch(`/api/connections/${conn.id}`);
        const json = await res.json();
        if (json.success) {
          pwd = json.data.password ?? "";
          setPasswords((p) => ({ ...p, [conn.id]: pwd }));
        }
      }
      const url = getConnectUrl(conn.tool, conn.remoteId);
      if (url) window.open(url, "_self");
      else await navigator.clipboard.writeText(conn.remoteId);
      await fetch(`/api/connections/${conn.id}/connect`, { method: "POST" }).catch(() => {});
      toast.success(`${getToolLabel(conn.tool)} açılıyor — ${conn.remoteId}`);
    } catch {
      toast.error("Bağlantı açılamadı");
    } finally {
      setConnectingId(null);
    }
  }

  async function exportCSV() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        ...(search              ? { search }            : {}),
        ...(toolFilter !== "ALL" ? { tool: toolFilter } : {}),
      });
      const res  = await fetch(`/api/connections/export?${params}`);
      const json = await res.json();
      if (!json.success) { toast.error("Dışa aktarma başarısız"); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = json.data;

      // Şirket bazında grupla
      const map = new Map<string, {
        company: string;
        regions: Set<string>;
        notes: string[];
        anydesk:  Array<{ remoteId: string; password: string }>;
        rustdesk: Array<{ remoteId: string; password: string }>;
      }>();

      for (const c of items) {
        const key = c.companyName || "—";
        if (!map.has(key)) {
          map.set(key, { company: key, regions: new Set(), notes: [], anydesk: [], rustdesk: [] });
        }
        const g = map.get(key)!;
        if (c.regionName) g.regions.add(c.regionName);
        if (c.notes)      g.notes.push(c.notes);
        if (c.tool === "ANYDESK")  g.anydesk.push({ remoteId: c.remoteId, password: c.password });
        if (c.tool === "RUSTDESK") g.rustdesk.push({ remoteId: c.remoteId, password: c.password });
      }

      // Maksimum bağlantı sayısını bul
      let maxAD = 0, maxRD = 0;
      for (const g of map.values()) {
        if (g.anydesk.length  > maxAD) maxAD = g.anydesk.length;
        if (g.rustdesk.length > maxRD) maxRD = g.rustdesk.length;
      }

      // Başlık satırı
      const header = ["Şirket", "Bölge", "Not"];
      for (let i = 1; i <= maxAD; i++) header.push(`AnyDesk ${i} No`, `AnyDesk ${i} Şifre`);
      for (let i = 1; i <= maxRD; i++) header.push(`RustDesk ${i} No`, `RustDesk ${i} Şifre`);

      // Veri satırları
      const lines = [
        header.join(";"),
        ...Array.from(map.values()).map((g) => {
          const cols = [
            `"${g.company}"`,
            `"${[...g.regions].join(", ")}"`,
            `"${g.notes.filter(Boolean).join(" | ")}"`,
          ];
          for (let i = 0; i < maxAD; i++)
            cols.push(`"${g.anydesk[i]?.remoteId  ?? ""}"`, `"${g.anydesk[i]?.password  ?? ""}"`);
          for (let i = 0; i < maxRD; i++)
            cols.push(`"${g.rustdesk[i]?.remoteId ?? ""}"`, `"${g.rustdesk[i]?.password ?? ""}"`);
          return cols.join(";");
        }),
      ];

      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `baglantilar_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${map.size} firma dışa aktarıldı`);
    } catch {
      toast.error("Dışa aktarma başarısız");
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ad veya Remote ID ara..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Select value={toolFilter} onValueChange={(v) => { setToolFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Araç" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tümü</SelectItem>
            {CONNECTION_TOOLS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={exportCSV} disabled={exporting}>
          {exporting
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Download className="mr-2 h-4 w-4" />}
          Dışa Aktar
        </Button>

        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Bağlantı
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Araç</TableHead>
              <TableHead>Remote ID</TableHead>
              <TableHead className="hidden sm:table-cell">Şifre</TableHead>
              <TableHead className="hidden md:table-cell">Bilgisayar</TableHead>
              <TableHead className="hidden md:table-cell">Firma</TableHead>
              <TableHead className="hidden lg:table-cell">Bölge</TableHead>
              <TableHead className="hidden lg:table-cell">Güncelleme</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Yükleniyor...
                </TableCell>
              </TableRow>
            ) : connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Bağlantı bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell className="font-medium">{conn.name}</TableCell>
                  <TableCell>
                    <Badge variant={toolBadge[conn.tool] ?? "outline"}>
                      {getToolLabel(conn.tool)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">{conn.remoteId}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyRemoteId(conn.remoteId)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">
                        {visiblePassId === conn.id ? (passwords[conn.id] || "—") : "••••••"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => togglePassword(conn.id)}
                      >
                        {visiblePassId === conn.id
                          ? <EyeOff className="h-3 w-3" />
                          : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{conn.computer?.name ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{conn.company?.name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{conn.region?.name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {formatDate(conn.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => connectToRemote(conn)}
                          disabled={connectingId === conn.id}
                          className="text-primary focus:text-primary"
                        >
                          {connectingId === conn.id
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <MonitorPlay className="mr-2 h-4 w-4" />}
                          Bağlan
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(conn)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(conn.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Toplam {total} kayıt</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Önceki
            </Button>
            <span className="flex items-center px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConnection ? "Bağlantıyı Düzenle" : "Yeni Bağlantı"}
            </DialogTitle>
          </DialogHeader>
          <ConnectionForm
            defaultValues={editDefaults}
            connectionId={editingConnection?.id}
            companies={companies}
            regions={regions}
            computers={computers}
            onSuccess={() => {
              setDialogOpen(false);
              fetchConnections();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
