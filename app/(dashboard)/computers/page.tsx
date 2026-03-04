"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Monitor, Server, Cloud, X, Copy, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { CreateComputerSchema, type CreateComputerInput } from "@/lib/validations/computer";
import { formatDate, DEVICE_TYPES, CONNECTION_TOOLS, getToolLabel } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Computer {
  id: number;
  deviceType: string;
  name: string;
  description: string | null;
  company: { id: number; name: string };
  _count: { connections: number; rustdesk: number; anydesk: number };
  updatedAt: string;
}

interface Company { id: number; name: string }

interface ConnRow {
  id?: number;      // undefined = yeni bağlantı, number = mevcut
  tool: string;
  remoteId: string;
  password: string;
  _delete: boolean; // sadece mevcut bağlantılar için
}

// ─── Device type helpers ──────────────────────────────────────────────────────

function DeviceIcon({ type, className }: { type: string; className?: string }) {
  if (type === "SERVER")         return <Server  className={className} />;
  if (type === "VIRTUAL_SERVER") return <Cloud   className={className} />;
  return                                <Monitor className={className} />;
}

function DeviceTypeBadge({ type }: { type: string }) {
  const label   = DEVICE_TYPES.find((t) => t.value === type)?.label ?? type;
  const variant = type === "SERVER" ? "default" : type === "VIRTUAL_SERVER" ? "outline" : "secondary";
  return <Badge variant={variant as "default" | "secondary" | "outline"}>{label}</Badge>;
}

// ─── ConnectionsBadges: tıkla → Remote ID listesi + kopyala ──────────────────

interface ConnSummary { id: number; tool: string; remoteId: string; name: string }

