import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCoursesFn } from "@/fns/courses";
import { searchStudentsFn } from "@/fns/students";
import { getInstallmentsFn, getFeeAssignmentFn } from "@/fns/students";
import { nextReceiptNumberFn, recordPaymentFn } from "@/fns/payments";
import { cancelConcessionFn } from "@/fns/students";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Receipt, IndianRupee, CheckCircle2, Filter, X, Lock } from "lucide-react";
import { inr, fmtDate, modeLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useCampus } from "@/lib/campus";
import { logAudit } from "@/lib/audit";
import type { AppRole } from "@/lib/permissions";
import logoUrl from "@/assets/logo.png";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_auth/collect")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: Page,
});

type Inst = {
  id: string;
  installment_no: number;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
  late_fee: number;
};
type FA = {
  id: string;
  gross_fee: number;
  discount_amount: number;
  net_payable: number;
  concession_cancelled_amount: number;
};
type Student = {
  id: string;
  admission_number: string;
  full_name: string;
  mobile: string;
  courses?: { name: string } | null;
  batches?: { name: string } | null;
};

function Page() {
  const { fullName, role, user, hasPermission } = useAuth();
  const { campusId } = useCampus();
  const qc = useQueryClient();
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [selected, setSelected] = useState<Student | null>(null);
  const [payInst, setPayInst] = useState<Inst | null>(null);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState<string>("active");
  const [cancelConcessionOpen, setCancelConcessionOpen] = useState(false);

  const courses = useQuery({
    queryKey: ["collect", "courses"],
    queryFn: () => getCoursesFn({ data: { activeOnly: true } }),
  });

  const search = useQuery({
    queryKey: ["collect", "search", q, campusId],
    enabled: q.trim().length >= 2,
    queryFn: () => searchStudentsFn({ data: { q: q.trim(), campusId: campusId ?? undefined } }),
  });

  const installments = useQuery({
    queryKey: ["collect", "installments", selected?.id],
    enabled: !!selected,
    queryFn: () => getInstallmentsFn({ data: { studentId: selected!.id } }),
  });

  const feeAssignment = useQuery({
    queryKey: ["collect", "fee_assignment", selected?.id],
    enabled: !!selected,
    queryFn: () => getFeeAssignmentFn({ data: { studentId: selected!.id } }),
  });

  const totals = useMemo(() => {
    const list = (installments.data as Inst[]) || [];
    const total = list.reduce((s, i) => s + Number(i.amount), 0);
    const paid = list.reduce((s, i) => s + Number(i.amount_paid), 0);
    return { total, paid, due: total - paid };
  }, [installments.data]);

  const recordPayment = useMutation({
    mutationFn: async (form: {
      amount: number;
      payment_mode: "cash" | "upi" | "cheque" | "dd" | "card";
      cheque_number?: string;
      cheque_bank?: string;
      cheque_date?: string;
      upi_reference?: string;
      card_last4?: string;
      notes?: string;
    }) => {
      if (!payInst || !selected) throw new Error("Missing context");
      const status =
        form.payment_mode === "cheque" || form.payment_mode === "dd" ? "pending" : "cleared";
      const receiptNo = await nextReceiptNumberFn({
        data: { year: new Date().getFullYear().toString() },
      });
      const pay = (await recordPaymentFn({
        data: {
          installment_id: payInst.id,
          student_id: selected.id,
          amount: form.amount,
          payment_mode: form.payment_mode,
          receipt_number: receiptNo,
          collected_by: user?.id ?? "",
          collected_by_name: fullName || "Cashier",
          status,
          cheque_number: form.cheque_number || null,
          cheque_bank: form.cheque_bank || null,
          cheque_date: form.cheque_date || null,
          upi_reference: form.upi_reference || null,
          card_last4: form.card_last4 || null,
          notes: form.notes || null,
        },
      })) as any;
      await logAudit({
        actorName: fullName,
        actorRole: role,
        action: "collect_payment",
        entityType: "payment",
        entityId: pay?.id,
        newValue: {
          receipt: pay?.receipt_number ?? receiptNo,
          amount: form.amount,
          mode: form.payment_mode,
        },
      });
      const reference =
        form.payment_mode === "cheque" || form.payment_mode === "dd"
          ? `${form.cheque_bank || ""} ${form.cheque_number || ""}`.trim()
          : form.payment_mode === "upi"
            ? form.upi_reference || ""
            : form.payment_mode === "card" && form.card_last4
              ? `**** ${form.card_last4}`
              : "";
      return {
        receipt: pay?.receipt_number ?? receiptNo,
        amount: Number(form.amount || 0),
        student: selected.full_name,
        admissionNumber: selected.admission_number,
        course: selected.courses?.name || "",
        mode: form.payment_mode,
        reference,
        paidAt: new Date().toISOString(),
        totalFee: totals.total,
        totalPaid: totals.paid + Number(form.amount || 0),
        balance: Math.max(0, totals.total - (totals.paid + Number(form.amount || 0))),
        installmentNo: payInst.installment_no,
      };
    },
    onSuccess: (r) => {
      toast.success(`Receipt ${r.receipt} generated`);
      setLastReceipt(r);
      setPayInst(null);
      qc.invalidateQueries({ queryKey: ["collect", "installments"] });
      qc.invalidateQueries({ queryKey: ["dash"] });
    },
    onError: (e: any) => toast.error(e?.message || "Payment failed"),
  });

  const searchList = (search.data as Student[]) || [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Collect Fee"
        description="Search a student, pick an installment, record the payment."
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSelected(null);
              }}
              placeholder="Type name, admission number, or mobile (min 2 chars)…"
              className="pl-9"
            />
          </div>

          {q.trim().length >= 2 && searchList.length > 0 && !selected && (
            <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-border">
              {searchList.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted"
                >
                  <div>
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.admission_number} · {s.mobile} · {s.courses?.name}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{s.batches?.name}</span>
                </button>
              ))}
            </div>
          )}
          {q.trim().length >= 2 && searchList.length === 0 && !search.isLoading && (
            <p className="mt-3 text-sm text-muted-foreground">No active students match.</p>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selected.full_name}</span>
              <button
                className="text-xs font-normal text-muted-foreground underline"
                onClick={() => setSelected(null)}
              >
                change
              </button>
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {selected.admission_number} · {selected.mobile} · {selected.courses?.name} /{" "}
              {selected.batches?.name}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Stat label="Total Fees" value={inr(totals.total)} />
              <Stat label="Paid" value={inr(totals.paid)} accent="success" />
              <Stat label="Outstanding" value={inr(totals.due)} accent="destructive" />
            </div>

            {feeAssignment.data && Number((feeAssignment.data as FA).discount_amount) > 0 && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                <div>
                  <div className="font-medium">
                    Concession active · {inr(Number((feeAssignment.data as FA).discount_amount))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Cancel the concession to add the amount back to the next unpaid instalment.
                  </div>
                </div>
                {hasPermission("canCancelConcession") ? (
                  <Button size="sm" variant="outline" onClick={() => setCancelConcessionOpen(true)}>
                    Cancel concession
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        You do not have permission to cancel concessions.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}

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
                  {((installments.data as Inst[]) || []).map((i) => {
                    const remaining = Number(i.amount) - Number(i.amount_paid);
                    return (
                      <TableRow key={i.id}>
                        <TableCell>{i.installment_no}</TableCell>
                        <TableCell className="text-sm">{fmtDate(i.due_date)}</TableCell>
                        <TableCell className="text-right">{inr(i.amount)}</TableCell>
                        <TableCell className="text-right">{inr(i.amount_paid)}</TableCell>
                        <TableCell>
                          <StatusBadge status={i.status} />
                        </TableCell>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" /> Payment recorded
            </DialogTitle>
            <DialogDescription>
              Receipt has been generated and the audit log updated.
            </DialogDescription>
          </DialogHeader>
          {lastReceipt && (
            <div id="receipt-print" className="rounded-md border border-border bg-card p-5 text-sm">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <img
                  src={logoUrl}
                  alt="Excellent NEET Academy Dharwad"
                  className="h-14 w-14 object-contain"
                />
                <div>
                  <div className="text-base font-bold text-foreground">EXCELLENT NEET ACADEMY</div>
                  <div className="text-xs text-muted-foreground">Dharwad</div>
                  <div className="text-xs text-muted-foreground">Fee Receipt</div>
                </div>
                <div className="ml-auto text-right text-xs">
                  <div className="font-mono font-semibold">#{lastReceipt.receipt}</div>
                  <div className="text-muted-foreground">
                    {new Date(lastReceipt.paidAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 py-3">
                <ReceiptRow k="Student" v={lastReceipt.student} />
                <ReceiptRow
                  k="Adm. No"
                  v={<span className="font-mono">{lastReceipt.admissionNumber}</span>}
                />
                <ReceiptRow k="Course" v={lastReceipt.course || "—"} />
                <ReceiptRow k="Installment" v={`#${lastReceipt.installmentNo}`} />
                <ReceiptRow k="Mode" v={modeLabel(lastReceipt.mode)} />
                <ReceiptRow k="Reference" v={lastReceipt.reference || "—"} />
              </div>
              <div className="space-y-1 border-t border-border pt-3">
                <div className="flex justify-between text-base font-semibold">
                  <span>Amount Received</span>
                  <span>{inr(lastReceipt.amount)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total Fee</span>
                  <span>{inr(lastReceipt.totalFee)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total Paid (incl. this)</span>
                  <span>{inr(lastReceipt.totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Balance Due</span>
                  <span className={lastReceipt.balance > 0 ? "text-destructive" : "text-success"}>
                    {inr(lastReceipt.balance)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>Collected by: {fullName || "—"}</span>
                <span>This is a computer-generated receipt.</span>
              </div>
            </div>
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
            <Button onClick={() => setLastReceipt(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && feeAssignment.data && hasPermission("canCancelConcession") && (
        <CancelConcessionDialog
          open={cancelConcessionOpen}
          onClose={() => setCancelConcessionOpen(false)}
          student={selected}
          feeAssignment={feeAssignment.data as FA}
          actorName={fullName}
          actorRole={role}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["collect", "installments"] });
            qc.invalidateQueries({ queryKey: ["collect", "fee_assignment"] });
          }}
        />
      )}
    </div>
  );
}

function PaymentDialog({
  open,
  onClose,
  installment,
  onSubmit,
  pending,
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

  useMemo(() => {
    setAmount(remaining);
    setMode("cash");
    setChequeNo("");
    setChequeBank("");
    setChequeDate("");
    setUpiRef("");
    setCardLast4("");
    setNotes("");
  }, [installment?.id, remaining]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment · Installment #{installment?.installment_no}</DialogTitle>
          <DialogDescription>
            Outstanding {inr(remaining)} due {installment ? fmtDate(installment.due_date) : "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <PField label="Amount">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </PField>
          <PField label="Payment Mode">
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="dd">DD</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </PField>
          {mode === "upi" && (
            <PField label="UPI Reference">
              <Input value={upiRef} onChange={(e) => setUpiRef(e.target.value)} />
            </PField>
          )}
          {(mode === "cheque" || mode === "dd") && (
            <div className="grid grid-cols-2 gap-3">
              <PField label={`${modeLabel(mode)} Number`}>
                <Input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
              </PField>
              <PField label="Bank">
                <Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} />
              </PField>
              <PField label="Date" className="col-span-2">
                <Input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                />
              </PField>
            </div>
          )}
          {mode === "card" && (
            <PField label="Card Last 4">
              <Input
                maxLength={4}
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value)}
              />
            </PField>
          )}
          <PField label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </PField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                amount,
                payment_mode: mode,
                cheque_number: chequeNo,
                cheque_bank: chequeBank,
                cheque_date: chequeDate || undefined,
                upi_reference: upiRef,
                card_last4: cardLast4,
                notes,
              })
            }
            disabled={pending || !amount || amount > remaining}
          >
            {pending ? (
              "Recording…"
            ) : (
              <>
                <Receipt className="h-4 w-4" /> Record & Generate Receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelConcessionDialog({
  open,
  onClose,
  student,
  feeAssignment,
  actorName,
  actorRole,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  student: Student;
  feeAssignment: FA;
  actorName: string;
  actorRole: AppRole | null;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const original = Number(feeAssignment.discount_amount || 0);
  const [amount, setAmount] = useState(original);
  const [reason, setReason] = useState("Overdue payment");

  useMemo(() => {
    setAmount(original);
  }, [feeAssignment.id, original]);

  const submit = useMutation({
    mutationFn: async () => {
      const cancel = Math.min(Math.max(0, Number(amount)), original);
      const newDiscount = original - cancel;
      const newNet = Number(feeAssignment.gross_fee) - newDiscount;
      await cancelConcessionFn({
        data: {
          student_id: student.id,
          fee_assignment_id: feeAssignment.id,
          original_discount: original,
          cancelled_amount: cancel,
          new_net_payable: newNet,
          new_discount: newDiscount,
          reason: reason || null,
          performed_by: user?.id ?? null,
          performed_by_name: actorName,
        },
      });
      await logAudit({
        actorName,
        actorRole,
        action: "cancel_concession",
        entityType: "student",
        entityId: student.id,
        oldValue: { discount: original },
        newValue: { cancelled: cancel, new_discount: newDiscount },
        reason,
      });
    },
    onSuccess: () => {
      toast.success("Concession cancelled");
      onDone();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Concession</DialogTitle>
          <DialogDescription>
            Original concession {inr(original)}. Cancelled amount is added back to the next unpaid
            instalment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs">Amount to cancel (₹) *</Label>
            <Input
              type="number"
              min={0}
              max={original}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Reason</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || amount <= 0}>
            {submit.isPending ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "destructive";
}) {
  const cls =
    accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "";
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}
function ReceiptRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
