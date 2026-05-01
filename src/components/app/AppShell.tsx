import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  GraduationCap,
  UserPlus,
  Receipt,
  BookOpen,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  LogOut,
  Settings,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCampus } from "@/lib/campus";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles: ("admin" | "cashier")[] };

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "cashier"] },
  { to: "/students", label: "Students", icon: GraduationCap, roles: ["admin", "cashier"] },
  { to: "/enroll", label: "Enroll Student", icon: UserPlus, roles: ["admin"] },
  { to: "/collect", label: "Collect Fee", icon: Receipt, roles: ["admin", "cashier"] },
  { to: "/courses", label: "Courses & Batches", icon: BookOpen, roles: ["admin"] },
  { to: "/defaulters", label: "Defaulters", icon: AlertTriangle, roles: ["admin", "cashier"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "cashier"] },
  { to: "/audit", label: "Audit Trail", icon: ShieldCheck, roles: ["admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function AppShell() {
  const { fullName, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { campuses, campus, campusId, setCampusId } = useCampus();

  const visible = navItems.filter((i) => role && i.roles.includes(role));

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--gradient-primary)] text-primary-foreground font-bold">
            E
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">ENA Fees</div>
            <div className="text-xs text-muted-foreground">Excellent NEET Academy</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          {campus && (
            <div className="mb-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" /> Active Campus
              </div>
              <div className="truncate text-sm font-semibold text-foreground">{campus.name}</div>
              {campus.city && <div className="text-xs text-muted-foreground">{campus.city}</div>}
            </div>
          )}
          <div className="mb-2 rounded-md bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground">Signed in as</div>
            <div className="truncate text-sm font-semibold text-foreground">{fullName || "—"}</div>
            <div className="text-xs uppercase tracking-wide text-accent-foreground/80">
              <span className="rounded bg-accent/30 px-1.5 py-0.5 text-[10px] font-bold">{role}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="font-semibold lg:hidden">ENA Fees</div>
          <div className="ml-auto flex items-center gap-2">
            {campus && (
              <span className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary sm:inline-flex">
                <Building2 className="h-3 w-3" />
                Active: {campus.name}
              </span>
            )}
            {campuses.length > 1 && (
              <Select value={campusId ?? undefined} onValueChange={(v) => setCampusId(v)}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
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
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}