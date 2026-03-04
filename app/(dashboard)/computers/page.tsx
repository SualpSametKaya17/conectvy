"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Monitor, Server, Cloud } from "lucide-react";
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
import { formatDate, DEVICE_TYPES } from "@/lib/utils";

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

// ─── ComputerForm ─────────────────────────────────────────────────────────────

function ComputerForm({
  item,
  companies,
  onSuccess,
}: {
  item: Computer | null;
  companies: Company[];
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

  async function onSubmit(values: CreateComputerInput) {
    const url    = item ? `/api/computers/${item.id}` : "/api/computers";
    const method = item ? "PATCH" : "POST";
    try {
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Hata"); return; }
      toast.success(item ? "Cihaz güncellendi" : "Cihaz oluşturuldu");
      onSuccess();
    } catch {
      toast.error("Sunucuya ulaşılamadı");
    }
  }

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
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-2">
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

  const fetchComputers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search !== ""          ? { search }                        : {}),
        ...(companyFilter    !== "ALL" ? { companyId: companyFilter }    : {}),
        ...(deviceTypeFilter !== "ALL" ? { deviceType: deviceTypeFilter } : {}),
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
    setDialogOpen(true);
  }

  function openEdit(computer: Computer) {
    setEditingComputer(computer);
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
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cihaz</TableHead>
              <TableHead>Tür</TableHead>
              <TableHead>Firma</TableHead>
              <TableHead>Bağlantılar</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead>Güncelleme</TableHead>
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
                  <TableCell>
                    <DeviceTypeBadge type={computer.deviceType} />
                  </TableCell>
                  <TableCell className="text-sm">{computer.company.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {computer._count.rustdesk > 0 && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          RustDesk{computer._count.rustdesk > 1 ? ` ×${computer._count.rustdesk}` : ""}
                        </Badge>
                      )}
                      {computer._count.anydesk > 0 && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          AnyDesk{computer._count.anydesk > 1 ? ` ×${computer._count.anydesk}` : ""}
                        </Badge>
                      )}
                      {computer._count.connections === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                    {computer.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingComputer ? "Cihazı Düzenle" : "Yeni Cihaz"}
            </DialogTitle>
          </DialogHeader>
          <ComputerForm
            key={dialogOpen ? (editingComputer?.id ?? "new") : undefined}
            item={editingComputer}
            companies={companies}
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
