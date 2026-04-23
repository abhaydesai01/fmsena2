import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const { isAdmin } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const todayCollection = useQuery({
    queryKey: ["dash", "today", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount, payment_mode, status")
        .eq("payment_date", today)
        .neq("status", "cancelled");
      const total = (data || []).reduce((s, p) => s + Number(p.amount), 0);
      const byMode: Record<string, number> = {};
      for (const p of data || []) byMode[p.payment_mode] = (byMode[p.payment_mode] || 0) + Number(p.amount);
      return { total, byMode };
    },
  });

  const dues = useQuery({
    queryKey: ["dash", "dues"],
    queryFn: async () => {
      const { data } = await supabase
        .from("installments")
        .select("amount, amount_paid, status, due_date");
      const list = data || [];
      const outstanding = list.reduce((s, i) => s + Math.max(0, Number(i.amount) - Number(i.amount_paid)), 0);
      const overdueCount = list.filter((i) => i.status === "overdue" || (i.status !== "paid" && i.due_date < today)).length;
      const dueToday = list.filter((i) => i.due_date === today && i.status !== "paid").length;
      return { outstanding, overdueCount, dueToday };
    },
  });

  const recent = useQuery({
    queryKey: ["dash", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, receipt_number, amount, payment_mode, created_at, collected_by_name, status, students(full_name, admission_number)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const newEnrollments = useQuery({
    queryKey: ["dash", "new-enroll"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { count: month } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .gte("admission_date", since.toISOString().slice(0, 10));
      const sinceWeek = new Date();
      sinceWeek.setDate(sinceWeek.getDate() - 7);
      const { count: week } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .gte("admission_date", sinceWeek.toISOString().slice(0, 10));
      return { month: month ?? 0, week: week ?? 0 };
    },
  });

  const batches = useQuery({
    queryKey: ["dash", "batches"],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("id, name, capacity, status, courses(name)");
      const all = data || [];
      const counts = await Promise.all(
        all.map(async (b) => {
          const { count } = await supabase
            .from("students")
            .select("*", { count: "exact", head: true })
            .eq("batch_id", b.id);
          return { ...b, enrolled: count ?? 0 };
        })
      );
      return counts;
    },
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Today at a glance — collections, dues, and quick actions."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Collection" value={inr(todayCollection.data?.total || 0)} icon={IndianRupee} tone="success" hint={Object.entries(todayCollection.data?.byMode || {}).map(([m, v]) => `${modeLabel(m)} ${inr(v as number)}`).join(" · ") || "No collections yet"} />
        <StatCard label="Pending Dues" value={inr(dues.data?.outstanding || 0)} icon={AlertCircle} tone="destructive" hint={`${dues.data?.overdueCount ?? 0} overdue installments`} />
        <StatCard label="Due Today" value={dues.data?.dueToday ?? 0} icon={CalendarClock} tone="warning" hint="Installments awaiting payment" />
        <StatCard label="New Enrollments" value={newEnrollments.data?.month ?? 0} icon={Users} tone="info" hint={`${newEnrollments.data?.week ?? 0} this week`} />
      </div>

      <div className="mt-6">
        <ClickthroughChecklist />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Receipts</CardTitle>
            <Link to="/reports"><Button variant="ghost" size="sm">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {recent.data?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="pb-2">Receipt</th><th>Student</th><th>Mode</th><th>Status</th><th className="text-right">Amount</th><th>Time</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recent.data.map((p: any) => (
                      <tr key={p.id}>
                        <td className="py-2 font-mono text-xs">{p.receipt_number}</td>
                        <td>{p.students?.full_name}</td>
                        <td>{modeLabel(p.payment_mode)}</td>
                        <td><StatusBadge status={p.status} /></td>
                        <td className="text-right font-semibold">{inr(p.amount)}</td>
                        <td className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
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
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isAdmin && (
              <Link to="/enroll"><Button variant="default" className="w-full justify-start"><UserPlus className="h-4 w-4" /> Enrol Student</Button></Link>
            )}
            <Link to="/collect"><Button variant="default" className="w-full justify-start"><Receipt className="h-4 w-4" /> Collect Fee</Button></Link>
            <Link to="/students"><Button variant="outline" className="w-full justify-start"><Search className="h-4 w-4" /> Search Student</Button></Link>
            <Link to="/defaulters"><Button variant="outline" className="w-full justify-start"><AlertTriangle className="h-4 w-4" /> View Defaulters</Button></Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Batch Occupancy</CardTitle></CardHeader>
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
                          <div className="text-xs text-muted-foreground">{b.courses?.name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{b.enrolled} / {b.capacity}</div>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-[var(--gradient-primary)]" style={{ width: pct + "%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">No batches yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Today, {fmtDate(new Date())}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Welcome to ENA Fees Management. Use the sidebar to access modules. Every receipt is sequentially numbered and audited.
              {isAdmin ? " As an Admin you have access to all modules." : " As a Cashier you can collect fees and view ledgers."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}