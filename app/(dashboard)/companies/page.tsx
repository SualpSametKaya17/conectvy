"use client";

/**
 * Companies Sayfası
 *
 * Acceptance Criteria:
 * - Firmalar tablo şeklinde listelenir (Ad, Açıklama, Bağlantı Sayısı, Bölge Sayısı).
 * - Arama çubuğu ile firma adına göre filtre yapılır.
 * - "Yeni Firma" butonu dialog açar, form Zod ile doğrulanır.
 * - Satır menüsünden düzenle ve sil (soft delete) yapılabilir.
 * - Aynı isimde firma eklenemez (server 409, toast ile gösterilir).
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
import { CreateCompanySchema, type CreateCompanyInput } from "@/lib/validations/company";

interface Company {
  id: number;
  name: string;
  description: string | null;
  _count: { connections: number; regions: number };
}

function CompanyForm({
  item,
  onSuccess,
}: {
  item: Company | null;
  onSuccess: () => void;
}) {
  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(CreateCompanySchema),
    defaultValues: {
      name: item?.name ?? "",
      description: item?.description ?? "",
    },
  });

  async function onSubmit(values: CreateCompanyInput) {
    const url = item ? `/api/companies/${item.id}` : "/api/companies";
    const method = item ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Hata"); return; }
      toast.success(item ? "Firma güncellendi" : "Firma oluşturuldu");
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
              <FormLabel>Firma Adı *</FormLabel>
              <FormControl><Input placeholder="ACME A.Ş." {...field} /></FormControl>
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

export default function CompaniesPage() {
  const [rows, setRows] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/companies?${params}`);
      const json = await res.json();
      if (json.success) { setRows(json.data.items); setTotal(json.data.total); }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(id: number) {
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) { toast.success("Firma silindi"); fetchData(); }
    else toast.error(json.error ?? "Silinemedi");
  }

  return (
    <CrudTable<Company>
      title="Firma"
      createLabel="Yeni Firma"
      columns={[
        { key: "name", header: "Firma Adı", render: (r) => <span className="font-medium">{r.name}</span> },
        {
          key: "description",
          header: "Açıklama",
          render: (r) => (
            <span className="text-sm text-muted-foreground line-clamp-1">{r.description ?? "—"}</span>
          ),
        },
        {
          key: "connections",
          header: "Bağlantı",
          render: (r) => <Badge variant="secondary">{r._count.connections}</Badge>,
        },
        {
          key: "regions",
          header: "Bölge",
          render: (r) => <Badge variant="outline">{r._count.regions}</Badge>,
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
        <CompanyForm
          item={item}
          onSuccess={() => { onSuccess(); fetchData(); }}
        />
      )}
    />
  );
}
