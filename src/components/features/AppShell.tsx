"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const Sidebar = dynamic(() => import("@/components/features/Sidebar"), { ssr: false });

const NO_SIDEBAR_PATHS = ["/login"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !NO_SIDEBAR_PATHS.some((p) => pathname.startsWith(p));

  return (
    <>
      {showSidebar && <Sidebar />}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </>
  );
}
