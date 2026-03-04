"use client";

/**
 * Regions Sayfası
 *
 * Acceptance Criteria:
 * - Bölgeler tablo şeklinde listelenir (Ad, Açıklama, Bağlı Firma, Bağlantı Sayısı).
 * - Arama çubuğu ile bölge adına göre filtre yapılır.
 * - "Yeni Bölge" butonu dialog açar; firma seçimi Select ile yapılır.
 * - Düzenle ve sil (soft delete) satır menüsünden yapılabilir.
 */

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CrudTable } from "@/components/shared/CrudTable";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateRegionSchema, type CreateRegionInput } from "@/lib/validations/region";

interface Region {
  id: number;
  name: string;
  description: string | null;
  company: { id: number; name: string } | null;
  _count: { connections: number };
}

interface Company { id: number; name: string }

function RegionForm({
  item,
  companies,
  onSuccess,
}: {
  item: Region | null;
  companies: Company[];
  onSuccess: () => void;
}) {
  const form = useForm<CreateRegionInput>({
    resolver: zodResolver(CreateRegionSchema),
    defaultValues: {
      name: item?.name ?? "",
      description: item?.description ?? "",
      companyId: item?.company?.id ?? null,
    },
  });

  async function onSubmit(values: CreateRegionInput) {
    const url = item ? `/api/regions/${item.id}` : "/api/regions";
    const method = item ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Hata"); return; }
      toast.success(item ? "Bölge güncellendi" : "Bölge oluşturuldu");
      onSuccess();
    } catch {
      toast.error("Sunucuya ulaşılamadı");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bölge Adı *</FormLabel>
              <FormControl><Input placeholder="İstanbul Avrupa" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="companyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Firma</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                value={field.value?.toString() ?? "none"}
              >
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seç..." /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">— Seçilmedi —</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Açıklama</FormLabel>
              <FormControl>
                <Textarea placeholder="Kısa açıklama..." rows={3} {...field} value={field.value ?? ""} />
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

export default function RegionsPage() {
  const [rows, setRows] = useState<Region[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/regions?${params}`);
      const json = await res.json();
      if (json.success) { setRows(json.data.items); setTotal(json.data.total); }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    fetch("/api/companies?pageSize=200")
      .then((r) => r.json())
      .then((j) => { if (j.success) setCompanies(j.data.items); });
  }, []);

  async function handleDelete(id: number) {
    const res = await fetch(`/api/regions/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) { toast.success("Bölge silindi"); fetchData(); }
    else toast.error(json.error ?? "Silinemedi");
  }

  return (
    <CrudTable<Region>
      title="Bölge"
      createLabel="Yeni Bölge"
      columns={[
        { key: "name", header: "Bölge Adı", render: (r) => <span className="font-medium">{r.name}</span> },
        {
          key: "company",
          header: "Firma",
          className: "hidden sm:table-cell",
          render: (r) =>
            r.company ? (
              <Badge variant="outline">{r.company.name}</Badge>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            ),
        },
        {
          key: "description",
          header: "Açıklama",
          className: "hidden md:table-cell",
          render: (r) => (
            <span className="text-sm text-muted-foreground line-clamp-1">{r.description ?? "—"}</span>
          ),
        },
        {
          key: "connections",
          header: "Bağlantı",
          className: "hidden sm:table-cell",
          render: (r) => <Badge variant="secondary">{r._count.connections}</Badge>,
        },
      ]}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      loading={loading}
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1); }}
      onPageChange={setPage}
      onDelete={handleDelete}
      renderForm={({ item, onSuccess }) => (
        <RegionForm
          item={item}
          companies={companies}
          onSuccess={() => { onSuccess(); fetchData(); }}
        />
      )}
    />
  );
}
