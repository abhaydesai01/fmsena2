import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/PageHeader";
import { Loading } from "@/components/app/Loading";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeftRight, ArrowUpRight, ChevronLeft, FileText, Upload, Trash2, History } from "lucide-react";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_auth/students/$studentId")({ component: Page });

function Page() {
  const { studentId } = Route.useParams();
  const { isAdmin, fullName, role, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [transferOpen, setTransferOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const student = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, courses(name, gross_fee), batches(id, name, timing), campuses(name)")
        .eq("id", studentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const installments = useQuery({
    queryKey: ["student", studentId, "installments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("installments")
        .select("*")
        .eq("student_id", studentId)
        .order("installment_no");
      return data || [];
    },
  });

  const payments = useQuery({
    queryKey: ["student", studentId, "payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, receipt_number, payment_date, amount, payment_mode, status")
        .eq("student_id", studentId)
        .order("payment_date", { ascending: false });
      return data || [];
    },
  });

  const documents = useQuery({
    queryKey: ["student", studentId, "documents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_documents")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const transfers = useQuery({
    queryKey: ["student", studentId, "transfers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_transfers")
        .select("*, from_batch:from_batch_id(name), to_batch:to_batch_id(name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const uploadDoc = useMutation({
    mutationFn: async ({ label, file }: { label: string; file: File }) => {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${studentId}/${Date.now()}_${label.replace(/\W+/g, "_")}.${ext}`;
      const { error: upErr } = await supabase.storage.from("student-files").upload(path, file, {
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("student-files").getPublicUrl(path);
      const { error } = await supabase.from("student_documents").insert({
        student_id: studentId,
        label,
        file_url: pub.publicUrl,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user?.id ?? null,
        uploaded_by_name: fullName,
      });
      if (error) throw error;
      await logAudit({
        actorName: fullName, actorRole: role,
        action: "upload_document", entityType: "student", entityId: studentId,
        newValue: { label, size: file.size },
      });
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: ["student", studentId, "documents"] });
    },
    onError: (e: any) => toast.error(e?.message || "Upload failed"),
  });

  if (student.isLoading) return <Loading />;
  if (!student.data) {
    return (
      <div>
        <PageHeader title="Student not found" />
        <Link to="/students" className="text-sm underline">Back to students</Link>
      </div>
    );
  }

  const s = student.data;
  const totalDue = (installments.data || []).reduce((a, i) => a + Number(i.amount) - Number(i.amount_paid), 0);
  const totalPaid = (installments.data || []).reduce((a, i) => a + Number(i.amount_paid), 0);

  return (
    <div className="space-y-4">
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to students
      </Link>

      <PageHeader
        title={s.full_name}
        description={`${s.admission_number} · ${s.courses?.name || "—"} · ${s.batches?.name || "—"} · ${(s as any).campuses?.name || "—"}`}
        actions={isAdmin ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight className="h-4 w-4" /> Transfer Batch
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPromoteOpen(true)}>
              <ArrowUpRight className="h-4 w-4" /> Promote Class
            </Button>
          </>
        ) : undefined}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Paid</div><div className="text-2xl font-bold text-success">{inr(totalPaid)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-2xl font-bold text-destructive">{inr(totalDue)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Status</div><div className="mt-1"><StatusBadge status={s.status} /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <Info k="DOB" v={fmtDate(s.date_of_birth)} />
          <Info k="Gender" v={s.gender} />
          <Info k="Mobile" v={s.mobile} />
          <Info k="Email" v={s.email || "—"} />
          <Info k="Aadhaar" v={s.aadhaar_number || "—"} />
          <Info k="Class" v={s.class_year} />
          <Info k="Permanent Address" v={s.permanent_address} />
          <Info k="Father" v={`${s.father_name} · ${s.father_mobile}`} />
          <Info k="Mother" v={s.mother_name ? `${s.mother_name} · ${s.mother_mobile || "—"}` : "—"} />
          <Info k="Emergency" v={s.emergency_name ? `${s.emergency_name} (${s.emergency_relation || "—"}) · ${s.emergency_mobile || "—"}` : "—"} />
          <Info k="Blood Group" v={(s as any).blood_group || "—"} />
          <Info k="Category / Religion" v={`${(s as any).category || "—"} · ${(s as any).religion || "—"}`} />
          <Info k="Previous School" v={s.previous_school || "—"} />
          <Info k="Previous Class" v={(s as any).previous_class || "—"} />
          <Info k="Admission Date" v={fmtDate(s.admission_date)} />
          <Info k="Academic Year" v={s.academic_year} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle><FileText className="mr-2 inline h-4 w-4" /> Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocsUploader onUpload={(label, file) => uploadDoc.mutate({ label, file })} pending={uploadDoc.isPending} />
          {(documents.data?.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Uploaded</TableHead><TableHead>Size</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {documents.data?.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(d.created_at)} · {d.uploaded_by_name}</TableCell>
                    <TableCell className="text-xs">{d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs underline">Open</a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Installments</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {installments.data?.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i.installment_no}</TableCell>
                  <TableCell className="text-sm">{fmtDate(i.due_date)}</TableCell>
                  <TableCell className="text-right">{inr(i.amount)}</TableCell>
                  <TableCell className="text-right">{inr(i.amount_paid)}</TableCell>
                  <TableCell><StatusBadge status={i.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle><History className="mr-2 inline h-4 w-4" /> Transfer History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(transfers.data?.length ?? 0) === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No transfers recorded.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Kind</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>By</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
              <TableBody>
                {transfers.data?.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{fmtDateTime(t.created_at)}</TableCell>
                    <TableCell className="capitalize text-sm">{t.kind.replace("_", " ")}</TableCell>
                    <TableCell className="text-sm">{t.from_batch?.name || t.from_class || "—"}</TableCell>
                    <TableCell className="text-sm">{t.to_batch?.name || t.to_class || "—"}</TableCell>
                    <TableCell className="text-sm">{t.performed_by_name}</TableCell>
                    <TableCell className="text-sm">{t.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(payments.data?.length ?? 0) === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.data?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                    <TableCell className="text-sm">{fmtDate(p.payment_date)}</TableCell>
                    <TableCell className="capitalize text-sm">{p.payment_mode}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-right font-semibold">{inr(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <TransferDialog
            open={transferOpen}
            onClose={() => setTransferOpen(false)}
            student={s}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["student", studentId] });
              qc.invalidateQueries({ queryKey: ["student", studentId, "transfers"] });
              qc.invalidateQueries({ queryKey: ["students"] });
            }}
          />
          <PromoteDialog
            open={promoteOpen}
            onClose={() => setPromoteOpen(false)}
            student={s}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["student", studentId] });
              qc.invalidateQueries({ queryKey: ["student", studentId, "transfers"] });
              qc.invalidateQueries({ queryKey: ["students"] });
            }}
          />
        </>
      )}
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="text-sm font-medium">{v}</div>
    </div>
  );
}

function DocsUploader({ onUpload, pending }: { onUpload: (label: string, file: File) => void; pending: boolean }) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-md border border-dashed border-border p-3 sm:flex-row sm:items-end">
      <div className="flex-1"><Label className="mb-1 block text-xs">Document name</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Aadhaar, 10th Marksheet…" /></div>
      <div className="flex-1"><Label className="mb-1 block text-xs">File</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      <Button size="sm" disabled={!label || !file || pending} onClick={() => { if (file) { onUpload(label, file); setFile(null); setLabel(""); } }}>
        <Upload className="h-4 w-4" /> {pending ? "Uploading…" : "Upload"}
      </Button>
    </div>
  );
}

function TransferDialog({ open, onClose, student, onDone }: { open: boolean; onClose: () => void; student: any; onDone: () => void }) {
  const { fullName, role, user } = useAuth();
  const [batchId, setBatchId] = useState("");
  const [reason, setReason] = useState("");

  const batches = useQuery({
    queryKey: ["transfer-batches", student.course_id, student.campus_id, open],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("batches")
        .select("id, name, timing")
        .eq("course_id", student.course_id)
        .eq("campus_id", student.campus_id)
        .neq("status", "closed")
        .order("name");
      return (data || []).filter((b: any) => b.id !== student.batch_id);
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!batchId) throw new Error("Pick a batch");
      const fromBatchId = student.batch_id as string;
      const { error: updErr } = await supabase.from("students").update({ batch_id: batchId }).eq("id", student.id);
      if (updErr) throw updErr;
      const { error: insErr } = await supabase.from("student_transfers").insert({
        student_id: student.id,
        kind: "batch_transfer",
        from_batch_id: fromBatchId,
        to_batch_id: batchId,
        reason: reason || null,
        performed_by: user?.id ?? null,
        performed_by_name: fullName,
      });
      if (insErr) throw insErr;
      await logAudit({
        actorName: fullName, actorRole: role,
        action: "transfer_batch", entityType: "student", entityId: student.id,
        oldValue: { batch_id: fromBatchId }, newValue: { batch_id: batchId }, reason: reason || undefined,
      });
    },
    onSuccess: () => { toast.success("Student transferred"); onDone(); onClose(); setBatchId(""); setReason(""); },
    onError: (e: any) => toast.error(e?.message || "Transfer failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer to another batch</DialogTitle>
          <DialogDescription>Same course & campus. The change is logged in the audit trail.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="mb-1 block text-xs">Current</Label><div className="text-sm">{student.batches?.name}</div></div>
          <div>
            <Label className="mb-1 block text-xs">Move to *</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger><SelectValue placeholder={(batches.data?.length ?? 0) === 0 ? "No other batches available" : "Select batch"} /></SelectTrigger>
              <SelectContent>
                {batches.data?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} {b.timing ? `· ${b.timing}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="mb-1 block text-xs">Reason</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || !batchId}>{submit.isPending ? "Transferring…" : "Confirm transfer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromoteDialog({ open, onClose, student, onDone }: { open: boolean; onClose: () => void; student: any; onDone: () => void }) {
  const { fullName, role, user } = useAuth();
  const [toClass, setToClass] = useState<"11th" | "12th" | "dropper">("12th");
  const [newCourseId, setNewCourseId] = useState("");
  const [newBatchId, setNewBatchId] = useState("");
  const [reason, setReason] = useState("Class promotion");

  const courses = useQuery({
    queryKey: ["promote-courses", student.campus_id, open],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, name").eq("is_active", true).eq("campus_id", student.campus_id).order("name");
      return data || [];
    },
  });
  const batches = useQuery({
    queryKey: ["promote-batches", newCourseId],
    enabled: open && !!newCourseId,
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("id, name, timing").eq("course_id", newCourseId).eq("campus_id", student.campus_id).neq("status", "closed").order("name");
      return data || [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!newCourseId || !newBatchId) throw new Error("Select course and batch");
      const fromClass = student.class_year as string;
      const fromBatchId = student.batch_id as string;
      const fromCourseId = student.course_id as string;
      // Update student to new class/course/batch; keep previous_class for retention reference.
      const { error: updErr } = await supabase.from("students").update({
        class_year: toClass,
        course_id: newCourseId,
        batch_id: newBatchId,
        previous_class: fromClass,
      }).eq("id", student.id);
      if (updErr) throw updErr;
      const { error: trErr } = await supabase.from("student_transfers").insert({
        student_id: student.id,
        kind: "class_promotion",
        from_batch_id: fromBatchId,
        to_batch_id: newBatchId,
        from_class: fromClass,
        to_class: toClass,
        reason: reason || null,
        performed_by: user?.id ?? null,
        performed_by_name: fullName,
      });
      if (trErr) throw trErr;
      await logAudit({
        actorName: fullName, actorRole: role,
        action: "promote_class", entityType: "student", entityId: student.id,
        oldValue: { class_year: fromClass, course_id: fromCourseId, batch_id: fromBatchId },
        newValue: { class_year: toClass, course_id: newCourseId, batch_id: newBatchId },
        reason: reason || undefined,
      });
    },
    onSuccess: () => { toast.success("Student promoted. Previous data retained."); onDone(); onClose(); },
    onError: (e: any) => toast.error(e?.message || "Promotion failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to next class</DialogTitle>
          <DialogDescription>Previous class, payment history, and documents are retained.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="mb-1 block text-xs">Current class</Label><div className="text-sm">{student.class_year}</div></div>
          <div>
            <Label className="mb-1 block text-xs">New class *</Label>
            <Select value={toClass} onValueChange={(v: any) => setToClass(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="11th">11th</SelectItem>
                <SelectItem value="12th">12th</SelectItem>
                <SelectItem value="dropper">Dropper</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">New course *</Label>
            <Select value={newCourseId} onValueChange={(v) => { setNewCourseId(v); setNewBatchId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.data?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">New batch *</Label>
            <Select value={newBatchId} onValueChange={setNewBatchId} disabled={!newCourseId}>
              <SelectTrigger><SelectValue placeholder={newCourseId ? "Select batch" : "Pick course first"} /></SelectTrigger>
              <SelectContent>{batches.data?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} {b.timing ? `· ${b.timing}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="mb-1 block text-xs">Reason</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? "Promoting…" : "Confirm promotion"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}