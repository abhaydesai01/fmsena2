import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Loading } from "@/components/app/Loading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Receipt, IndianRupee, CheckCircle2, Filter, X } from "lucide-react";
import { inr, fmtDate, modeLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_auth/collect")({ component: Page });

type Inst = {
  id: string; installment_no: number; due_date: string; amount: number;
  amount_paid: number; status: string; late_fee: number;
};
type Student = {
  id: string; admission_number: string; full_name: string; mobile: string;
  courses?: { name: string } | null; batches?: { name: string } | null;
};

type BrowseRow = Student & {
  course_id: string;
  total: number;
  paid: number;
  due: number;
  pay_status: "paid" | "partial" | "due" | "overdue";
};

function Page() {
  const { fullName, role, user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [payInst, setPayInst] = useState<Inst | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ no: string; student: string; amount: number } | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "partial" | "due" | "overdue">("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"all" | "active" | "discontinued" | "completed">("active");

  const courses = useQuery({
    queryKey: ["collect", "courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const browse = useQuery({
    queryKey: ["collect", "browse", courseFilter, statusFilter, studentStatusFilter],
    enabled: !selected && q.trim().length < 2,
    queryFn: async () => {
      let sQ = supabase
        .from("students")
        .select("id, admission_number, full_name, mobile, course_id, courses(name), batches(name)")
        .order("full_name")
        .limit(500);
      if (courseFilter !== "all") sQ = sQ.eq("course_id", courseFilter);
      if (studentStatusFilter !== "all") sQ = sQ.eq("status", studentStatusFilter as any);
      const { data: students } = await sQ;
      const list = (students || []) as (Student & { course_id: string })[];
      if (list.length === 0) return [] as BrowseRow[];

      const ids = list.map((s) => s.id);
      const { data: ins } = await supabase
        .from("installments")
        .select("student_id, amount, amount_paid, status, due_date")
        .in("student_id", ids);

      const today = new Date().toISOString().slice(0, 10);
      const agg = new Map<string, { total: number; paid: number; hasOverdue: boolean }>();
      for (const i of ins || []) {
        const a = agg.get(i.student_id) || { total: 0, paid: 0, hasOverdue: false };
        a.total += Number(i.amount);
        a.paid += Number(i.amount_paid);
        const remaining = Number(i.amount) - Number(i.amount_paid);
        if (remaining > 0 && i.due_date < today) a.hasOverdue = true;
        agg.set(i.student_id, a);
      }

      const rows: BrowseRow[] = list.map((s) => {
        const a = agg.get(s.id) || { total: 0, paid: 0, hasOverdue: false };
        const due = a.total - a.paid;
        let pay_status: BrowseRow["pay_status"] = "due";
        if (a.total === 0) pay_status = "due";
        else if (due <= 0) pay_status = "paid";
        else if (a.hasOverdue) pay_status = "overdue";
        else if (a.paid > 0) pay_status = "partial";
        return { ...s, total: a.total, paid: a.paid, due, pay_status };
      });

      return statusFilter === "all" ? rows : rows.filter((r) => r.pay_status === statusFilter);
    },
  });

  const search = useQuery({
    queryKey: ["collect", "search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const term = q.trim();
      const { data } = await supabase
        .from("students")
        .select("id, admission_number, full_name, mobile, courses(name), batches(name)")
        .or(`full_name.ilike.%${term}%,admission_number.ilike.%${term}%,mobile.ilike.%${term}%`)
        .eq("status", "active")
        .limit(20);
      return (data || []) as Student[];
    },
  });

  const installments = useQuery({
    queryKey: ["collect", "installments", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("installments")
        .select("id, installment_no, due_date, amount, amount_paid, status, late_fee")
        .eq("student_id", selected!.id)
        .order("installment_no");
      return (data || []) as Inst[];
    },
  });

  const totals = useMemo(() => {
    const list = installments.data || [];
    const total = list.reduce((s, i) => s + Number(i.amount), 0);
    const paid = list.reduce((s, i) => s + Number(i.amount_paid), 0);
    return { total, paid, due: total - paid };
  }, [installments.data]);

  const recordPayment = useMutation({
    mutationFn: async (form: {
      amount: number; payment_mode: "cash" | "upi" | "cheque" | "dd" | "card";
      cheque_number?: string; cheque_bank?: string; cheque_date?: string;
      upi_reference?: string; card_last4?: string; notes?: string;
    }) => {
      if (!payInst || !selected || !user) throw new Error("Missing context");
      const { data: rcpt, error: rErr } = await supabase.rpc("next_receipt_number", { _year: "2025-26" });
      if (rErr) throw rErr;
      const status = form.payment_mode === "cheque" || form.payment_mode === "dd" ? "pending" : "cleared";
      const { data: pay, error: pErr } = await supabase.from("payments").insert({
        installment_id: payInst.id,
        student_id: selected.id,
        amount: form.amount,
        payment_mode: form.payment_mode,
        receipt_number: rcpt as string,
        collected_by: user.id,
        collected_by_name: fullName || "Cashier",
        status,
        cheque_number: form.cheque_number || null,
        cheque_bank: form.cheque_bank || null,
        cheque_date: form.cheque_date || null,
        upi_reference: form.upi_reference || null,
        card_last4: form.card_last4 || null,
        notes: form.notes || null,
      }).select("*").single();
      if (pErr) throw pErr;
      await logAudit({
        actorName: fullName, actorRole: role,
        action: "collect_payment", entityType: "payment", entityId: pay.id,
        newValue: { receipt: rcpt, amount: form.amount, mode: form.payment_mode },
      });
      return { receipt: rcpt as string, amount: form.amount, student: selected.full_name };
    },
    onSuccess: (r) => {
      toast.success(`Receipt ${r.receipt} generated`);
      setLastReceipt({ no: r.receipt, student: r.student, amount: r.amount });
      setPayInst(null);
      qc.invalidateQueries({ queryKey: ["collect", "installments"] });
      qc.invalidateQueries({ queryKey: ["dash"] });
    },
    onError: (e: any) => toast.error(e?.message || "Payment failed"),
  });

  return (
    <div>
      <PageHeader title="Collect Fee" description="Search a student, pick an installment, record the payment." />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setSelected(null); }} placeholder="Type name, admission number, or mobile (min 2 chars)…" className="pl-9" />
          </div>

          {q.trim().length >= 2 && search.data && search.data.length > 0 && !selected && (
            <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-border">
              {search.data.map((s) => (
                <button key={s.id} onClick={() => setSelected(s)} className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted">
                  <div>
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground">{s.admission_number} · {s.mobile} · {s.courses?.name}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{s.batches?.name}</span>
                </button>
              ))}
            </div>
          )}
          {q.trim().length >= 2 && search.data && search.data.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">No active students match.</p>
          )}

          {!selected && q.trim().length < 2 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> Filters
              </div>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses</SelectItem>
                  {courses.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Fee status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Fully paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="due">Due</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={studentStatusFilter} onValueChange={(v: any) => setStudentStatusFilter(v)}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Student status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All students</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              {(courseFilter !== "all" || statusFilter !== "all" || studentStatusFilter !== "active") && (
                <Button variant="ghost" size="sm" onClick={() => { setCourseFilter("all"); setStatusFilter("all"); setStudentStatusFilter("active"); }}>
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {browse.isLoading ? "Loading…" : `${browse.data?.length ?? 0} students`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {!selected && q.trim().length < 2 && (
        <Card className="mb-4">
          <CardContent className="p-0">
            {browse.isLoading ? (
              <Loading />
            ) : (browse.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No students match these filters"
                description="Adjust the course or fee status filter, or search by name above."
              />
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course / Batch</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {browse.data?.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium">{s.full_name}</div>
                          <div className="text-xs text-muted-foreground">{s.admission_number} · {s.mobile}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.courses?.name || "—"}<br />
                          <span className="text-xs">{s.batches?.name || ""}</span>
                        </TableCell>
                        <TableCell className="text-right">{inr(s.total)}</TableCell>
                        <TableCell className={`text-right font-medium ${s.due > 0 ? "text-destructive" : ""}`}>
                          {inr(s.due)}
                        </TableCell>
                        <TableCell><StatusBadge status={s.pay_status} /></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant={s.due > 0 ? "default" : "outline"} onClick={() => setSelected(s)}>
                            {s.due > 0 ? "Collect" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selected.full_name}</span>
              <button className="text-xs font-normal text-muted-foreground underline" onClick={() => setSelected(null)}>change</button>
            </CardTitle>
            <div className="text-sm text-muted-foreground">{selected.admission_number} · {selected.mobile} · {selected.courses?.name} / {selected.batches?.name}</div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Stat label="Total Fees" value={inr(totals.total)} />
              <Stat label="Paid" value={inr(totals.paid)} accent="success" />
              <Stat label="Outstanding" value={inr(totals.due)} accent="destructive" />
            </div>

            {installments.isLoading ? (
              <Loading />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.data?.map((i) => {
                    const remaining = Number(i.amount) - Number(i.amount_paid);
                    return (
                      <TableRow key={i.id}>
                        <TableCell>{i.installment_no}</TableCell>
                        <TableCell className="text-sm">{fmtDate(i.due_date)}</TableCell>
                        <TableCell className="text-right">{inr(i.amount)}</TableCell>
                        <TableCell className="text-right">{inr(i.amount_paid)}</TableCell>
                        <TableCell><StatusBadge status={i.status} /></TableCell>
                        <TableCell className="text-right">
                          {i.status !== "paid" && (
                            <Button size="sm" onClick={() => setPayInst(i)}>
                              <IndianRupee className="h-4 w-4" /> Collect {inr(remaining)}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <PaymentDialog
        open={!!payInst}
        onClose={() => setPayInst(null)}
        installment={payInst}
        onSubmit={(form) => recordPayment.mutate(form)}
        pending={recordPayment.isPending}
      />

      <Dialog open={!!lastReceipt} onOpenChange={(o) => !o && setLastReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-success" /> Payment recorded</DialogTitle>
            <DialogDescription>Receipt has been generated and the audit log updated.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
            <Row k="Receipt #" v={<span className="font-mono">{lastReceipt?.no}</span>} />
            <Row k="Student" v={lastReceipt?.student || ""} />
            <Row k="Amount" v={inr(lastReceipt?.amount || 0)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>Print</Button>
            <Button onClick={() => setLastReceipt(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentDialog({
  open, onClose, installment, onSubmit, pending,
}: {
  open: boolean;
  onClose: () => void;
  installment: Inst | null;
  onSubmit: (f: any) => void;
  pending: boolean;
}) {
  const remaining = installment ? Number(installment.amount) - Number(installment.amount_paid) : 0;
  const [amount, setAmount] = useState(remaining);
  const [mode, setMode] = useState<"cash" | "upi" | "cheque" | "dd" | "card">("cash");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [upiRef, setUpiRef] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [notes, setNotes] = useState("");

  // reset when installment changes
  useMemo(() => {
    setAmount(remaining); setMode("cash");
    setChequeNo(""); setChequeBank(""); setChequeDate("");
    setUpiRef(""); setCardLast4(""); setNotes("");
  }, [installment?.id, remaining]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment · Installment #{installment?.installment_no}</DialogTitle>
          <DialogDescription>Outstanding {inr(remaining)} due {installment ? fmtDate(installment.due_date) : "—"}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Amount">
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Payment Mode">
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="dd">DD</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === "upi" && (
            <Field label="UPI Reference">
              <Input value={upiRef} onChange={(e) => setUpiRef(e.target.value)} />
            </Field>
          )}
          {(mode === "cheque" || mode === "dd") && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${modeLabel(mode)} Number`}>
                <Input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
              </Field>
              <Field label="Bank">
                <Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} />
              </Field>
              <Field label="Date" className="col-span-2">
                <Input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
              </Field>
            </div>
          )}
          {mode === "card" && (
            <Field label="Card Last 4">
              <Input maxLength={4} value={cardLast4} onChange={(e) => setCardLast4(e.target.value)} />
            </Field>
          )}
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit({
            amount, payment_mode: mode,
            cheque_number: chequeNo, cheque_bank: chequeBank, cheque_date: chequeDate || undefined,
            upi_reference: upiRef, card_last4: cardLast4, notes,
          })} disabled={pending || !amount || amount > remaining}>
            {pending ? "Recording…" : <><Receipt className="h-4 w-4" /> Record & Generate Receipt</>}
          </Button>
          {amount > remaining && (
            <div className="text-xs text-destructive">Amount exceeds outstanding {inr(remaining)}.</div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1 block text-xs">{label}</Label>{children}</div>;
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: "success" | "destructive" }) {
  const cls = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "";
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-0.5"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
  );
}
