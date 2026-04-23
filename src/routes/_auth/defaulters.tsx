import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Loading } from "@/components/app/Loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/app/StatCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Bell, Receipt, Download, IndianRupee, CalendarClock } from "lucide-react";
import { inr, fmtDate, daysBetween, exportCSV } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_auth/defaulters")({ component: Page });

function Page() {
  const { fullName, role, user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [reminder, setReminder] = useState<{ studentId: string; mobile: string; name: string } | null>(null);

  const data = useQuery({
    queryKey: ["defaulters", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("id, installment_no, due_date, amount, amount_paid, status, students(id, full_name, admission_number, mobile, courses(name))")
        .lt("due_date", today)
        .neq("status", "paid")
        .order("due_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const summary = useMemo(() => {
    const list = data.data || [];
    const studentSet = new Set<string>();
    let outstanding = 0;
    for (const i of list as any[]) {
      studentSet.add(i.students?.id);
      outstanding += Number(i.amount) - Number(i.amount_paid);
    }
    return { count: studentSet.size, items: list.length, outstanding };
  }, [data.data]);

  const sendReminder = useMutation({
    mutationFn: async (msg: { channel: "sms" | "whatsapp"; message: string }) => {
      if (!reminder || !user) return;
      const { error } = await supabase.from("reminders").insert({
        student_id: reminder.studentId,
        recipient_mobile: reminder.mobile,
        kind: "overdue",
        channel: msg.channel,
        message: msg.message,
        triggered_by: user.id,
      });
      if (error) throw error;
      await logAudit({
        actorName: fullName, actorRole: role,
        action: "send_reminder", entityType: "student", entityId: reminder.studentId,
        newValue: { channel: msg.channel, message: msg.message },
      });
    },
    onSuccess: () => {
      toast.success("Reminder logged (delivery is stubbed for now).");
      setReminder(null);
      qc.invalidateQueries({ queryKey: ["defaulters"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not log reminder"),
  });

  return (
    <div>
      <PageHeader
        title="Defaulters"
        description="Students with overdue installments. Send reminders or collect right away."
        actions={
          <Button variant="outline" size="sm" disabled={!data.data?.length}
            onClick={() => exportCSV(`defaulters_${Date.now()}.csv`, (data.data as any[]).map((i) => ({
              admission_number: i.students?.admission_number,
              full_name: i.students?.full_name,
              mobile: i.students?.mobile,
              course: i.students?.courses?.name,
              installment_no: i.installment_no,
              due_date: i.due_date,
              days_overdue: daysBetween(i.due_date),
              amount: i.amount,
              amount_paid: i.amount_paid,
              outstanding: Number(i.amount) - Number(i.amount_paid),
            })))}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Defaulting Students" value={summary.count} icon={AlertTriangle} tone="destructive" />
        <StatCard label="Overdue Installments" value={summary.items} icon={CalendarClock} tone="warning" />
        <StatCard label="Total Outstanding" value={inr(summary.outstanding)} icon={IndianRupee} tone="destructive" />
      </div>

      {data.isLoading ? (
        <Loading />
      ) : !data.data?.length ? (
        <EmptyState icon={AlertTriangle} title="No defaulters 🎉" description="All installments are either paid or not yet due." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission #</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Inst.</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Days late</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.data as any[]).map((i) => {
                    const days = daysBetween(i.due_date);
                    const remaining = Number(i.amount) - Number(i.amount_paid);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.students?.admission_number}</TableCell>
                        <TableCell className="font-medium">{i.students?.full_name}<div className="text-xs text-muted-foreground">{i.students?.mobile}</div></TableCell>
                        <TableCell className="text-sm">{i.students?.courses?.name}</TableCell>
                        <TableCell>#{i.installment_no}</TableCell>
                        <TableCell className="text-sm">{fmtDate(i.due_date)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${days > 30 ? "bg-destructive/15 text-destructive" : "bg-warning/20 text-warning-foreground"}`}>{days}d</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{inr(remaining)}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setReminder({ studentId: i.students?.id, mobile: i.students?.mobile, name: i.students?.full_name })}>
                              <Bell className="h-4 w-4" /> Remind
                            </Button>
                            <Link to="/collect"><Button size="sm"><Receipt className="h-4 w-4" /> Collect</Button></Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ReminderDialog
        open={!!reminder}
        target={reminder}
        onClose={() => setReminder(null)}
        onSubmit={(p) => sendReminder.mutate(p)}
        pending={sendReminder.isPending}
      />
    </div>
  );
}

function ReminderDialog({
  open, target, onClose, onSubmit, pending,
}: {
  open: boolean;
  target: { studentId: string; mobile: string; name: string } | null;
  onClose: () => void;
  onSubmit: (p: { channel: "sms" | "whatsapp"; message: string }) => void;
  pending: boolean;
}) {
  const [channel, setChannel] = useState<"sms" | "whatsapp">("whatsapp");
  const [message, setMessage] = useState(
    "Dear Parent, this is a gentle reminder that the fee installment for your ward is overdue. Please pay at the earliest. — Excellent NEET Academy"
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send reminder · {target?.name}</DialogTitle>
          <DialogDescription>Stub: this logs the reminder. SMS/WhatsApp delivery will be wired later.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label className="mb-1 block text-xs">Channel</Label>
            <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">To</Label>
            <input className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm" disabled value={target?.mobile || ""} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Message</Label>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit({ channel, message })} disabled={pending || !message.trim()}>
            {pending ? "Logging…" : <><Bell className="h-4 w-4" /> Log reminder</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
