"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wifi, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode]     = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\s/g, "").length < 6) {
      setError("6 haneli kodu eksiksiz girin");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/2fa/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Kod hatalı"); return; }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı");
    } finally {
      setLoading(false);
    }
  }

  // Sadece rakam ve boşluk kabul et, 7 karakterle sınırla
  function handleCodeChange(val: string) {
    const filtered = val.replace(/[^0-9 ]/g, "").slice(0, 7);
    setCode(filtered);
    setError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Wifi className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">İki Adımlı Doğrulama</h1>
          <p className="text-sm text-muted-foreground text-center">
            Google Authenticator uygulamasındaki 6 haneli kodu girin
          </p>
        </div>

        {/* Kart */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label htmlFor="totp-code" className="text-sm font-medium">
                Doğrulama Kodu
              </label>
              <Input
                id="totp-code"
                ref={inputRef}
                type="text"
                inputMode="numeric"
                placeholder="000 000"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="text-center text-2xl tracking-widest font-mono h-14"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground">
                Kod 30 saniyede bir yenilenir
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Doğrulanıyor..." : (
                <><ShieldCheck className="mr-2 h-4 w-4" /> Doğrula ve Giriş Yap</>
              )}
            </Button>
          </form>
        </div>

        {/* Geri dön */}
        <p className="text-center text-sm text-muted-foreground">
          <a href="/login" className="underline underline-offset-4 hover:text-foreground">
            Farklı hesapla giriş yap
          </a>
        </p>
      </div>
    </div>
  );
}
