import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/PageHeader";
import { Loading } from "@/components/app/Loading";
import { StatCard } from "@/components/app/StatCard";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart3, IndianRupee, Receipt, AlertCircle, Download, Calendar } from "lucide-react";
import { inr, fmtDate, modeLabel, exportCSV } from "@/lib/format";

export const Route = createFileRoute("/_auth/reports")({ component: Page });

function Page() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); })();
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  return (
    <div>
      <PageHeader title="Reports" description="Collections, outstanding balances, and defaulter summaries." />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setFrom(monthAgo); setTo(today); }}>Last 30 days</Button>
            <Button variant="outline" size="sm" onClick={() => { setFrom(today); setTo(today); }}>Today</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="collections">
        <TabsList>
          <TabsTrigger value="collections"><Receipt className="h-4 w-4" /> Collections</TabsTrigger>
          <TabsTrigger value="outstanding"><AlertCircle className="h-4 w-4" /> Outstanding</TabsTrigger>
          <TabsTrigger value="monthly"><Calendar className="h-4 w-4" /> Monthly Dues</TabsTrigger>
          <TabsTrigger value="batches"><BarChart3 className="h-4 w-4" /> By Course</TabsTrigger>
        </TabsList>
        <TabsContent value="collections" className="mt-4"><CollectionsReport from={from} to={to} /></TabsContent>
        <TabsContent value="outstanding" className="mt-4"><OutstandingReport /></TabsContent>
        <TabsContent value="monthly" className="mt-4"><MonthlyDuesReport /></TabsContent>
        <TabsContent value="batches" className="mt-4"><CourseReport /></TabsContent>
      </Tabs>
    </div>
  );
}

