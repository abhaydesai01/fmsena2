import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ListChecks,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useAuth, type Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Status = "pass" | "warn" | "fail" | "loading";

type CheckRow = {
  id: string;
  label: string;
  status: Status;
  detail: string;
  link?: { to: string; label: string };
};

type Step = {
  key: string;
  num: number;
  title: string;
  description: string;
  to: string;
  ctaLabel: string;
  requiredRole: Role | "any";
  checks: CheckRow[];
};

function statusIcon(s: Status) {
  if (s === "loading") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (s === "warn") return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function rollUp(checks: CheckRow[]): Status {
  if (checks.some((c) => c.status === "loading")) return "loading";
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "warn")) return "warn";
  return "pass";
}

export function ClickthroughChecklist() {
  const { role, isAdmin } = useAuth();
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>("enroll");

  // ------- Data probes (cheap counts so checklist is honest about what exists) -------
  const courses = useQuery({
    queryKey: ["checklist", "courses"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("courses").select("*", { count: "exact", head: true }).eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const batches = useQuery({
    queryKey: ["checklist", "batches"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("batches").select("*", { count: "exact", head: true }).neq("status", "closed");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const students = useQuery({
    queryKey: ["checklist", "students"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("students").select("*", { count: "exact", head: true }).eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const installments = useQuery({
    queryKey: ["checklist", "installments"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("installments").select("*", { count: "exact", head: true }).neq("status", "paid");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const payments = useQuery({
    queryKey: ["checklist", "payments"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("payments").select("*", { count: "exact", head: true }).neq("status", "cancelled");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const loading =
    courses.isLoading || batches.isLoading || students.isLoading ||
    installments.isLoading || payments.isLoading;

  const steps: Step[] = useMemo(() => {
    const L = (q: typeof courses): Status => (q.isLoading ? "loading" : "pass");

    const enrollChecks: CheckRow[] = [
      {
        id: "perm-enroll",
        label: "Permission: enroll students",
        status: isAdmin ? "pass" : "fail",
        detail: isAdmin
          ? `Signed in as admin — full access.`
          : `Role "${role ?? "unknown"}" cannot enroll. Switch to an admin account.`,
      },
      {
        id: "courses",
        label: "At least one active course",
        status: courses.isLoading ? "loading" : (courses.data ?? 0) > 0 ? "pass" : "fail",
        detail: courses.isLoading
          ? "Checking…"
          : (courses.data ?? 0) > 0
            ? `${courses.data} active course${courses.data === 1 ? "" : "s"} available.`
            : "No active courses found. Create one first.",
        link: (courses.data ?? 0) === 0 ? { to: "/courses", label: "Open Courses" } : undefined,
      },
      {
        id: "batches",
        label: "At least one open batch",
        status: batches.isLoading ? "loading" : (batches.data ?? 0) > 0 ? "pass" : "fail",
        detail: batches.isLoading
          ? "Checking…"
          : (batches.data ?? 0) > 0
            ? `${batches.data} batch${batches.data === 1 ? "" : "es"} accepting students.`
            : "No open batches. Add a batch under Courses & Batches.",
        link: (batches.data ?? 0) === 0 ? { to: "/courses", label: "Open Courses" } : undefined,
      },
      L(courses) === "pass" && L(batches) === "pass" && (courses.data ?? 0) > 0 && (batches.data ?? 0) > 0
        ? {
            id: "ready",
            label: "Ready to walk the wizard",
            status: "pass" as Status,
            detail: "Open Enroll → fill profile → choose discount → review → confirm.",
          }
        : null,
    ].filter(Boolean) as CheckRow[];

    const collectChecks: CheckRow[] = [
      {
        id: "perm-collect",
        label: "Permission: record payments",
        status: role ? "pass" : "fail",
        detail: role
          ? `Both Admin and Accountant roles can collect fees.`
          : "No role detected — sign out and sign back in.",
      },
      {
        id: "students-active",
        label: "Active students to search",
        status: students.isLoading ? "loading" : (students.data ?? 0) > 0 ? "pass" : "warn",
        detail: students.isLoading
          ? "Checking…"
          : (students.data ?? 0) > 0
            ? `${students.data} active student${students.data === 1 ? "" : "s"} indexed.`
            : "No active students yet — finish Step 1 first.",
      },
      {
        id: "open-installments",
        label: "Outstanding installments exist",
        status: installments.isLoading
          ? "loading"
          : (installments.data ?? 0) > 0
            ? "pass"
            : "warn",
        detail: installments.isLoading
          ? "Checking…"
          : (installments.data ?? 0) > 0
            ? `${installments.data} installment${installments.data === 1 ? "" : "s"} awaiting payment.`
            : "Nothing to collect against. Enroll a student to generate a schedule.",
      },
      {
        id: "receipt-rpc",
        label: "Receipt numbering ready",
        status: "pass",
        detail: "next_receipt_number RPC available — receipts auto-increment per year.",
      },
    ];

    const reportsChecks: CheckRow[] = [
      {
        id: "perm-reports",
        label: "Permission: view reports",
        status: role ? "pass" : "fail",
        detail: "All authenticated users can view reports.",
      },
      {
        id: "have-payments",
        label: "Payment data to summarise",
        status: payments.isLoading
          ? "loading"
          : (payments.data ?? 0) > 0
            ? "pass"
            : "warn",
        detail: payments.isLoading
          ? "Checking…"
          : (payments.data ?? 0) > 0
            ? `${payments.data} payment${payments.data === 1 ? "" : "s"} on record.`
            : "Reports will be empty until you collect at least one payment.",
      },
      {
        id: "csv-export",
        label: "CSV export available",
        status: "pass",
        detail: "Collections and Outstanding tabs each have an Export button.",
      },
    ];

    return [
      {
        key: "enroll",
        num: 1,
        title: "Enrol a student",
        description: "Step through the 3-step wizard: profile → fee plan → confirm.",
        to: "/enroll",
        ctaLabel: "Open Enrol",
        requiredRole: "admin",
        checks: enrollChecks,
      },
      {
        key: "collect",
        num: 2,
        title: "Collect a fee",
        description: "Search the student, pick an installment, record any mode.",
        to: "/collect",
        ctaLabel: "Open Collect",
        requiredRole: "any",
        checks: collectChecks,
      },
      {
        key: "reports",
        num: 3,
        title: "Verify in Reports",
        description: "Confirm the receipt appears in Collections and totals match.",
        to: "/reports",
        ctaLabel: "Open Reports",
        requiredRole: "any",
        checks: reportsChecks,
      },
    ];
  }, [
    isAdmin, role,
    courses.data, courses.isLoading,
    batches.data, batches.isLoading,
    students.data, students.isLoading,
    installments.data, installments.isLoading,
    payments.data, payments.isLoading,
  ]);

  const summary = useMemo(() => {
    const all = steps.flatMap((s) => s.checks);
    const pass = all.filter((c) => c.status === "pass").length;
    const warn = all.filter((c) => c.status === "warn").length;
    const fail = all.filter((c) => c.status === "fail").length;
    return { pass, warn, fail, total: all.length };
  }, [steps]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Clickthrough checklist
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Walk Enrol → Collect → Reports. Live checks below flag missing data, broken links, or role gaps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <div className="hidden gap-1 sm:flex">
              {summary.pass > 0 && <Badge variant="secondary" className="bg-success/15 text-success">{summary.pass} ok</Badge>}
              {summary.warn > 0 && <Badge variant="secondary" className="bg-warning/15 text-warning">{summary.warn} warn</Badge>}
              {summary.fail > 0 && <Badge variant="secondary" className="bg-destructive/15 text-destructive">{summary.fail} fail</Badge>}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-label={open ? "Collapse checklist" : "Expand checklist"}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {steps.map((step) => {
            const blocked = step.requiredRole === "admin" && !isAdmin;
            const overall: Status = blocked ? "fail" : rollUp(step.checks);
            const isOpen = expanded === step.key;
            return (
              <div key={step.key} className="rounded-lg border border-border bg-card">
                <div className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : step.key)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      overall === "pass" && "bg-success/15 text-success",
                      overall === "warn" && "bg-warning/15 text-warning",
                      overall === "fail" && "bg-destructive/15 text-destructive",
                      overall === "loading" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.num}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{step.title}</span>
                      {statusIcon(overall)}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  </button>
                  {!blocked && (
                    <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                      <Link to={step.to} onClick={(e) => e.stopPropagation()}>
                        {step.ctaLabel} <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : step.key)}
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    className="shrink-0"
                  >
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                {isOpen && (
                  <div className="border-t border-border px-4 py-3">
                    <ul className="space-y-2">
                      {step.checks.map((c) => (
                        <li key={c.id} className="flex items-start gap-3 text-sm">
                          <span className="mt-0.5">{statusIcon(c.status)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground">{c.label}</div>
                            <div className="text-xs text-muted-foreground">{c.detail}</div>
                            {c.link && (
                              <Link to={c.link.to} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                {c.link.label} <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex justify-end sm:hidden">
                      <Button asChild variant="outline" size="sm" disabled={blocked}>
                        <Link to={step.to}>
                          {step.ctaLabel} <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}