import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getDashTodayCollectionFn,
  getDashDuesFn,
  getDashRecentPaymentsFn,
  getDashNewEnrollmentsFn,
  getDashBatchesFn,
  getInstallmentDueBucketsFn,
  runAutomatedRemindersFn,
} from "@/fns/reports";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inr, fmtDate, modeLabel } from "@/lib/format";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  IndianRupee,
  AlertCircle,
  CalendarClock,
  Users,
  UserPlus,
  Receipt,
  Search,
  AlertTriangle,
  ArrowRight,
  Clock3,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCampus } from "@/lib/campus";
import { ClickthroughChecklist } from "@/components/app/ClickthroughChecklist";

export const Route = createFileRoute("/_auth/dashboard")({ component: Dashboard });

function Dashboard() {
  const { isAdmin, hasPermission } = useAuth();
  const { campusId, campus } = useCampus();
  const today = new Date().toISOString().slice(0, 10);

  const todayCollection = useQuery({
    queryKey: ["dash", "today", campusId, today],
    queryFn: () => getDashTodayCollectionFn({ data: { today, campusId: campusId ?? undefined } }),
  });

  const dues = useQuery({
    queryKey: ["dash", "dues", campusId, today],
    queryFn: () => getDashDuesFn({ data: { today, campusId: campusId ?? undefined } }),
  });

  const recent = useQuery({
    queryKey: ["dash", "recent", campusId],
    queryFn: () => getDashRecentPaymentsFn({ data: { campusId: campusId ?? undefined } }),
  });

  const newEnrollments = useQuery({
    queryKey: ["dash", "new-enroll", campusId],
    queryFn: () => getDashNewEnrollmentsFn({ data: { campusId: campusId ?? undefined } }),
  });

  const batches = useQuery({
    queryKey: ["dash", "batches", campusId],
    queryFn: () => getDashBatchesFn({ data: { campusId: campusId ?? undefined } }),
  });
  useQuery({
    queryKey: ["dash", "reminder-sweep", campusId, today],
    queryFn: () => runAutomatedRemindersFn({ data: { today, campusId: campusId ?? undefined } }),
  });
  const dueBuckets = useQuery({
    queryKey: ["dash", "due-buckets", campusId, today],
    queryFn: () => getInstallmentDueBucketsFn({ data: { today, campusId: campusId ?? undefined } }),
  });

  const dueTodayRows = dueBuckets.data?.dueToday ?? [];
  const dueWeekRows = dueBuckets.data?.dueThisWeek ?? [];
  const overdueRows = dueBuckets.data?.overdue ?? [];
  const totalDueCount = dueTodayRows.length + dueWeekRows.length + overdueRows.length;
  const lastUpdated = new Date();

  const kpis: Array<{
    key: string;
    label: string;
    value: string | number;
    hint: string;
    icon: typeof IndianRupee;
    tone: "success" | "destructive" | "warning" | "info";
    to: "/reports" | "/defaulters" | "/collect" | "/students";
    show?: boolean;
  }> = [
    {
      key: "today-collection",
      label: "Today's Collection",
      value: inr(todayCollection.data?.total ?? 0),
      hint:
        Object.entries(todayCollection.data?.byMode || {})
          .map(([m, v]) => `${modeLabel(m)} ${inr(v as number)}`)
          .join(" · ") || "No collections yet",
      icon: IndianRupee,
      tone: "success",
      to: "/reports",
      show: hasPermission("canViewAggregateFinancials"),
    },
    {
      key: "pending-dues",
      label: "Pending Dues",
      value: inr(dues.data?.outstanding ?? 0),
      hint: `${dues.data?.overdueCount ?? 0} overdue installments`,
      icon: AlertCircle,
      tone: "destructive",
      to: "/defaulters",
    },
    {
      key: "due-today",
      label: "Due Today",
      value: dueTodayRows.length,
      hint: "Installments awaiting payment",
      icon: CalendarClock,
      tone: "warning",
      to: "/collect",
    },
    {
      key: "new-enrollments",
      label: "New Enrollments",
      value: newEnrollments.data?.month ?? 0,
      hint: `${newEnrollments.data?.week ?? 0} this week`,
      icon: Users,
      tone: "info",
      to: "/students",
    },
    {
      key: "due-this-week",
      label: "Due This Week",
      value: dueWeekRows.length,
      hint: "Upcoming installments in next 7 days",
      icon: Clock3,
      tone: "warning",
      to: "/reports",
    },
    {
      key: "overdue-installments",
      label: "Overdue Installments",
      value: overdueRows.length,
      hint: "Unpaid past due installments",
      icon: AlertTriangle,
      tone: "destructive",
      to: "/defaulters",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Operations overview with live collections, dues, and actionable next steps."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{campus?.name || "All campuses"}</Badge>
        <Badge variant="outline">Open dues: {totalDueCount}</Badge>
        <Badge variant="outline">Updated {lastUpdated.toLocaleTimeString("en-IN")}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis
          .filter((k) => k.show !== false)
          .map((kpi) => (
            <Link
              key={kpi.key}
              to={kpi.to}
              className="group block rounded-xl ring-offset-background transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <StatCard
                label={kpi.label}
                value={kpi.value}
                icon={kpi.icon}
                tone={kpi.tone}
                hint={kpi.hint}
              />
            </Link>
          ))}
      </div>

      <ClickthroughChecklist />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Receipts</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/reports">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.data?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Receipt</th>
                      <th>Student</th>
                      <th>Mode</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recent.data.map((p: any) => (
                      <tr key={p.id}>
                        <td className="py-2 font-mono text-xs">{p.receipt_number}</td>
                        <td>
                          {p.student_id ? (
                            <Link
                              to="/students/$studentId"
                              params={{ studentId: p.student_id }}
                              className="hover:underline"
                            >
                              {p.student_name}
                            </Link>
                          ) : (
                            p.student_name
                          )}
                        </td>
                        <td>{modeLabel(p.payment_mode)}</td>
                        <td>
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="text-right font-semibold">{inr(p.amount)}</td>
                        <td className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No receipts yet for this campus selection.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasPermission("canEnrollStudents") && (
              <Button asChild variant="default" className="w-full justify-start">
                <Link to="/enroll">
                  <UserPlus className="h-4 w-4" /> Enroll Student
                </Link>
              </Button>
            )}
            <Button asChild variant="default" className="w-full justify-start">
              <Link to="/collect" search={{ q: undefined }}>
                <Receipt className="h-4 w-4" /> Collect Fee
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/students">
                <Search className="h-4 w-4" /> Search Student
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/defaulters">
                <AlertTriangle className="h-4 w-4" /> View Defaulters
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link to="/reports">
                <ArrowRight className="h-4 w-4" /> Open Full Reports
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Priority Follow-up (Live Dues)</CardTitle>
          </CardHeader>
          <CardContent>
            {overdueRows.length || dueTodayRows.length ? (
              <div className="space-y-3">
                {[...overdueRows.slice(0, 4), ...dueTodayRows.slice(0, 4)].map((row: any) => {
                  const pending = Math.max(0, Number(row.amount) - Number(row.amount_paid));
                  const isOverdue = String(row.due_date) < today;
                  return (
                    <div key={row.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-foreground">
                            {row.student_name || "Student"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.admission_number || "—"} · Installment {row.installment_no}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{inr(pending)}</div>
                          <StatusBadge status={isOverdue ? "overdue" : "pending"} />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Due {fmtDate(row.due_date)}</span>
                        <Link
                          to="/students/$studentId"
                          params={{ studentId: row.student_id }}
                          className="font-medium text-primary hover:underline"
                        >
                          Open student
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No due items in current window.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            {batches.data?.length ? (
              <div className="space-y-3">
                {batches.data.map((b: any) => {
                  const pct = Math.min(100, Math.round((b.enrolled / Math.max(1, b.capacity)) * 100));
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium text-foreground">{b.name}</div>
                          <div className="text-xs text-muted-foreground">{b.course_name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.enrolled} / {b.capacity}
                        </div>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[var(--gradient-primary)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active batches found.</p>
            )}
            <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              Today is {fmtDate(new Date())}.{" "}
              {isAdmin
                ? "You can drill down into reports, user controls, and audit from quick actions."
                : "Use Collect Fee and Defaulters to close the daily pending dues quickly."}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
