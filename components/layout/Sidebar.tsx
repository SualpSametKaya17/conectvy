"use client";

import { SidebarNav } from "./SidebarNav";

export function Sidebar() {
  return (
    <aside className="hidden lg:flex h-screen w-[var(--sidebar-width)] flex-col border-r bg-card">
      <SidebarNav />
    </aside>
  );
}
