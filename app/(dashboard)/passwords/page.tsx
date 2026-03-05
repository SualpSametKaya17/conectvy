"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2,
  Eye, EyeOff, Copy, KeyRound, ExternalLink, StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CreatePasswordSchema, type CreatePasswordInput, PASSWORD_CATEGORIES } from "@/lib/validations/password";
import { formatDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PasswordEntry {
  id: number;
  title: string;
  username: string | null;
  url: string | null;
  category: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Category badge ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "E-posta":     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Sosyal Medya":"bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "Banka":       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "İş":          "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Sunucu":      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "Diğer":       "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  "Genel":       "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

function CategoryBadge({ category }: { category: string | null }) {
  const cat = category ?? "Genel";
  const cls = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["Genel"];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {cat}
    </span>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ getValue, label, icon: Icon }: {
  getValue: () => Promise<string | null>;
  label: string;
  icon: React.ElementType;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      const v = await getValue();
      if (v) {
        await navigator.clipboard.writeText(v);
        toast.success(`${label} kopyalandı`);
      } else {
        toast.info(`${label} yok`);
      }
    } catch {
      toast.error("Kopyalanamadı");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={`${label} kopyala`}
      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ─── PasswordForm ─────────────────────────────────────────────────────────────

function PasswordForm({
  item,
  onSuccess,
}: {
  item: (PasswordEntry & { password?: string }) | null;
  onSuccess: () => void;
}) {
  const [showPwd, setShowPwd] = useState(false);

  const form = useForm<CreatePasswordInput>({
    resolver: zodResolver(CreatePasswordSchema),
    defaultValues: {
      title:    item?.title    ?? "",
      username: item?.username ?? "",
      password: item?.password ?? "",
      url:      item?.url      ?? "",
      category: item?.category ?? "Genel",
      notes:    item?.notes    ?? "",
    },
  });

  async function onSubmit(values: CreatePasswordInput) {
    const url    = item ? `/api/passwords/${item.id}` : "/api/passwords";
    const method = item ? "PATCH" : "POST";
    try {
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Hata oluştu");
        return;
      }
      toast.success(item ? "Güncellendi" : "Kaydedildi");
      onSuccess();
    } catch {
      toast.error("Sunucuya ulaşılamadı");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* Başlık */}
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Başlık *</FormLabel>
            <FormControl>
              <Input placeholder="Gmail, Sunucu 1, VPN..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Kategori */}
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem>
            <FormLabel>Kategori</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? "Genel"}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seç..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {PASSWORD_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        {/* Kullanıcı adı */}
        <FormField control={form.control} name="username" render={({ field }) => (
          <FormItem>
            <FormLabel>Kullanıcı Adı / E-posta</FormLabel>
            <FormControl>
              <Input placeholder="user@example.com" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Şifre */}
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Şifre</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  {...field}
                  value={field.value ?? ""}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* URL */}
        <FormField control={form.control} name="url" render={({ field }) => (
          <FormItem>
            <FormLabel>URL</FormLabel>
            <FormControl>
              <Input placeholder="https://example.com" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Notlar */}
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notlar</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Ek bilgiler, güvenlik soruları..."
                rows={3}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

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

export default function PasswordsPage() {
  const [entries, setEntries]   = useState<PasswordEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const pageSize = 15;

  const [search, setSearch]         = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [loading, setLoading]       = useState(false);

  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editItem, setEditItem]       = useState<(PasswordEntry & { password?: string }) | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [notesViewEntry, setNotesViewEntry] = useState<PasswordEntry | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search         ? { search }                                : {}),
        ...(categoryFilter !== "ALL" ? { category: categoryFilter }   : {}),
      });
      const res  = await fetch(`/api/passwords?${params}`);
      const json = await res.json();
      if (json.success) {
        setEntries(json.data.items);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, categoryFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Arama değişince 1. sayfaya dön
  useEffect(() => { setPage(1); }, [search, categoryFilter]);

  async function openEdit(entry: PasswordEntry) {
    try {
      const res  = await fetch(`/api/passwords/${entry.id}`);
      const json = await res.json();
      if (json.success) setEditItem(json.data);
      else              setEditItem(entry);
    } catch {
      setEditItem(entry);
    }
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    const res  = await fetch(`/api/passwords/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.success("Kayıt silindi");
      fetchEntries();
    } else {
      toast.error(json.error ?? "Silinemedi");
    }
  }

  function getPassword(id: number) {
    return async () => {
      const res  = await fetch(`/api/passwords/${id}`);
      const json = await res.json();
      return json.data?.password ?? null;
    };
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Şifrelerim</h1>
          <p className="text-sm text-muted-foreground">Kayıtlı kullanıcı adı ve şifreleriniz</p>
        </div>
        <Button size="sm" onClick={() => { setEditItem(null); setDialogOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Ekle
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Başlık, kullanıcı adı veya URL ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tüm kategoriler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tüm Kategoriler</SelectItem>
            {PASSWORD_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Başlık</TableHead>
              <TableHead className="hidden sm:table-cell">Kategori</TableHead>
              <TableHead className="hidden md:table-cell">Kullanıcı Adı</TableHead>
              <TableHead className="hidden lg:table-cell">URL</TableHead>
              <TableHead className="hidden lg:table-cell">Güncelleme</TableHead>
              <TableHead className="w-28 text-center">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Yükleniyor...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Kayıt bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{entry.title}</span>
                      {entry.notes && (
                        <button
                          onClick={() => setNotesViewEntry(entry)}
                          className="shrink-0 focus:outline-none"
                          title="Notu görüntüle"
                        >
                          <StickyNote className="h-3.5 w-3.5 text-amber-500 hover:text-amber-600 transition-colors" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <CategoryBadge category={entry.category} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {entry.username ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[200px]">
                    {entry.url ? (
                      <a
                        href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {entry.url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {formatDate(entry.updatedAt)}
                  </TableCell>
                  {/* Hızlı işlem butonları + menü */}
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {/* Kullanıcı adı kopyala */}
                      {entry.username && (
                        <CopyButton
                          getValue={async () => entry.username}
                          label="Kullanıcı adı"
                          icon={Copy}
                        />
                      )}
                      {/* Şifre kopyala */}
                      <CopyButton
                        getValue={getPassword(entry.id)}
                        label="Şifre"
                        icon={KeyRound}
                      />
                      {/* Menü */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(entry)}>
                            <Pencil className="mr-2 h-4 w-4" /> Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setConfirmDeleteId(entry.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {total} kayıt</span>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Önceki
            </Button>
            <span className="flex items-center px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Sonraki
            </Button>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Kaydı Düzenle" : "Yeni Şifre Ekle"}</DialogTitle>
          </DialogHeader>
          <PasswordForm
            key={dialogOpen ? (editItem?.id ?? "new") : undefined}
            item={editItem}
            onSuccess={() => { setDialogOpen(false); fetchEntries(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Notes popup */}
      <Dialog open={notesViewEntry !== null} onOpenChange={(open) => { if (!open) setNotesViewEntry(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              {notesViewEntry?.title}
            </DialogTitle>
          </DialogHeader>
          {notesViewEntry?.notes && (
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" /> Notlar
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{notesViewEntry.notes}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="Kaydı sil"
        description="Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={async () => {
          if (confirmDeleteId) await handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}
