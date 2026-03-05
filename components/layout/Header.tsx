"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Menu, X, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./SidebarNav";
import { useTheme } from "@/components/theme-provider";

const pageTitles: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/connections": "Bağlantılar",
  "/companies":   "Firmalar",
  "/computers":   "Bilgisayarlar",
  "/regions":     "Bölgeler",
  "/settings":    "Ayarlar",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const prefix = Object.keys(pageTitles).find((k) => pathname.startsWith(k + "/"));
  return prefix ? pageTitles[prefix] : "Conectvy";
}

export function Header() {
  const pathname  = usePathname();
  const title     = getPageTitle(pathname);
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useTheme();

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b bg-background px-4 titlebar-drag shrink-0">
        <div className="flex items-center gap-3 titlebar-no-drag">
          {/* Hamburger — only on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold titlebar-no-drag">{title}</h1>
        </div>

        <div className="flex items-center gap-2 titlebar-no-drag">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Tema değiştir">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Bildirimler">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="absolute inset-y-0 left-0 w-64 bg-card shadow-xl">
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3.5 z-10 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