function MonthlyDuesReport() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "due" | "overdue" | "partial">("all");

  const q = useQuery({
    queryKey: ["report", "monthly-dues", month, statusFilter],
    queryFn: async () => {
      const [y, m] = month.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const endDate = new Date(y, m, 0); // last day of month
      const end = endDate.toISOString().slice(0, 10);
      let query = supabase
        .from("installments")
        .select("id, installment_no, month_label, due_date, amount, amount_paid, status, students(id, full_name, admission_number, mobile, courses(name), batches(name))")
        .gte("due_date", start).lte("due_date", end)
        .order("due_date");
      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const totals = useMemo(() => {
    const list = (q.data || []) as any[];
    const billed = list.reduce((s, i) => s + Number(i.amount), 0);
    const collected = list.reduce((s, i) => s + Number(i.amount_paid), 0);
    return { billed, collected, due: billed - collected, count: list.length };
  }, [q.data]);

  return (
    <div>
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-xs">Due Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Status</Label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="due">Due</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Instalments" value={totals.count} icon={Calendar} tone="info" />
        <StatCard label="Billed" value={inr(totals.billed)} icon={IndianRupee} tone="default" />
        <StatCard label="Outstanding" value={inr(totals.due)} icon={AlertCircle} tone="destructive" />
      </div>

      {q.isLoading ? <Loading /> : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Instalments due in {month}</CardTitle>
            <Button variant="outline" size="sm" disabled={!q.data?.length}
              onClick={() => exportCSV(`monthly_dues_${month}.csv`, (q.data as any[]).map((i) => ({
                admission_number: i.students?.admission_number, student: i.students?.full_name, mobile: i.students?.mobile,
                course: i.students?.courses?.name, batch: i.students?.batches?.name,
                installment_no: i.installment_no, month: i.month_label, due_date: i.due_date,
                amount: i.amount, paid: i.amount_paid, outstanding: Number(i.amount) - Number(i.amount_paid), status: i.status,
              })))}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Admission</TableHead><TableHead>Student</TableHead><TableHead>Course / Batch</TableHead>
                <TableHead>Due</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(q.data as any[]).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.students?.admission_number}</TableCell>
                    <TableCell>{i.students?.full_name}<div className="text-xs text-muted-foreground">{i.students?.mobile}</div></TableCell>
                    <TableCell className="text-sm">{i.students?.courses?.name}<div className="text-xs text-muted-foreground">{i.students?.batches?.name}</div></TableCell>
                    <TableCell className="text-sm">{fmtDate(i.due_date)}</TableCell>
                    <TableCell className="text-right">{inr(i.amount)}</TableCell>
                    <TableCell className="text-right text-success">{inr(i.amount_paid)}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{inr(Number(i.amount) - Number(i.amount_paid))}</TableCell>
                    <TableCell><StatusBadge status={i.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CollectionsReport({ from, to }: { from: string; to: string }) {
  const q = useQuery({
    queryKey: ["report", "collections", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, receipt_number, payment_date, amount, payment_mode, status, collected_by_name, students(full_name, admission_number)")
        .gte("payment_date", from).lte("payment_date", to)
        .neq("status", "cancelled")
        .order("payment_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const totals = useMemo(() => {
    const list = (q.data || []) as any[];
    const total = list.reduce((s, p) => s + Number(p.amount), 0);
    const byMode: Record<string, number> = {};
    for (const p of list) byMode[p.payment_mode] = (byMode[p.payment_mode] || 0) + Number(p.amount);
    return { total, byMode, count: list.length };
  }, [q.data]);

  if (q.isLoading) return <Loading />;
  return (
    <div>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Collected" value={inr(totals.total)} icon={IndianRupee} tone="success" />
        <StatCard label="Receipts" value={totals.count} icon={Receipt} tone="info" />
        <StatCard label="By Mode" value={Object.keys(totals.byMode).length}
          hint={Object.entries(totals.byMode).map(([m, v]) => `${modeLabel(m)} ${inr(v)}`).join(" · ") || "—"}
          icon={BarChart3} tone="default" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Receipts</CardTitle>
          <Button variant="outline" size="sm" disabled={!q.data?.length}
            onClick={() => exportCSV(`collections_${from}_${to}.csv`, (q.data as any[]).map((p) => ({
              receipt: p.receipt_number, date: p.payment_date,
              student: p.students?.full_name, admission_number: p.students?.admission_number,
              mode: p.payment_mode, amount: p.amount, status: p.status, collected_by: p.collected_by_name,
            })))}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data as any[]).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                    <TableCell className="text-sm">{fmtDate(p.payment_date)}</TableCell>
                    <TableCell>{p.students?.full_name}<div className="text-xs text-muted-foreground">{p.students?.admission_number}</div></TableCell>
                    <TableCell>{modeLabel(p.payment_mode)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-sm">{p.collected_by_name}</TableCell>
                    <TableCell className="text-right font-semibold">{inr(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OutstandingReport() {
  const q = useQuery({
    queryKey: ["report", "outstanding"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("installments")
        .select("amount, amount_paid, status, due_date, students(id, full_name, admission_number, courses(name))")
        .neq("status", "paid").limit(2000);
      if (error) throw error;
      // group by student
      const map = new Map<string, { name: string; adm: string; course: string; outstanding: number; overdue: number }>();
      for (const i of (data || []) as any[]) {
        const s = i.students; if (!s) continue;
        const remain = Number(i.amount) - Number(i.amount_paid);
        const cur = map.get(s.id) || { name: s.full_name, adm: s.admission_number, course: s.courses?.name || "—", outstanding: 0, overdue: 0 };
        cur.outstanding += remain;
        if (i.due_date < today) cur.overdue += remain;
        map.set(s.id, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
    },
  });
  if (q.isLoading) return <Loading />;
  const total = (q.data || []).reduce((s, r) => s + r.outstanding, 0);
  return (
    <div>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Students with Dues" value={(q.data || []).length} icon={AlertCircle} tone="warning" />
        <StatCard label="Total Outstanding" value={inr(total)} icon={IndianRupee} tone="destructive" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>By Student</CardTitle>
          <Button variant="outline" size="sm" disabled={!q.data?.length}
            onClick={() => exportCSV(`outstanding_${Date.now()}.csv`, (q.data || []) as any)}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admission #</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data || []).map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs">{r.adm}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.course}</TableCell>
                  <TableCell className="text-right text-destructive">{inr(r.overdue)}</TableCell>
                  <TableCell className="text-right font-semibold">{inr(r.outstanding)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CourseReport() {
  const q = useQuery({
    queryKey: ["report", "by-course"],
    queryFn: async () => {
      const { data: courses } = await supabase.from("courses").select("id, name");
      const result = await Promise.all(
        (courses || []).map(async (c) => {
          const { data: ins } = await supabase
            .from("installments")
            .select("amount, amount_paid, students!inner(course_id)")
            .eq("students.course_id", c.id);
          const total = (ins || []).reduce((s, i: any) => s + Number(i.amount), 0);
          const paid = (ins || []).reduce((s, i: any) => s + Number(i.amount_paid), 0);
          return { name: c.name, total, paid, outstanding: total - paid };
        })
      );
      return result;
    },
  });
  if (q.isLoading) return <Loading />;
  return (
    <Card>
      <CardHeader><CardTitle>By Course</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead className="text-right">Total Billed</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data || []).map((r, idx) => {
              const pct = r.total ? Math.round((r.paid / r.total) * 100) : 0;
              return (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{inr(r.total)}</TableCell>
                  <TableCell className="text-right text-success">{inr(r.paid)}</TableCell>
                  <TableCell className="text-right text-destructive">{inr(r.outstanding)}</TableCell>
                  <TableCell>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[var(--gradient-primary)]" style={{ width: pct + "%" }} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{pct}%</div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
