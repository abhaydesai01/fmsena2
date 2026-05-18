import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getDashTodayCollectionFn,
  getDashDuesFn,
  getDashRecentPaymentsFn,
  getDashNewEnrollmentsFn,
  getDashBatchesFn,
} from "@/fns/reports";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inr, fmtDate, modeLabel } from "@/lib/format";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  IndianRupee,
  AlertCircle,
  CalendarClock,
  Users,
  UserPlus,
  Receipt,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ClickthroughChecklist } from "@/components/app/ClickthroughChecklist";

export const Route = createFileRoute("/_auth/dashboard")({ component: Dashboard });

function Dashboard() {
  const { isAdmin, hasPermission } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const todayCollection = useQuery({
    queryKey: ["dash", "today", today],
    queryFn: () => getDashTodayCollectionFn({ data: { today } }),
  });

  const dues = useQuery({
    queryKey: ["dash", "dues", today],
    queryFn: () => getDashDuesFn({ data: { today } }),
  });

  const recent = useQuery({
    queryKey: ["dash", "recent"],
    queryFn: () => getDashRecentPaymentsFn({ data: {} }),
  });

  const newEnrollments = useQuery({
    queryKey: ["dash", "new-enroll"],
    queryFn: () => getDashNewEnrollmentsFn({ data: {} }),
  });

  const batches = useQuery({
    queryKey: ["dash", "batches"],
    queryFn: () => getDashBatchesFn({ data: {} }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Today at a glance — collections, dues, and quick actions."
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {hasPermission("canViewAggregateFinancials") && (
          <StatCard
            label="Today's Collection"
            value={inr(todayCollection.data?.total || 0)}
            icon={IndianRupee}
            tone="success"
            hint={
              Object.entries(todayCollection.data?.byMode || {})
                .map(([m, v]) => `${modeLabel(m)} ${inr(v as number)}`)
                .join(" · ") || "No collections yet"
            }
          />
        )}
        <StatCard
          label="Pending Dues"
          value={inr(dues.data?.outstanding || 0)}
          icon={AlertCircle}
          tone="destructive"
          hint={`${dues.data?.overdueCount ?? 0} overdue installments`}
        />
        <StatCard
          label="Due Today"
          value={dues.data?.dueToday ?? 0}
          icon={CalendarClock}
          tone="warning"
          hint="Installments awaiting payment"
        />
        <StatCard
          label="New Enrollments"
          value={newEnrollments.data?.month ?? 0}
          icon={Users}
          tone="info"
          hint={`${newEnrollments.data?.week ?? 0} this week`}
        />
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
              <p className="text-sm text-muted-foreground">No receipts yet.</p>
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
                  <UserPlus className="h-4 w-4" /> Enrol Student
                </Link>
              </Button>
            )}
            <Button asChild variant="default" className="w-full justify-start">
              <Link to="/collect">
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
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Batch Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            {batches.data?.length ? (
              <div className="space-y-3">
                {batches.data.map((b: any) => {
                  const pct = Math.min(
                    100,
                    Math.round((b.enrolled / Math.max(1, b.capacity)) * 100),
                  );
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
                          style={{ width: pct + "%" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No batches yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today, {fmtDate(new Date())}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Welcome to ENA Fees Management. Use the sidebar to access modules. Every receipt is
              sequentially numbered and audited.
              {isAdmin
                ? " As an Admin you have access to all modules."
                : " As an Accountant you can collect fees, clear dues, and view ledgers."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
