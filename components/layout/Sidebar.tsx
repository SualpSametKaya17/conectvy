"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Monitor,
  Building2,
  Map,
  Settings,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  {
    group: "Ana Menü",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/connections", label: "Bağlantılar", icon: Monitor },
    ],
  },
  {
    group: "Tanımlar",
    items: [
      { href: "/companies", label: "Firmalar", icon: Building2 },
      { href: "/regions", label: "Bölgeler", icon: Map },
    ],
  },
  {
    group: "Sistem",
    items: [{ href: "/settings", label: "Ayarlar", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[var(--sidebar-width)] flex-col border-r bg-card">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center gap-2 border-b px-4 titlebar-drag">
        <Wifi className="h-5 w-5 text-primary titlebar-no-drag" />
        <span className="font-semibold tracking-tight titlebar-no-drag">Conectvy</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navItems.map((group, gi) => (
          <div key={group.group} className={cn(gi > 0 && "mt-4")}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.group}
            </p>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Tooltip key={href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            })}
            {gi < navItems.length - 1 && <Separator className="mt-3" />}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          v{process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}
        </p>
      </div>
    </aside>
  );
}
