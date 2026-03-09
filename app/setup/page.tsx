"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Wifi, Eye, EyeOff, ShieldCheck, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";

const SetupSchema = z.object({
  username: z.string().min(3, "En az 3 karakter").max(100),
  email:    z.string().email("Geçerli e-posta giriniz").max(255).optional().or(z.literal("")),
  password: z.string().min(6, "En az 6 karakter"),
  confirm:  z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Şifreler eşleşmiyor",
  path:    ["confirm"],
});
type SetupInput = z.infer<typeof SetupSchema>;

export default function SetupPage() {
  const router = useRouter();
  const [showPwd, setShowPwd]   = useState(false);
  const [allowed, setAllowed]   = useState<boolean | null>(null);
  const [error,   setError]     = useState("");

  useEffect(() => {
    fetch("/api/auth/setup").then((r) => r.json()).then((j) => {
      if (j.data?.canSetup) setAllowed(true);
      else router.replace("/login");
    });
  }, [router]);

  const form = useForm<SetupInput>({
    resolver: zodResolver(SetupSchema),
    defaultValues: { username: "", email: "", password: "", confirm: "" },
  });

  async function onSubmit(values: SetupInput) {
    setError("");
    try {
      const res  = await fetch("/api/auth/setup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Hata oluştu"); return; }
      router.push("/login");
    } catch {
      setError("Sunucuya ulaşılamadı");
    }
  }

  if (allowed === null) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Wifi className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Conectvy</h1>
          <p className="text-sm text-muted-foreground text-center">
            İlk kurulum — yönetici hesabı oluşturun
          </p>
        </div>

        {/* DB bağlantı ayarları linki */}
        <Link
          href="/db-config"
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        >
          <Database className="h-4 w-4" />
          Veritabanı bağlantı ayarlarını yapılandır
        </Link>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-1">
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            Bu sayfa yalnızca ilk kurulumda görüntülenir.
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kullanıcı Adı *</FormLabel>
                  <FormControl>
                    <Input placeholder="admin" autoComplete="username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-posta (isteğe bağlı)</FormLabel>
                  <FormControl>
                    <Input placeholder="admin@example.com" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Şifre *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPwd ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        {...field}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="confirm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Şifre Tekrar *</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Oluşturuluyor..." : "Hesap Oluştur"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
