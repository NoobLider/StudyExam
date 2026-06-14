"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Brain,
  BookOpen,
  BarChart2,
  Trophy,
  Settings,
  Flame,
  Star,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getOrCreateUserStats } from "@/lib/db";
import { xpForLevel, xpProgressPercent } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/features/AuthProvider";
import { useContentMode } from "@/components/features/ContentModeProvider";
import { MODE_LABELS } from "@/lib/contentMode";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quiz", label: "Quiz", icon: Brain },
  { href: "/flashcards", label: "Flashcard", icon: BookOpen },
  { href: "/stats", label: "İstatistik", icon: BarChart2 },
  { href: "/rewards", label: "Ödüller", icon: Trophy },
  { href: "/admin", label: "İçerik", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { mode, setMode } = useContentMode();
  const stats = useLiveQuery(() => db.userStats.toArray().then((arr) => arr[0] ?? null), []);

  const xpPercent = stats ? xpProgressPercent(stats.xp) : 0;
  const nextLevelXp = stats ? xpForLevel(stats.level) : 100;

  const sidebarContent = (
    <>
      <div className="mb-4 px-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">StudyExam</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Edebiyat Platformu</p>
        </div>
        <button
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
      </div>
      {user && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{user.displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">@{user.username} · {user.role}</p>
          </div>
          <button
            onClick={logout}
            title="Çıkış Yap"
            className="ml-2 shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}
      {stats && (
        <div className="mb-6 rounded-xl bg-muted/60 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">Seviye {stats.level}</span>
            <div className="flex items-center gap-1 text-amber-500">
              <Flame size={14} />
              <span className="font-bold">{stats.streak}</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star size={11} className="text-yellow-400" />
              {stats.xp} XP
            </span>
            <span>{nextLevelXp} XP&apos;e kadar</span>
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Content Mode toggle */}
      {mode && (
        <button
          onClick={() => setMode(mode === "comprehensive" ? "exam" : "comprehensive")}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full"
          title="İçerik setini değiştir"
        >
          <span className="truncate">{MODE_LABELS[mode]}</span>
        </button>
      )}
      {/* Dark / Light toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full"
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        {theme === "dark" ? "Aydınlık Mod" : "Karanlık Mod"}
      </button>

      {stats && (
        <div className="mt-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          <div className="flex justify-between mb-1">
            <span>Günlük Hedef</span>
            <span className="font-medium text-foreground">
              {stats.todayQuestions}/{stats.dailyGoal}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{
                width: `${Math.min(100, Math.round((stats.todayQuestions / stats.dailyGoal) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Hamburger button — only on mobile */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 rounded-lg border border-border bg-background p-2 shadow-sm"
        onClick={() => setMobileOpen(true)}
        aria-label="Menüyü aç"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-sidebar px-3 py-4 transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar — always visible */}
      <aside className="hidden md:flex h-full w-60 flex-col border-r border-border bg-sidebar px-3 py-4 shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}
