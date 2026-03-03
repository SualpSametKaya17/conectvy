"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateConnectionSchema, type CreateConnectionInput } from "@/lib/validations/connection";
import { CONNECTION_TOOLS } from "@/lib/utils";

interface Company { id: number; name: string }
interface Region  { id: number; name: string }

interface Props {
  defaultValues?: Partial<CreateConnectionInput>;
  connectionId?: number;
  companies: Company[];
  regions: Region[];
  onSuccess: () => void;
}

export function ConnectionForm({ defaultValues, connectionId, companies, regions, onSuccess }: Props) {
  const form = useForm<CreateConnectionInput>({
    resolver: zodResolver(CreateConnectionSchema),
    defaultValues: {
      name: "",
      tool: "RUSTDESK",
      remoteId: "",
      password: "",
      companyId: null,
      regionId: null,
      notes: "",
      ...defaultValues,
    },
  });

  const isEdit = !!connectionId;

  async function onSubmit(values: CreateConnectionInput) {
    const url = isEdit ? `/api/connections/${connectionId}` : "/api/connections";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Bir hata oluştu");
        return;
      }

      toast.success(isEdit ? "Bağlantı güncellendi" : "Bağlantı oluşturuldu");
      onSuccess();
    } catch {
      toast.error("Sunucuya ulaşılamadı");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ad *</FormLabel>
              <FormControl>
                <Input placeholder="Müşteri sunucu 1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Tool + RemoteId */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="tool"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Araç *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seç..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CONNECTION_TOOLS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="remoteId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Remote ID *</FormLabel>
                <FormControl>
                  <Input placeholder="123 456 789" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Password */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Şifre</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Company + Region */}
        <div className="grid grid-cols-2 gap-3">
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
                    <SelectTrigger>
                      <SelectValue placeholder="Seç..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">— Seçilmedi —</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="regionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bölge</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                  value={field.value?.toString() ?? "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seç..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">— Seçilmedi —</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notlar</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Bağlantı hakkında notlar..."
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Kaydediliyor..."
              : isEdit
              ? "Güncelle"
              : "Oluştur"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
