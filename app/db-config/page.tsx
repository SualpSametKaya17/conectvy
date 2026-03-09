"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Database, CheckCircle2, XCircle, RefreshCw, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DbConfig {
  MSSQL_HOST: string;
  MSSQL_PORT: string;
  MSSQL_DATABASE: string;
  MSSQL_USER: string;
  MSSQL_PASSWORD: string;
  MSSQL_TRUST_SERVER_CERTIFICATE: string;
}

const DEFAULTS: DbConfig = {
  MSSQL_HOST: "localhost",
  MSSQL_PORT: "1433",
  MSSQL_DATABASE: "ConectvyDB",
  MSSQL_USER: "sa",
  MSSQL_PASSWORD: "",
  MSSQL_TRUST_SERVER_CERTIFICATE: "false",
};

type TestState = "idle" | "testing" | "ok" | "error";

export default function DbConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<DbConfig>(DEFAULTS);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isElectron = typeof window !== "undefined" && !!window.electron;

  // Kaydedilmiş ayarları yükle
  useEffect(() => {
    if (!isElectron) return;
    window.electron!.dbConfig.read().then((saved) => {
      if (saved && Object.keys(saved).length > 0) {
        setConfig((prev) => ({ ...prev, ...saved }));
      }
    });
  }, [isElectron]);

  function set(key: keyof DbConfig, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setTestState("idle");
    setSaved(false);
  }

  async function handleTest() {
    setTestState("testing");
    setTestError("");
    try {
      const res = await fetch("/api/db-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: config.MSSQL_HOST,
          port: config.MSSQL_PORT,
          database: config.MSSQL_DATABASE,
          user: config.MSSQL_USER,
          password: config.MSSQL_PASSWORD,
          trustServerCertificate: config.MSSQL_TRUST_SERVER_CERTIFICATE,
        }),
      });
      const json = await res.json();
      if (json.connected) {
        setTestState("ok");
      } else {
        setTestState("error");
        setTestError(json.error ?? "Bağlantı kurulamadı");
      }
    } catch {
      setTestState("error");
      setTestError("Sunucuya ulaşılamadı");
    }
  }

  async function handleSave() {
    if (!isElectron) return;
    setSaving(true);
    try {
      await window.electron!.dbConfig.write(config as unknown as Record<string, string>);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndRelaunch() {
    if (!isElectron) return;
    await handleSave();
    window.electron!.relaunch();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Başlık */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Veritabanı Bağlantısı</h1>
          <p className="text-sm text-muted-foreground text-center">
            SQL Server bağlantı ayarlarını yapılandırın
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">

          {!isElectron && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              Tarayıcı modunda çalışıyor. Ayarlar yalnızca Electron uygulamasında kaydedilebilir.
              Ortam değişkenlerini <code className="font-mono">.env</code> dosyasından ayarlayın.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="host">Sunucu (Host)</Label>
              <Input
                id="host"
                placeholder="localhost veya 192.168.1.100"
                value={config.MSSQL_HOST}
                onChange={(e) => set("MSSQL_HOST", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                placeholder="1433"
                value={config.MSSQL_PORT}
                onChange={(e) => set("MSSQL_PORT", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="database">Veritabanı</Label>
              <Input
                id="database"
                placeholder="ConectvyDB"
                value={config.MSSQL_DATABASE}
                onChange={(e) => set("MSSQL_DATABASE", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user">Kullanıcı Adı</Label>
              <Input
                id="user"
                placeholder="sa"
                autoComplete="username"
                value={config.MSSQL_USER}
                onChange={(e) => set("MSSQL_USER", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={config.MSSQL_PASSWORD}
                onChange={(e) => set("MSSQL_PASSWORD", e.target.value)}
              />
            </div>
          </div>

          {/* Trust Certificate */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={config.MSSQL_TRUST_SERVER_CERTIFICATE === "true"}
              onChange={(e) =>
                set("MSSQL_TRUST_SERVER_CERTIFICATE", e.target.checked ? "true" : "false")
              }
            />
            <span className="text-sm">Sunucu sertifikasına güven (Trust Server Certificate)</span>
          </label>

          {/* Test sonucu */}
          {testState === "ok" && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Bağlantı başarılı!
            </div>
          )}
          {testState === "error" && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="break-all">{testError}</span>
            </div>
          )}

          {/* Aksiyonlar */}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testState === "testing"}
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${testState === "testing" ? "animate-spin" : ""}`} />
              {testState === "testing" ? "Test ediliyor..." : "Bağlantıyı Test Et"}
            </Button>

            {isElectron && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saved ? "Kaydedildi ✓" : saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>

                <Button
                  onClick={handleSaveAndRelaunch}
                  disabled={saving}
                  className="w-full"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Kaydet ve Yeniden Başlat
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Geri dön */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Geri dön
        </button>
      </div>
    </div>
  );
}
