"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/connections": "Bağlantılar",
  "/companies": "Firmalar",
  "/computers": "Bilgisayarlar",
  "/regions": "Bölgeler",
  "/settings": "Ayarlar",
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Prefix match (e.g. /connections/123)
  const prefix = Object.keys(pageTitles).find((k) => pathname.startsWith(k + "/"));
  return prefix ? pageTitles[prefix] : "Conectvy";
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6 titlebar-drag">
      <h1 className="text-base font-semibold titlebar-no-drag">{title}</h1>
      <div className="flex items-center gap-2 titlebar-no-drag">
        <Button variant="ghost" size="icon" aria-label="Bildirimler">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
