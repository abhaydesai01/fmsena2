import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCollectionsReportFn,
  getOutstandingReportFn,
  getMonthlyDuesReportFn,
  getCourseReportFn,
  getConcessionsReportFn,
  getPlanUpgradesReportFn,
} from "@/fns/reports";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  IndianRupee,
  Receipt,
  AlertCircle,
  Download,
  Calendar,
  Percent,
  ArrowUpCircle,
} from "lucide-react";
import { inr, fmtDate, modeLabel, exportCSV } from "@/lib/format";
import { PLAN_LABEL, type PlanKind } from "@/lib/installments";
import { useAuth } from "@/lib/auth";
import { useCampus } from "@/lib/campus";

export const Route = createFileRoute("/_auth/reports")({ component: Page });

function Page() {
  const { hasPermission } = useAuth();
  const { campusId } = useCampus();
  const canExportReports = hasPermission("canExportReports");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  })();
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Collections, outstanding balances, and defaulter summaries."
      />

      <Card>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFrom(monthAgo);
                setTo(today);
              }}
            >
              Last 30 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFrom(today);
                setTo(today);
              }}
            >
              Today
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="collections">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full">
            <TabsTrigger value="collections">
              <Receipt className="h-4 w-4" /> Collections
            </TabsTrigger>
            <TabsTrigger value="outstanding">
              <AlertCircle className="h-4 w-4" /> Outstanding
            </TabsTrigger>
            <TabsTrigger value="monthly">
              <Calendar className="h-4 w-4" /> Monthly Dues
            </TabsTrigger>
            <TabsTrigger value="batches">
              <BarChart3 className="h-4 w-4" /> By Course
            </TabsTrigger>
            <TabsTrigger value="concessions">
              <Percent className="h-4 w-4" /> Concessions
            </TabsTrigger>
            <TabsTrigger value="upgrades">
              <ArrowUpCircle className="h-4 w-4" /> Plan Upgrades
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="collections" className="mt-4">
          <CollectionsReport
            from={from}
            to={to}
            campusId={campusId}
            showAggregate={hasPermission("canViewAggregateFinancials")}
            canExport={canExportReports}
          />
        </TabsContent>
        <TabsContent value="outstanding" className="mt-4">
          <OutstandingReport
            campusId={campusId}
            showAggregate={hasPermission("canViewAggregateFinancials")}
            canExport={canExportReports}
          />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <MonthlyDuesReport campusId={campusId} canExport={canExportReports} />
        </TabsContent>
        <TabsContent value="batches" className="mt-4">
          <CourseReport campusId={campusId} />
        </TabsContent>
        <TabsContent value="concessions" className="mt-4">
          <ConcessionsReport campusId={campusId} canExport={canExportReports} />
        </TabsContent>
        <TabsContent value="upgrades" className="mt-4">
          <PlanUpgradesReport campusId={campusId} canExport={canExportReports} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CollectionsReport({
  from,
  to,
  campusId,
  showAggregate,
  canExport,
}: {
  from: string;
  to: string;
  campusId: string | null;
  showAggregate: boolean;
  canExport: boolean;
}) {
  const q = useQuery({
    queryKey: ["report", "collections", campusId, from, to],
    queryFn: () => getCollectionsReportFn({ data: { from, to, campusId: campusId ?? undefined } }),
  });

  const totals = useMemo(() => {
    const list = (q.data as any[]) || [];
    const total = list.reduce((s, p) => s + Number(p.amount), 0);
    const byMode: Record<string, number> = {};
    for (const p of list) byMode[p.payment_mode] = (byMode[p.payment_mode] || 0) + Number(p.amount);
    return { total, byMode, count: list.length };
  }, [q.data]);

  if (q.isLoading) return <Loading />;
  return (
    <div>
      {showAggregate && (
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Collected"
            value={inr(totals.total)}
            icon={IndianRupee}
            tone="success"
          />
          <StatCard label="Receipts" value={totals.count} icon={Receipt} tone="info" />
          <StatCard
            label="By Mode"
            value={Object.keys(totals.byMode).length}
            hint={
              Object.entries(totals.byMode)
                .map(([m, v]) => `${modeLabel(m)} ${inr(v)}`)
                .join(" · ") || "—"
            }
            icon={BarChart3}
            tone="default"
          />
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Receipts</CardTitle>
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              disabled={!(q.data as any[])?.length}
              onClick={() =>
                exportCSV(
                  `collections_${from}_${to}.csv`,
                  (q.data as any[]).map((p) => ({
                    receipt: p.receipt_number,
                    date: p.payment_date,
                    student: p.students?.full_name,
                    admission_number: p.students?.admission_number,
                    mode: p.payment_mode,
                    amount: p.amount,
                    status: p.status,
                    collected_by: p.collected_by_name,
                  })),
                )
              }
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
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
                {((q.data as any[]) || []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                    <TableCell className="text-sm">{fmtDate(p.payment_date)}</TableCell>
                    <TableCell>
                      {p.student_id ? (
                        <Link
                          to="/students/$studentId"
                          params={{ studentId: p.student_id }}
                          className="hover:underline font-medium"
                        >
                          {p.students?.full_name}
                        </Link>
                      ) : (
                        p.students?.full_name
                      )}
                      <div className="text-xs text-muted-foreground">
                        {p.students?.admission_number}
                      </div>
                    </TableCell>
                    <TableCell>{modeLabel(p.payment_mode)}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
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

function OutstandingReport({
  campusId,
  showAggregate,
  canExport,
}: {
  campusId: string | null;
  showAggregate: boolean;
  canExport: boolean;
}) {
  const q = useQuery({
    queryKey: ["report", "outstanding", campusId],
    queryFn: () => getOutstandingReportFn({ data: { campusId: campusId ?? undefined } }),
  });
  if (q.isLoading) return <Loading />;
  const list = (q.data as any[]) || [];
  const total = list.reduce((s, r) => s + r.outstanding, 0);
  return (
    <div>
      {showAggregate && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Students with Dues"
            value={list.length}
            icon={AlertCircle}
            tone="warning"
          />
          <StatCard
            label="Total Outstanding"
            value={inr(total)}
            icon={IndianRupee}
            tone="destructive"
          />
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>By Student</CardTitle>
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              disabled={!list.length}
              onClick={() => exportCSV(`outstanding_${Date.now()}.csv`, list)}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
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
              {list.map((r: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs">{r.adm}</TableCell>
                  <TableCell className="font-medium">
                    {r.student_id ? (
                      <Link
                        to="/students/$studentId"
                        params={{ studentId: r.student_id }}
                        className="hover:underline"
                      >
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                  </TableCell>
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

function MonthlyDuesReport({ campusId, canExport }: { campusId: string | null; canExport: boolean }) {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [statusFilter, setStatusFilter] = useState("all");

  const q = useQuery({
    queryKey: ["report", "monthly-dues", campusId, month, statusFilter],
    queryFn: () =>
      getMonthlyDuesReportFn({ data: { month, statusFilter, campusId: campusId ?? undefined } }),
  });

  const totals = useMemo(() => {
    const list = (q.data as any[]) || [];
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
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
        <StatCard
          label="Outstanding"
          value={inr(totals.due)}
          icon={AlertCircle}
          tone="destructive"
        />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Instalments due in {month}</CardTitle>
            {canExport && (
              <Button
                variant="outline"
                size="sm"
                disabled={!(q.data as any[])?.length}
                onClick={() =>
                  exportCSV(
                    `monthly_dues_${month}.csv`,
                    (q.data as any[]).map((i) => ({
                      admission_number: i.students?.admission_number,
                      student: i.students?.full_name,
                      mobile: i.students?.mobile,
                      course: i.students?.courses?.name,
                      batch: i.students?.batches?.name,
                      installment_no: i.installment_no,
                      month: i.month_label,
                      due_date: i.due_date,
                      amount: i.amount,
                      paid: i.amount_paid,
                      outstanding: Number(i.amount) - Number(i.amount_paid),
                      status: i.status,
                    })),
                  )
                }
              >
                <Download className="h-4 w-4" /> Export
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Course / Batch</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((q.data as any[]) || []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">
                      {i.students?.admission_number}
                    </TableCell>
                    <TableCell>
                      {i.student_id ? (
                        <Link
                          to="/students/$studentId"
                          params={{ studentId: i.student_id }}
                          className="hover:underline font-medium"
                        >
                          {i.students?.full_name}
                        </Link>
                      ) : (
                        i.students?.full_name
                      )}
                      <div className="text-xs text-muted-foreground">{i.students?.mobile}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {i.students?.courses?.name}
                      <div className="text-xs text-muted-foreground">
                        {i.students?.batches?.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(i.due_date)}</TableCell>
                    <TableCell className="text-right">{inr(i.amount)}</TableCell>
                    <TableCell className="text-right text-success">{inr(i.amount_paid)}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      {inr(Number(i.amount) - Number(i.amount_paid))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={i.status} />
                    </TableCell>
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

function CourseReport({ campusId }: { campusId: string | null }) {
  const q = useQuery({
    queryKey: ["report", "by-course", campusId],
    queryFn: () => getCourseReportFn({ data: { campusId: campusId ?? undefined } }),
  });
  if (q.isLoading) return <Loading />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>By Course</CardTitle>
      </CardHeader>
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
            {((q.data as any[]) || []).map((r: any, idx: number) => {
              const pct = r.total ? Math.round((r.paid / r.total) * 100) : 0;
              return (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{inr(r.total)}</TableCell>
                  <TableCell className="text-right text-success">{inr(r.paid)}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {inr(r.outstanding)}
                  </TableCell>
                  <TableCell>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--gradient-primary)]"
                        style={{ width: pct + "%" }}
                      />
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

function ConcessionsReport({ campusId, canExport }: { campusId: string | null; canExport: boolean }) {
  const q = useQuery({
    queryKey: ["report", "concessions", campusId],
    queryFn: () => getConcessionsReportFn({ data: { campusId: campusId ?? undefined } }),
  });
  const totals = useMemo(() => {
    const list = (q.data as any[]) || [];
    const granted = list.reduce(
      (s, r) => s + Number(r.original_discount_amount || r.discount_amount || 0),
      0,
    );
    const cancelled = list.reduce((s, r) => s + Number(r.concession_cancelled_amount || 0), 0);
    return { granted, cancelled, net: granted - cancelled, count: list.length };
  }, [q.data]);
  if (q.isLoading) return <Loading />;
  return (
    <div>
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <StatCard label="Students" value={totals.count} icon={Percent} tone="info" />
        <StatCard label="Granted" value={inr(totals.granted)} icon={IndianRupee} tone="default" />
        <StatCard
          label="Cancelled"
          value={inr(totals.cancelled)}
          icon={AlertCircle}
          tone="destructive"
        />
        <StatCard label="Net Active" value={inr(totals.net)} icon={IndianRupee} tone="success" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Concessions</CardTitle>
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              disabled={!(q.data as any[])?.length}
              onClick={() =>
                exportCSV(
                  `concessions_${Date.now()}.csv`,
                  (q.data as any[]).map((r) => ({
                    admission_number: r.students?.admission_number,
                    student: r.students?.full_name,
                    mobile: r.students?.mobile,
                    course: r.students?.courses?.name,
                    plan: r.plan_kind,
                    gross_fee: r.gross_fee,
                    original_discount: r.original_discount_amount || r.discount_amount,
                    cancelled: r.concession_cancelled_amount,
                    active_discount: r.discount_amount,
                    net_payable: r.net_payable,
                  })),
                )
              }
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admission</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Granted</TableHead>
                <TableHead className="text-right">Cancelled</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {((q.data as any[]) || []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.students?.admission_number}
                  </TableCell>
                  <TableCell>
                    {r.students?.full_name}
                    <div className="text-xs text-muted-foreground">{r.students?.mobile}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.students?.courses?.name}</TableCell>
                  <TableCell className="text-right">
                    {inr(r.original_discount_amount || r.discount_amount)}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    {inr(r.concession_cancelled_amount || 0)}
                  </TableCell>
                  <TableCell className="text-right text-success">
                    {inr(r.discount_amount)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{inr(r.net_payable)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanUpgradesReport({ campusId, canExport }: { campusId: string | null; canExport: boolean }) {
  const q = useQuery({
    queryKey: ["report", "plan-upgrades", campusId],
    queryFn: () => getPlanUpgradesReportFn({ data: { campusId: campusId ?? undefined } }),
  });
  if (q.isLoading) return <Loading />;
  const list = (q.data as any[]) || [];
  return (
    <div>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Total Upgrades" value={list.length} icon={ArrowUpCircle} tone="info" />
        <StatCard
          label="To Plan 5 (5 instalments)"
          value={list.filter((u: any) => u.to_plan === "plan_5").length}
          icon={ArrowUpCircle}
          tone="warning"
        />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Plan Upgrade History</CardTitle>
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              disabled={!list.length}
              onClick={() =>
                exportCSV(
                  `plan_upgrades_${Date.now()}.csv`,
                  list.map((u: any) => ({
                    date: u.created_at,
                    admission_number: u.students?.admission_number,
                    student: u.students?.full_name,
                    course: u.students?.courses?.name,
                    from: u.from_plan,
                    to: u.to_plan,
                    reason: u.reason,
                    by: u.performed_by_name,
                  })),
                )
              }
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Admission</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="text-sm">{fmtDate(u.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {u.students?.admission_number}
                  </TableCell>
                  <TableCell>{u.students?.full_name}</TableCell>
                  <TableCell className="text-sm">{u.students?.courses?.name}</TableCell>
                  <TableCell className="text-sm">
                    {PLAN_LABEL[u.from_plan as PlanKind] || u.from_plan}
                  </TableCell>
                  <TableCell className="text-sm">
                    {PLAN_LABEL[u.to_plan as PlanKind] || u.to_plan}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.reason || "—"}</TableCell>
                  <TableCell className="text-sm">{u.performed_by_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