function ConnectionsBadges({
  computerId,
  rustdesk,
  anydesk,
  total,
}: {
  computerId: number;
  rustdesk: number;
  anydesk: number;
  total: number;
}) {
  const [open, setOpen]             = useState(false);
  const [conns, setConns]           = useState<ConnSummary[] | null>(null);
  const [fetching, setFetching]     = useState(false);

  async function load() {
    if (conns) return;
    setFetching(true);
    try {
      const res  = await fetch(`/api/connections?computerId=${computerId}&pageSize=50`);
      const json = await res.json();
      if (json.success) setConns(json.data.items);
    } finally {
      setFetching(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopyalandı`);
  }

  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 flex-wrap focus:outline-none">
          {rustdesk > 0 && (
            <Badge variant="secondary" className="text-xs font-normal cursor-pointer hover:bg-secondary/80">
              RustDesk{rustdesk > 1 ? ` ×${rustdesk}` : ""}
            </Badge>
          )}
          {anydesk > 0 && (
            <Badge variant="secondary" className="text-xs font-normal cursor-pointer hover:bg-secondary/80">
              AnyDesk{anydesk > 1 ? ` ×${anydesk}` : ""}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-1">
        {fetching ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Yükleniyor...</div>
        ) : conns?.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Bağlantı yok.</div>
        ) : (
          conns?.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="secondary" className="text-[10px] font-normal shrink-0 px-1.5 py-0">
                  {getToolLabel(conn.tool)}
                </Badge>
                <span className="font-mono text-xs truncate">{conn.remoteId}</span>
              </div>
              <button
                onClick={() => copy(conn.remoteId, conn.remoteId)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Kopyala"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── ComputerForm ─────────────────────────────────────────────────────────────

function ComputerForm({
  item,
  companies,
  initConnections = [],
  onSuccess,
}: {
  item: Computer | null;
  companies: Company[];
  initConnections?: ConnRow[];
  onSuccess: () => void;
}) {
  const form = useForm<CreateComputerInput>({
    resolver: zodResolver(CreateComputerSchema),
    defaultValues: {
      deviceType:  (item?.deviceType as CreateComputerInput["deviceType"]) ?? "COMPUTER",
      companyId:   item?.company.id ?? 0,
      name:        item?.name ?? "",
      description: item?.description ?? "",
    },
  });

  // Bağlantı satırları (mevcut + yeni)
  const [connRows, setConnRows] = useState<ConnRow[]>(initConnections);

  // Yeni bağlantı giriş alanları
  const [newTool, setNewTool]     = useState("RUSTDESK");
  const [newRemoteId, setNewRemoteId] = useState("");
  const [newPassword, setNewPassword] = useState("");

  function addConnRow() {
    if (!newRemoteId.trim()) return;
    setConnRows((prev) => [
      ...prev,
      { tool: newTool, remoteId: newRemoteId.trim(), password: newPassword, _delete: false },
    ]);
    setNewRemoteId("");
    setNewPassword("");
  }

  function removeConnRow(idx: number) {
    setConnRows((prev) =>
      prev[idx].id
        ? prev.map((r, i) => (i === idx ? { ...r, _delete: true } : r))
        : prev.filter((_, i) => i !== idx)
    );
  }

  async function onSubmit(values: CreateComputerInput) {
    const url    = item ? `/api/computers/${item.id}` : "/api/computers";
    const method = item ? "PATCH" : "POST";
    try {
      // 1. Bilgisayarı kaydet
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        const detail = json.details?.fieldErrors
          ? Object.entries(json.details.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join(" | ")
          : "";
        toast.error(`${json.error ?? "Hata"}${detail ? ` — ${detail}` : ""}`);
        return;
      }

      const computerId = item?.id ?? json.data.id;

      // 2. Silinen mevcut bağlantıları sil
      const toDelete = connRows.filter((r) => r._delete && r.id);
      await Promise.all(
        toDelete.map((r) => fetch(`/api/connections/${r.id}`, { method: "DELETE" }))
      );

      // 3. Yeni bağlantıları oluştur (sırayla — hata tespiti için)
      const toCreate = connRows.filter((r) => !r.id && !r._delete && r.remoteId);
      const connErrors: string[] = [];
      for (const r of toCreate) {
        const connRes = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:      `${values.name} — ${getToolLabel(r.tool)}`,
            tool:      r.tool,
            remoteId:  r.remoteId,
            password:  r.password || undefined,
            companyId: values.companyId,
            computerId,
          }),
        });
        if (!connRes.ok) {
          const connJson = await connRes.json().catch(() => ({}));
          connErrors.push(`${getToolLabel(r.tool)} (${r.remoteId}): ${connJson.error ?? "Hata"}`);
        }
      }

      if (connErrors.length > 0) {
        toast.warning(`Cihaz kaydedildi ama bazı bağlantılar eklenemedi:\n${connErrors.join("\n")}`);
      } else {
        toast.success(item ? "Cihaz güncellendi" : "Cihaz oluşturuldu");
      }
      onSuccess();
    } catch {
      toast.error("Sunucuya ulaşılamadı");
    }
  }

  const visibleRows = connRows.filter((r) => !r._delete);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* Cihaz Türü */}
        <FormField
          control={form.control}
          name="deviceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cihaz Türü *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Tür seç..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DEVICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Firma */}
        <FormField
          control={form.control}
          name="companyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Firma *</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(Number(v))}
                value={field.value > 0 ? field.value.toString() : ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Firma seç..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {companies.length === 0 ? (
                    <SelectItem value="__loading" disabled>Yükleniyor...</SelectItem>
                  ) : (
                    companies.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Cihaz Adı */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cihaz Adı *</FormLabel>
              <FormControl>
                <Input placeholder="Resepsiyon PC, Web Sunucu 1..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Açıklama */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Açıklama</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Cihaz hakkında notlar..."
                  rows={2}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ─── Uzak Erişim Bağlantıları ─── */}
        <div className="space-y-2 pt-1">
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Uzak Erişim Bağlantıları</p>

            {/* Mevcut / eklenmiş satırlar */}
            {visibleRows.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {connRows.map((row, idx) =>
                  row._delete ? null : (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm bg-muted/30"
                    >
                      <Badge variant="secondary" className="text-xs shrink-0 font-normal">
                        {getToolLabel(row.tool)}
                      </Badge>
                      <span className="font-mono text-xs flex-1 truncate text-foreground">
                        {row.remoteId}
                      </span>
                      {row.id && (
                        <span className="text-[10px] text-muted-foreground shrink-0">mevcut</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeConnRow(idx)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Yeni bağlantı ekleme satırı */}
            <div className="flex gap-1.5 items-center">
              <Select value={newTool} onValueChange={setNewTool}>
                <SelectTrigger className="w-[108px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONNECTION_TOOLS.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                className="h-8 text-xs flex-1 min-w-0"
                placeholder="Bağlantı No / ID"
                value={newRemoteId}
                onChange={(e) => setNewRemoteId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addConnRow(); }
                }}
              />

              <Input
                className="h-8 text-xs w-24"
                placeholder="Şifre"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addConnRow(); }
                }}
              />

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 px-2 shrink-0"
                disabled={!newRemoteId.trim()}
                onClick={addConnRow}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {visibleRows.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Bağlantı numarasını girin ve + ile ekleyin.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Kaydediliyor..." : item ? "Güncelle" : "Oluştur"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComputersPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingComputer, setEditingComputer] = useState<Computer | null>(null);
  const [editingConnections, setEditingConnections] = useState<ConnRow[]>([]);

  const fetchComputers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search            !== ""    ? { search }                        : {}),
        ...(companyFilter    !== "ALL" ? { companyId: companyFilter }       : {}),
        ...(deviceTypeFilter !== "ALL" ? { deviceType: deviceTypeFilter }   : {}),
      });
      const res  = await fetch(`/api/computers?${params}`);
      const json = await res.json();
      if (json.success) {
        setComputers(json.data.items);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, companyFilter, deviceTypeFilter]);

  const fetchCompanies = useCallback(async () => {
    const res  = await fetch("/api/companies?pageSize=200");
    const json = await res.json();
    if (json.success) setCompanies(json.data.items);
  }, []);

  useEffect(() => { fetchComputers(); }, [fetchComputers]);
  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  function openCreate() {
    setEditingComputer(null);
    setEditingConnections([]);
    setDialogOpen(true);
  }

  async function openEdit(computer: Computer) {
    setEditingComputer(computer);
    try {
      const res  = await fetch(`/api/connections?computerId=${computer.id}&pageSize=100`);
      const json = await res.json();
      if (json.success) {
        setEditingConnections(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          json.data.items.map((c: any) => ({
            id:       c.id,
            tool:     c.tool,
            remoteId: c.remoteId,
            password: "",
            _delete:  false,
          }))
        );
      } else {
        setEditingConnections([]);
      }
    } catch {
      setEditingConnections([]);
    }
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu cihazı silmek istediğinize emin misiniz?")) return;
    const res  = await fetch(`/api/computers/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.success("Cihaz silindi");
      fetchComputers();
    } else {
      toast.error(json.error ?? "Silinemedi");
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
            placeholder="Cihaz veya firma ara..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Firma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tüm Firmalar</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={deviceTypeFilter} onValueChange={(v) => { setDeviceTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[155px]">
            <SelectValue placeholder="Cihaz Türü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tüm Türler</SelectItem>
            {DEVICE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Cihaz
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cihaz</TableHead>
              <TableHead className="hidden sm:table-cell">Tür</TableHead>
              <TableHead>Firma</TableHead>
              <TableHead className="hidden sm:table-cell">Bağlantılar</TableHead>
              <TableHead className="hidden lg:table-cell">Açıklama</TableHead>
              <TableHead className="hidden lg:table-cell">Güncelleme</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Yükleniyor...
                </TableCell>
              </TableRow>
            ) : computers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Cihaz bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              computers.map((computer) => (
                <TableRow key={computer.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <DeviceIcon
                        type={computer.deviceType}
                        className="h-4 w-4 text-muted-foreground shrink-0"
                      />
                      <span className="font-medium">{computer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <DeviceTypeBadge type={computer.deviceType} />
                  </TableCell>
                  <TableCell className="text-sm">{computer.company.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <ConnectionsBadges
                      computerId={computer.id}
                      rustdesk={computer._count.rustdesk}
                      anydesk={computer._count.anydesk}
                      total={computer._count.connections}
                    />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[180px] truncate">
                    {computer.description ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {formatDate(computer.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(computer)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(computer.id)}
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
            <span className="flex items-center px-2">{page} / {totalPages}</span>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingComputer ? "Cihazı Düzenle" : "Yeni Cihaz"}
            </DialogTitle>
          </DialogHeader>
          <ComputerForm
            key={dialogOpen ? (editingComputer?.id ?? "new") : undefined}
            item={editingComputer}
            companies={companies}
            initConnections={editingConnections}
            onSuccess={() => {
              setDialogOpen(false);
              fetchComputers();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
