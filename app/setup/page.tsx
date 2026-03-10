"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Wifi, Eye, EyeOff, ShieldCheck, Database, Shield, ShieldOff, Copy, Check } from "lucide-react";
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

type Step = "form" | "2fa-question" | "2fa-setup";

interface TotpData {
  secret: string;
  qrDataUrl: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [step,      setStep]      = useState<Step>("form");
  const [showPwd,   setShowPwd]   = useState(false);
  const [allowed,   setAllowed]   = useState<boolean | null>(null);
  const [error,     setError]     = useState("");
  const [totp,      setTotp]      = useState<TotpData | null>(null);
  const [totpCode,  setTotpCode]  = useState("");
  const [totpError, setTotpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied,    setCopied]    = useState(false);

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.canSetup) setAllowed(true);
        else if (j.error)     setError(j.error);
        else                  router.replace("/login");
      })
      .catch(() => setError("Sunucuya ulaşılamadı. Veritabanı bağlantı ayarlarını kontrol edin."));
  }, [router]);

  const form = useForm<SetupInput>({
    resolver: zodResolver(SetupSchema),
    defaultValues: { username: "", email: "", password: "", confirm: "" },
  });

  // Adım 1: Hesap oluştur
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
      setStep("2fa-question");
    } catch {
      setError("Sunucuya ulaşılamadı");
    }
  }

  // Adım 2: Google Auth istedi → QR üret
  async function handleWants2FA() {
    try {
      const res  = await fetch("/api/auth/2fa/setup");
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "QR oluşturulamadı"); return; }
      setTotp({ secret: json.data.secret, qrDataUrl: json.data.qrDataUrl });
      setStep("2fa-setup");
    } catch {
      setError("Sunucuya ulaşılamadı");
    }
  }

  // Adım 2: İstemedi → direkt dashboard
  function handleSkip2FA() {
    router.push("/dashboard");
  }

  // Adım 3: Kodu doğrula ve 2FA'yı etkinleştir
  async function handleVerify2FA() {
    if (!totp) return;
    const clean = totpCode.replace(/\s/g, "");
    if (clean.length < 6) { setTotpError("6 haneli kodu eksiksiz girin"); return; }

    setTotpError("");
    setVerifying(true);
    try {
      const res  = await fetch("/api/auth/2fa/setup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ secret: totp.secret, code: clean }),
      });
      const json = await res.json();
      if (!res.ok) { setTotpError(json.error ?? "Kod hatalı, tekrar deneyin"); return; }
      router.push("/dashboard");
    } catch {
      setTotpError("Sunucuya ulaşılamadı");
    } finally {
      setVerifying(false);
    }
  }

  function copySecret() {
    if (!totp) return;
    navigator.clipboard.writeText(totp.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (allowed === null) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mx-auto">
          <Wifi className="h-6 w-6 text-primary" />
        </div>
        {error ? (
          <>
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-left">
              {error}
            </div>
            <Link
              href="/db-config"
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <Database className="h-4 w-4" />
              Veritabanı bağlantı ayarlarını yapılandır
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        )}
      </div>
    </div>
  );

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
            {step === "form"         && "İlk kurulum — yönetici hesabı oluşturun"}
            {step === "2fa-question" && "İki adımlı doğrulama"}
            {step === "2fa-setup"    && "Google Authenticator kurulumu"}
          </p>
        </div>

        {/* ── ADIM 1: Hesap Formu ── */}
        {step === "form" && (
          <>
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
          </>
        )}

        {/* ── ADIM 2: 2FA Sorusu ── */}
        {step === "2fa-question" && (
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Google Authenticator kullanmak ister misiniz?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Hesabınızı korumak için iki adımlı doğrulama ekleyebilirsiniz.
                  Daha sonra ayarlardan da aktif edebilirsiniz.
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={handleWants2FA}>
                <Shield className="mr-2 h-4 w-4" />
                Evet, şimdi kur
              </Button>
              <Button variant="outline" className="w-full" onClick={handleSkip2FA}>
                <ShieldOff className="mr-2 h-4 w-4" />
                Hayır, atla
              </Button>
            </div>
          </div>
        )}

        {/* ── ADIM 3: QR Kurulum ── */}
        {step === "2fa-setup" && totp && (
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">

            <p className="text-sm text-muted-foreground text-center">
              Google Authenticator uygulamasıyla QR kodu tarayın.
            </p>

            {/* QR */}
            <div className="flex justify-center">
              <div className="rounded-lg border p-2 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={totp.qrDataUrl} alt="2FA QR Kodu" width={180} height={180} />
              </div>
            </div>

            {/* Manuel secret */}
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1">Manuel giriş için secret:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono flex-1 break-all">{totp.secret}</code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Kod girişi */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Uygulamadan kodu girin</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000 000"
                value={totpCode}
                onChange={(e) => {
                  setTotpCode(e.target.value.replace(/[^0-9 ]/g, "").slice(0, 7));
                  setTotpError("");
                }}
                className="text-center text-2xl tracking-widest font-mono h-14"
                autoComplete="one-time-code"
              />
              {totpError && (
                <p className="text-sm text-destructive">{totpError}</p>
              )}
            </div>

            <Button className="w-full" onClick={handleVerify2FA} disabled={verifying}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {verifying ? "Doğrulanıyor..." : "Doğrula ve Bitir"}
            </Button>

            <button
              type="button"
              onClick={handleSkip2FA}
              className="w-full text-sm text-muted-foreground hover:text-foreground text-center"
            >
              Şimdilik atla
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
