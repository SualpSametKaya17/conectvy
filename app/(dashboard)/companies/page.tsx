"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Clock, CalendarPlus } from "lucide-react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { CreateCompanySchema, type CreateCompanyInput } from "@/lib/validations/company";
import {
  loadMaintenanceSettings,
  type MaintenanceSettings,
} from "@/lib/maintenance-settings";

interface Company {
  id: number;
  name: string;
  description: string | null;
  maintenanceStartDate: string | null;
  maintenanceEndDate: string | null;
  _count: { connections: number; regions: number; computers: number };
}

type MaintenanceStatus = "active" | "expiring" | "urgent" | "expired" | "none";

function getMaintenanceStatus(
  endDate: string | null,
  settings: MaintenanceSettings
): MaintenanceStatus {
  if (!endDate) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate.substring(0, 10) + "T00:00:00");
  if (end < today) return "expired";
  const daysLeft = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= settings.urgentDays) return "urgent";
  if (daysLeft <= settings.warnDays) return "expiring";
  return "active";
}

function getDaysLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate.substring(0, 10) + "T00:00:00");
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function MaintenanceBadge({
  endDate,
  settings,
}: {
  endDate: string | null;
  settings: MaintenanceSettings;
}) {
  const status = getMaintenanceStatus(endDate, settings);
  if (status === "none")
    return <Badge variant="outline" className="text-muted-foreground">Yok</Badge>;
  if (status === "expired")
    return <Badge variant="destructive">Süresi Doldu</Badge>;
  if (status === "urgent")
    return <Badge className="bg-red-600 hover:bg-red-700">Kritik</Badge>;
  if (status === "expiring")
    return <Badge className="bg-orange-500 hover:bg-orange-600">Yakında Bitiyor</Badge>;
  return <Badge className="bg-green-600 hover:bg-green-700">Aktif</Badge>;
}

function MaintenanceWarningBanner({
  endDate,
  settings,
}: {
  endDate: string | null;
  settings: MaintenanceSettings;
}) {
  const status = getMaintenanceStatus(endDate, settings);
  const daysLeft = getDaysLeft(endDate);

  if (status === "none" || status === "active") return null;

  if (status === "expired") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Bakım desteği süresi dolmuş. Lütfen yenileyin.</span>
      </div>
    );
  }

  if (status === "urgent") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-400/40 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Bakım desteği <strong>{daysLeft} gün</strong> içinde bitiyor. Acilen yenileyin!
        </span>
      </div>
    );
  }

  // expiring
  return (
    <div className="flex items-start gap-2 rounded-md border border-orange-400/40 bg-orange-50 px-3 py-2 text-sm text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Bakım desteği <strong>{daysLeft} gün</strong> içinde bitiyor.
      </span>
    </div>
  );
}

function addOneYear(dateStr: string | null): string {
  const base = dateStr && dateStr > new Date().toISOString().substring(0, 10)
    ? dateStr.substring(0, 10)
    : new Date().toISOString().substring(0, 10);
  const d = new Date(base + "T00:00:00");
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().substring(0, 10);
}

function CompanyForm({
  item,
  onSuccess,
  settings,
}: {
  item: Company | null;
  onSuccess: () => void;
  settings: MaintenanceSettings;
}) {
  const itemRef = useRef(item);
  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(CreateCompanySchema),
    defaultValues: {
      name: item?.name ?? "",
      description: item?.description ?? "",
      maintenanceStartDate: item?.maintenanceStartDate
        ? item.maintenanceStartDate.substring(0, 10)
        : "",
      maintenanceEndDate: item?.maintenanceEndDate
        ? item.maintenanceEndDate.substring(0, 10)
        : "",
    },
  });

  // item prop değiştiğinde formu sıfırla
  useEffect(() => {
    if (itemRef.current?.id !== item?.id) {
      itemRef.current = item;
      form.reset({
        name: item?.name ?? "",
        description: item?.description ?? "",
        maintenanceStartDate: item?.maintenanceStartDate
          ? item.maintenanceStartDate.substring(0, 10)
          : "",
        maintenanceEndDate: item?.maintenanceEndDate
          ? item.maintenanceEndDate.substring(0, 10)
          : "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  async function onSubmit(values: CreateCompanyInput) {
    const url = item ? `/api/companies/${item.id}` : "/api/companies";
    const method = item ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          maintenanceStartDate: values.maintenanceStartDate || null,
          maintenanceEndDate: values.maintenanceEndDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Hata"); return; }
      toast.success(item ? "Firma güncellendi" : "Firma oluşturuldu");
      onSuccess();
    } catch {
      toast.error("Sunucuya ulaşılamadı");
    }
  }

  function handleQuickExtend() {
    const currentEnd = form.getValues("maintenanceEndDate");
    const newEnd = addOneYear(currentEnd || null);
    form.setValue("maintenanceEndDate", newEnd, { shouldValidate: true });

    // Başlangıç tarihi yoksa bugünü ata
    const currentStart = form.getValues("maintenanceStartDate");
    if (!currentStart) {
      form.setValue(
        "maintenanceStartDate",
        new Date().toISOString().substring(0, 10),
        { shouldValidate: true }
      );
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Mevcut bakım durumu uyarısı */}
        {item && (
          <MaintenanceWarningBanner
            endDate={item.maintenanceEndDate}
            settings={settings}
          />
        )}

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

        {/* Bakım Destek Tarihleri */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Yıllık Bakım Desteği</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleQuickExtend}
              className="h-7 gap-1 text-xs"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              1 Yıl Uzat
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="maintenanceStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlangıç Tarihi</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Başlangıç tarihi seç..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maintenanceEndDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bitiş Tarihi</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Bitiş tarihi seç..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

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
  const [settings, setSettings] = useState<MaintenanceSettings>({
    warnDays: 30,
    urgentDays: 7,
  });
  const pageSize = 10;

  useEffect(() => {
    setSettings(loadMaintenanceSettings());
  }, []);

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
          className: "hidden md:table-cell",
          render: (r) => (
            <span className="text-sm text-muted-foreground line-clamp-1">{r.description ?? "—"}</span>
          ),
        },
        {
          key: "maintenance",
          header: "Bakım Desteği",
          className: "hidden sm:table-cell",
          render: (r) => <MaintenanceBadge endDate={r.maintenanceEndDate} settings={settings} />,
        },
        {
          key: "computers",
          header: "Bilgisayar",
          className: "hidden sm:table-cell",
          render: (r) => <Badge variant="secondary">{r._count.computers}</Badge>,
        },
        {
          key: "connections",
          header: "Bağlantı",
          className: "hidden sm:table-cell",
          render: (r) => <Badge variant="secondary">{r._count.connections}</Badge>,
        },
        {
          key: "regions",
          header: "Bölge",
          className: "hidden md:table-cell",
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
          settings={settings}
          onSuccess={() => { onSuccess(); fetchData(); }}
        />
      )}
    />
  );
}
