import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth, roleLabel } from "@/lib/auth";
import {
  LayoutDashboard, GraduationCap, UserPlus, Receipt, BookOpen,
  AlertTriangle, BarChart3, ShieldCheck, LogOut, Settings, Menu, X,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useCampus } from "@/lib/campus";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles: ("admin" | "cashier")[] };

const navItems: NavItem[] = [
  { to: "/dashboard",  label: "Dashboard",        icon: LayoutDashboard, roles: ["admin", "cashier"] },
  { to: "/students",   label: "Students",          icon: GraduationCap,   roles: ["admin", "cashier"] },
  { to: "/enroll",     label: "Enroll Student",    icon: UserPlus,        roles: ["admin"] },
  { to: "/collect",    label: "Collect Fee",       icon: Receipt,         roles: ["admin", "cashier"] },
  { to: "/courses",    label: "Courses & Batches", icon: BookOpen,        roles: ["admin"] },
  { to: "/defaulters", label: "Defaulters",        icon: AlertTriangle,   roles: ["admin", "cashier"] },
  { to: "/reports",    label: "Reports",           icon: BarChart3,       roles: ["admin", "cashier"] },
  { to: "/audit",      label: "Audit Trail",       icon: ShieldCheck,     roles: ["admin"] },
  { to: "/settings",   label: "Settings",          icon: Settings,        roles: ["admin"] },
];

export function AppShell() {
  const { fullName, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { campuses, campus, campusId, setCampusId } = useCampus();

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const visible = navItems.filter((i) => role && i.roles.includes(role));

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Mobile backdrop ───────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card",
          "transition-transform duration-200 ease-in-out",
          "lg:static lg:translate-x-0 lg:transition-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              E
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-foreground">ENA Fees</div>
              <div className="truncate text-[10px] text-muted-foreground">Excellent NEET Academy</div>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border p-3 space-y-2">
          {campus && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Building2 className="h-3 w-3" /> Active Campus
              </div>
              <div className="truncate text-xs font-semibold text-foreground mt-0.5">{campus.name}</div>
              {campus.city && <div className="truncate text-[10px] text-muted-foreground">{campus.city}</div>}
            </div>
          )}
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Signed in as</div>
            <div className="truncate text-xs font-semibold text-foreground mt-0.5">{fullName || "—"}</div>
            <span className="mt-0.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {roleLabel(role)}
            </span>
          </div>
          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleSignOut}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <span className="text-sm font-semibold lg:hidden">ENA Fees</span>

          <div className="ml-auto flex items-center gap-2">
            {campus && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <Building2 className="h-3 w-3" />
                {campus.name}
              </span>
            )}
            {campuses.length > 1 && (
              <Select value={campusId ?? undefined} onValueChange={(v) => setCampusId(v)}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Switch campus" />
                </SelectTrigger>
                <SelectContent>
                  {campuses.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}{c.city ? ` · ${c.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="mx-auto w-full max-w-screen-2xl min-w-0 p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
