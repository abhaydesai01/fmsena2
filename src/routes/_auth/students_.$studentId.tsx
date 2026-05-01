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
import { ArrowLeftRight, ArrowUpRight, ChevronLeft, FileText, Upload, History, AlertTriangle, TrendingUp, Pencil, Save, X } from "lucide-react";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { PLAN_LABEL, PLAN_NEXT, PLAN_MONTHS, evenSplit, type PlanKind } from "@/lib/installments";

export const Route = createFileRoute("/_auth/students_/$studentId")({ component: Page });

function Page() {
  const { studentId } = Route.useParams();
  const { isAdmin, fullName, role, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [transferOpen, setTransferOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [cancelConcessionOpen, setCancelConcessionOpen] = useState(false);
  const [upgradePlanOpen, setUpgradePlanOpen] = useState(false);
  const [editInstId, setEditInstId] = useState<string | null>(null);
  const [editAmt, setEditAmt] = useState<number>(0);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Record<string, any>>({});
  const [profileSaving, setProfileSaving] = useState(false);

  const student = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, courses(name, gross_fee), batches(id, name, timing)")
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

  const feeAssignment = useQuery({
    queryKey: ["student", studentId, "fee-assignment"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fee_assignments")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const planUpgrades = useQuery({
    queryKey: ["student", studentId, "plan-upgrades"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_upgrades")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const concessionCancels = useQuery({
    queryKey: ["student", studentId, "concession-cancels"],
    queryFn: async () => {
      const { data } = await supabase
        .from("concession_cancellations")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
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
  const today = new Date().toISOString().slice(0, 10);
  const hasOverdue = (installments.data || []).some(
    (i: any) => Number(i.amount) - Number(i.amount_paid) > 0 && i.due_date < today,
  );
  const fa = feeAssignment.data as any;
  const currentPlan: PlanKind | null = fa?.plan_kind && PLAN_LABEL[fa.plan_kind as PlanKind] ? (fa.plan_kind as PlanKind) : null;
  const hasConcession = fa && Number(fa.discount_amount || 0) > 0;
  const showConcessionBanner = hasOverdue && hasConcession && Number(fa.concession_cancelled_amount || 0) === 0;
  const showUpgradeBanner = hasOverdue && currentPlan && PLAN_NEXT[currentPlan];

  return (
    <div className="space-y-4">
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to students
      </Link>

      <PageHeader
        title={s.full_name}
        description={`${s.admission_number} · ${s.courses?.name || "—"} · ${s.batches?.name || "—"}`}
        actions={isAdmin ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight className="h-4 w-4" /> Transfer Batch
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPromoteOpen(true)}>
              <ArrowUpRight className="h-4 w-4" /> Promote Class
            </Button>
            {currentPlan && PLAN_NEXT[currentPlan] && (
              <Button variant="outline" size="sm" onClick={() => setUpgradePlanOpen(true)}>
                <TrendingUp className="h-4 w-4" /> Upgrade Plan
              </Button>
            )}
            {hasConcession && Number(fa.concession_cancelled_amount || 0) === 0 && (
              <Button variant="outline" size="sm" onClick={() => setCancelConcessionOpen(true)}>
                <X className="h-4 w-4" /> Cancel Concession
              </Button>
            )}
          </>
        ) : undefined}
      />

      {(showConcessionBanner || showUpgradeBanner) && isAdmin && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-foreground">Overdue payment detected</div>
              <div className="mt-1 text-muted-foreground">
                {showConcessionBanner && <>Consider cancelling the concession ({inr(Number(fa.discount_amount))}). </>}
                {showUpgradeBanner && <>Consider upgrading from {PLAN_LABEL[currentPlan!]} to {PLAN_LABEL[PLAN_NEXT[currentPlan!]!]}.</>}
              </div>
              <div className="mt-2 flex gap-2">
                {showConcessionBanner && (
                  <Button size="sm" variant="outline" onClick={() => setCancelConcessionOpen(true)}>Cancel concession</Button>
                )}
                {showUpgradeBanner && (
                  <Button size="sm" variant="outline" onClick={() => setUpgradePlanOpen(true)}>Upgrade plan</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentPlan && (
        <div className="text-xs text-muted-foreground">
          Current plan: <strong className="text-foreground">{PLAN_LABEL[currentPlan]}</strong>
          {fa && Number(fa.concession_cancelled_amount || 0) > 0 && (
            <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">Concession cancelled · {inr(fa.concession_cancelled_amount)}</span>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Paid</div><div className="text-2xl font-bold text-success">{inr(totalPaid)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-2xl font-bold text-destructive">{inr(totalDue)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Status</div><div className="mt-1"><StatusBadge status={s.status} /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile</CardTitle>
          {isAdmin && !profileEdit && (
            <Button size="sm" variant="outline" onClick={() => {
              setProfileDraft({
                full_name: s.full_name ?? "",
                mobile: s.mobile ?? "",
                email: s.email ?? "",
                aadhaar_number: s.aadhaar_number ?? "",
                date_of_birth: s.date_of_birth ?? "",
                gender: s.gender ?? "",
                permanent_address: s.permanent_address ?? "",
                current_address: s.current_address ?? "",
                father_name: s.father_name ?? "",
                father_mobile: s.father_mobile ?? "",
                father_occupation: s.father_occupation ?? "",
                mother_name: s.mother_name ?? "",
                mother_mobile: s.mother_mobile ?? "",
                emergency_name: s.emergency_name ?? "",
                emergency_relation: s.emergency_relation ?? "",
                emergency_mobile: s.emergency_mobile ?? "",
                blood_group: (s as any).blood_group ?? "",
                category: (s as any).category ?? "",
                religion: (s as any).religion ?? "",
                previous_school: s.previous_school ?? "",
                previous_class: (s as any).previous_class ?? "",
                board: s.board ?? "",
                marks_10th: s.marks_10th ?? "",
                marks_12th: s.marks_12th ?? "",
                // NEET admission form fields
                course_type: (s as any).course_type ?? "",
                course_stream: (s as any).course_stream ?? "",
                pan_number: (s as any).pan_number ?? "",
                puc_hall_ticket_no: (s as any).puc_hall_ticket_no ?? "",
                sslc_register_number: (s as any).sslc_register_number ?? "",
                puc_total_percent: (s as any).puc_total_percent ?? "",
                puc_pcmb_percent: (s as any).puc_pcmb_percent ?? "",
                neet_marks_obtained: (s as any).neet_marks_obtained ?? "",
                admission_type: (s as any).admission_type ?? "",
                sub_caste_group: (s as any).sub_caste_group ?? "",
                college_type: (s as any).college_type ?? "",
                van_facility_required: (s as any).van_facility_required ?? false,
                present_address_pincode: (s as any).present_address_pincode ?? "",
                permanent_address_pincode: (s as any).permanent_address_pincode ?? "",
                mobile_secondary: (s as any).mobile_secondary ?? "",
                admission_place: (s as any).admission_place ?? "",
                family_annual_income: (s as any).family_annual_income ?? "",
              });
              setProfileEdit(true);
            }}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {isAdmin && profileEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={profileSaving} onClick={() => { setProfileEdit(false); setProfileDraft({}); }}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" disabled={profileSaving} onClick={async () => {
                // Mobile validation
                if (!profileDraft.full_name?.trim()) { toast.error("Full name is required"); return; }
                if (!profileDraft.mobile?.trim() || !/^\d{10}$/.test(profileDraft.mobile.trim())) { toast.error("Mobile must be 10 digits"); return; }
                if (profileDraft.father_mobile && !/^\d{10}$/.test(profileDraft.father_mobile.trim())) { toast.error("Father mobile must be 10 digits"); return; }
                if (!profileDraft.permanent_address?.trim()) { toast.error("Permanent address is required"); return; }

                // Build diff
                const diff: Record<string, { from: any; to: any }> = {};
                const updates: Record<string, any> = {};
                for (const [k, v] of Object.entries(profileDraft)) {
                  const orig = (s as any)[k];
                  const cleaned = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v;
                  if ((orig ?? null) !== (cleaned ?? null)) {
                    diff[k] = { from: orig ?? null, to: cleaned ?? null };
                    updates[k] = cleaned;
                  }
                }
                if (Object.keys(updates).length === 0) {
                  toast.info("No changes to save");
                  setProfileEdit(false);
                  return;
                }
                setProfileSaving(true);
                const { error } = await supabase.from("students").update(updates as any).eq("id", studentId);
                if (error) { setProfileSaving(false); toast.error(error.message); return; }
                await logAudit({
                  actorName: fullName, actorRole: role,
                  action: "edit_student_profile", entityType: "student", entityId: studentId,
                  oldValue: Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.from])),
                  newValue: Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.to])),
                });
                setProfileSaving(false);
                setProfileEdit(false);
                setProfileDraft({});
                toast.success("Profile updated");
                qc.invalidateQueries({ queryKey: ["student", studentId] });
              }}>
                <Save className="h-3.5 w-3.5" /> {profileSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          {profileEdit ? (
            <>
              <EditField k="Full Name *" v={profileDraft.full_name} onChange={(x) => setProfileDraft((p) => ({ ...p, full_name: x }))} />
              <EditField k="Mobile *" v={profileDraft.mobile} onChange={(x) => setProfileDraft((p) => ({ ...p, mobile: x }))} />
              <EditField k="Email" v={profileDraft.email} onChange={(x) => setProfileDraft((p) => ({ ...p, email: x }))} />
              <EditField k="Aadhaar" v={profileDraft.aadhaar_number} onChange={(x) => setProfileDraft((p) => ({ ...p, aadhaar_number: x }))} />
              <EditField k="DOB" type="date" v={profileDraft.date_of_birth} onChange={(x) => setProfileDraft((p) => ({ ...p, date_of_birth: x }))} />
              <EditSelect k="Gender" v={profileDraft.gender} options={["male", "female", "other"]} onChange={(x) => setProfileDraft((p) => ({ ...p, gender: x }))} />
              <EditField k="Blood Group" v={profileDraft.blood_group} onChange={(x) => setProfileDraft((p) => ({ ...p, blood_group: x }))} />
              <EditField k="Category" v={profileDraft.category} onChange={(x) => setProfileDraft((p) => ({ ...p, category: x }))} />
              <EditField k="Religion" v={profileDraft.religion} onChange={(x) => setProfileDraft((p) => ({ ...p, religion: x }))} />
              <EditTextarea k="Permanent Address *" v={profileDraft.permanent_address} onChange={(x) => setProfileDraft((p) => ({ ...p, permanent_address: x }))} />
              <EditTextarea k="Current Address" v={profileDraft.current_address} onChange={(x) => setProfileDraft((p) => ({ ...p, current_address: x }))} />
              <EditField k="Father Name *" v={profileDraft.father_name} onChange={(x) => setProfileDraft((p) => ({ ...p, father_name: x }))} />
              <EditField k="Father Mobile *" v={profileDraft.father_mobile} onChange={(x) => setProfileDraft((p) => ({ ...p, father_mobile: x }))} />
              <EditField k="Father Occupation" v={profileDraft.father_occupation} onChange={(x) => setProfileDraft((p) => ({ ...p, father_occupation: x }))} />
              <EditField k="Mother Name" v={profileDraft.mother_name} onChange={(x) => setProfileDraft((p) => ({ ...p, mother_name: x }))} />
              <EditField k="Mother Mobile" v={profileDraft.mother_mobile} onChange={(x) => setProfileDraft((p) => ({ ...p, mother_mobile: x }))} />
              <EditField k="Emergency Name" v={profileDraft.emergency_name} onChange={(x) => setProfileDraft((p) => ({ ...p, emergency_name: x }))} />
              <EditField k="Emergency Relation" v={profileDraft.emergency_relation} onChange={(x) => setProfileDraft((p) => ({ ...p, emergency_relation: x }))} />
              <EditField k="Emergency Mobile" v={profileDraft.emergency_mobile} onChange={(x) => setProfileDraft((p) => ({ ...p, emergency_mobile: x }))} />
              <EditField k="Previous School" v={profileDraft.previous_school} onChange={(x) => setProfileDraft((p) => ({ ...p, previous_school: x }))} />
              <EditField k="Previous Class" v={profileDraft.previous_class} onChange={(x) => setProfileDraft((p) => ({ ...p, previous_class: x }))} />
              <EditField k="Board" v={profileDraft.board} onChange={(x) => setProfileDraft((p) => ({ ...p, board: x }))} />
              <EditField k="Marks 10th" v={profileDraft.marks_10th} onChange={(x) => setProfileDraft((p) => ({ ...p, marks_10th: x }))} />
              <EditField k="Marks 12th" v={profileDraft.marks_12th} onChange={(x) => setProfileDraft((p) => ({ ...p, marks_12th: x }))} />
              <EditSelect k="Course Type" v={profileDraft.course_type} options={["long_term", "crash_course"]} onChange={(x) => setProfileDraft((p) => ({ ...p, course_type: x }))} />
              <EditSelect k="Course Stream" v={profileDraft.course_stream} options={["neet", "kcet"]} onChange={(x) => setProfileDraft((p) => ({ ...p, course_stream: x }))} />
              <EditSelect k="College Type" v={profileDraft.college_type} options={["state_board", "cbse_board"]} onChange={(x) => setProfileDraft((p) => ({ ...p, college_type: x }))} />
              <EditField k="PUC Hall Ticket No" v={profileDraft.puc_hall_ticket_no} onChange={(x) => setProfileDraft((p) => ({ ...p, puc_hall_ticket_no: x }))} />
              <EditField k="SSLC Register No" v={profileDraft.sslc_register_number} onChange={(x) => setProfileDraft((p) => ({ ...p, sslc_register_number: x }))} />
              <EditField k="PUC Total %" v={profileDraft.puc_total_percent} onChange={(x) => setProfileDraft((p) => ({ ...p, puc_total_percent: x }))} />
              <EditField k="PUC PCMB %" v={profileDraft.puc_pcmb_percent} onChange={(x) => setProfileDraft((p) => ({ ...p, puc_pcmb_percent: x }))} />
              <EditField k="NEET Marks Obtained" v={profileDraft.neet_marks_obtained} onChange={(x) => setProfileDraft((p) => ({ ...p, neet_marks_obtained: x }))} />
              <EditSelect k="Admission Type" v={profileDraft.admission_type} options={["residential", "non_residential"]} onChange={(x) => setProfileDraft((p) => ({ ...p, admission_type: x }))} />
              <EditSelect k="Sub Caste Group" v={profileDraft.sub_caste_group} options={["CA-I", "IIA", "IIB", "IIIA", "IIIB"]} onChange={(x) => setProfileDraft((p) => ({ ...p, sub_caste_group: x }))} />
              <EditSelect k="Van Facility" v={String(profileDraft.van_facility_required)} options={["true", "false"]} onChange={(x) => setProfileDraft((p) => ({ ...p, van_facility_required: x === "true" }))} />
              <EditField k="Present Address Pincode" v={profileDraft.present_address_pincode} onChange={(x) => setProfileDraft((p) => ({ ...p, present_address_pincode: x }))} />
              <EditField k="Permanent Address Pincode" v={profileDraft.permanent_address_pincode} onChange={(x) => setProfileDraft((p) => ({ ...p, permanent_address_pincode: x }))} />
              <EditField k="Mobile (Secondary)" v={profileDraft.mobile_secondary} onChange={(x) => setProfileDraft((p) => ({ ...p, mobile_secondary: x }))} />
              <EditField k="PAN Number" v={profileDraft.pan_number} onChange={(x) => setProfileDraft((p) => ({ ...p, pan_number: x }))} />
              <EditField k="Admission Place" v={profileDraft.admission_place} onChange={(x) => setProfileDraft((p) => ({ ...p, admission_place: x }))} />
              <EditField k="Family Annual Income (₹)" v={profileDraft.family_annual_income} onChange={(x) => setProfileDraft((p) => ({ ...p, family_annual_income: x }))} />
            </>
          ) : (
            <>
              <Info k="DOB" v={fmtDate(s.date_of_birth)} />
              <Info k="Gender" v={s.gender} />
              <Info k="Mobile" v={s.mobile} />
              <Info k="Email" v={s.email || "—"} />
              <Info k="Aadhaar" v={s.aadhaar_number || "—"} />
              <Info k="Class" v={s.class_year} />
              <Info k="Permanent Address" v={s.permanent_address} />
              <Info k="Current Address" v={s.current_address || "—"} />
              <Info k="Father" v={`${s.father_name} · ${s.father_mobile}`} />
              <Info k="Mother" v={s.mother_name ? `${s.mother_name} · ${s.mother_mobile || "—"}` : "—"} />
              <Info k="Emergency" v={s.emergency_name ? `${s.emergency_name} (${s.emergency_relation || "—"}) · ${s.emergency_mobile || "—"}` : "—"} />
              <Info k="Blood Group" v={(s as any).blood_group || "—"} />
              <Info k="Category / Religion" v={`${(s as any).category || "—"} · ${(s as any).religion || "—"}`} />
              <Info k="Previous School" v={s.previous_school || "—"} />
              <Info k="Previous Class" v={(s as any).previous_class || "—"} />
              <Info k="Admission Date" v={fmtDate(s.admission_date)} />
              <Info k="Academic Year" v={s.academic_year} />
              <Info k="Course Type" v={(s as any).course_type || "—"} />
              <Info k="Course Stream" v={((s as any).course_stream || "—").toString().toUpperCase()} />
              <Info k="College Type" v={(s as any).college_type || "—"} />
              <Info k="PUC Hall Ticket No" v={(s as any).puc_hall_ticket_no || "—"} />
              <Info k="SSLC Register No" v={(s as any).sslc_register_number || "—"} />
              <Info k="PUC Total %" v={(s as any).puc_total_percent ?? "—"} />
              <Info k="PUC PCMB %" v={(s as any).puc_pcmb_percent ?? "—"} />
              <Info k="NEET Marks Obtained" v={(s as any).neet_marks_obtained || "—"} />
              <Info k="Admission Type" v={(s as any).admission_type || "—"} />
              <Info k="Sub Caste Group" v={(s as any).sub_caste_group || "—"} />
              <Info k="Van Facility" v={(s as any).van_facility_required ? "Required" : "Not Required"} />
              <Info k="Present Address Pincode" v={(s as any).present_address_pincode || "—"} />
              <Info k="Permanent Address Pincode" v={(s as any).permanent_address_pincode || "—"} />
              <Info k="Mobile (Secondary)" v={(s as any).mobile_secondary || "—"} />
              <Info k="PAN Number" v={(s as any).pan_number || "—"} />
              <Info k="Admission Place" v={(s as any).admission_place || "—"} />
              <Info k="Family Annual Income" v={(s as any).family_annual_income ? inr((s as any).family_annual_income) : "—"} />
            </>
          )}
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
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Month</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Status</TableHead>{isAdmin && <TableHead></TableHead>}</TableRow></TableHeader>
            <TableBody>
              {installments.data?.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i.installment_no}</TableCell>
                  <TableCell className="text-sm">{i.month_label || "—"}</TableCell>
                  <TableCell className="text-sm">{fmtDate(i.due_date)}</TableCell>
                  <TableCell className="text-right">
                    {editInstId === i.id ? (
                      <Input type="number" className="ml-auto h-8 w-28 text-right" value={editAmt}
                        onChange={(e) => setEditAmt(Number(e.target.value))} />
                    ) : inr(i.amount)}
                  </TableCell>
                  <TableCell className="text-right">{inr(i.amount_paid)}</TableCell>
                  <TableCell><StatusBadge status={i.status} /></TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {editInstId === i.id ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={async () => {
                            if (editAmt < Number(i.amount_paid)) { toast.error("Amount cannot be less than already paid"); return; }
                            const { error } = await supabase.from("installments").update({ amount: editAmt }).eq("id", i.id);
                            if (error) { toast.error(error.message); return; }
                            await logAudit({ actorName: fullName, actorRole: role, action: "edit_installment", entityType: "installment", entityId: i.id, oldValue: { amount: i.amount }, newValue: { amount: editAmt } });
                            toast.success("Updated");
                            setEditInstId(null);
                            qc.invalidateQueries({ queryKey: ["student", studentId, "installments"] });
                          }}><Save className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditInstId(null)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : i.status !== "paid" ? (
                        <Button size="sm" variant="ghost" onClick={() => { setEditInstId(i.id); setEditAmt(Number(i.amount)); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(planUpgrades.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle><TrendingUp className="mr-2 inline h-4 w-4" /> Plan Upgrade History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>By</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
              <TableBody>
                {planUpgrades.data?.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-xs">{fmtDateTime(u.created_at)}</TableCell>
                    <TableCell className="text-sm">{PLAN_LABEL[u.from_plan as PlanKind] || u.from_plan}</TableCell>
                    <TableCell className="text-sm">{PLAN_LABEL[u.to_plan as PlanKind] || u.to_plan}</TableCell>
                    <TableCell className="text-sm">{u.performed_by_name}</TableCell>
                    <TableCell className="text-sm">{u.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(concessionCancels.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle><X className="mr-2 inline h-4 w-4" /> Concession Cancellation History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Original</TableHead><TableHead className="text-right">Cancelled</TableHead><TableHead className="text-right">New Net</TableHead><TableHead>By</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
              <TableBody>
                {concessionCancels.data?.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{fmtDateTime(c.created_at)}</TableCell>
                    <TableCell className="text-right text-sm">{inr(c.original_discount)}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{inr(c.cancelled_amount)}</TableCell>
                    <TableCell className="text-right text-sm">{inr(c.new_net_payable)}</TableCell>
                    <TableCell className="text-sm">{c.performed_by_name}</TableCell>
                    <TableCell className="text-sm">{c.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
          {fa && (
            <CancelConcessionDialog
              open={cancelConcessionOpen}
              onClose={() => setCancelConcessionOpen(false)}
              student={s}
              feeAssignment={fa}
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["student", studentId, "fee-assignment"] });
                qc.invalidateQueries({ queryKey: ["student", studentId, "installments"] });
                qc.invalidateQueries({ queryKey: ["student", studentId, "concession-cancels"] });
              }}
            />
          )}
          {fa && currentPlan && PLAN_NEXT[currentPlan] && (
            <UpgradePlanDialog
              open={upgradePlanOpen}
              onClose={() => setUpgradePlanOpen(false)}
              student={s}
              feeAssignment={fa}
              currentPlan={currentPlan}
              installments={installments.data || []}
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["student", studentId, "fee-assignment"] });
                qc.invalidateQueries({ queryKey: ["student", studentId, "installments"] });
                qc.invalidateQueries({ queryKey: ["student", studentId, "plan-upgrades"] });
              }}
            />
          )}
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

function EditField({ k, v, onChange, type = "text" }: { k: string; v: any; onChange: (x: string) => void; type?: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <Label className="mb-1 block text-xs text-muted-foreground">{k}</Label>
      <Input className="h-8" type={type} value={v ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function EditTextarea({ k, v, onChange }: { k: string; v: any; onChange: (x: string) => void }) {
  return (
    <div className="rounded-md border border-border p-2 md:col-span-2">
      <Label className="mb-1 block text-xs text-muted-foreground">{k}</Label>
      <Textarea rows={2} value={v ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function EditSelect({ k, v, options, onChange }: { k: string; v: any; options: string[]; onChange: (x: string) => void }) {
  return (
    <div className="rounded-md border border-border p-2">
      <Label className="mb-1 block text-xs text-muted-foreground">{k}</Label>
      <Select value={v || ""} onValueChange={onChange}>
        <SelectTrigger className="h-8"><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
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

function CancelConcessionDialog({ open, onClose, student, feeAssignment, onDone }: { open: boolean; onClose: () => void; student: any; feeAssignment: any; onDone: () => void }) {
  const { fullName, role, user } = useAuth();
  const original = Number(feeAssignment.discount_amount || 0);
  const [amount, setAmount] = useState(original);
  const [reason, setReason] = useState("Overdue payment");

  const submit = useMutation({
    mutationFn: async () => {
      const cancel = Math.min(Math.max(0, Number(amount)), original);
      const newDiscount = original - cancel;
      const newNet = Number(feeAssignment.gross_fee) - newDiscount;
      const { error: faErr } = await supabase.from("fee_assignments").update({
        discount_amount: newDiscount,
        net_payable: newNet,
        concession_cancelled_amount: Number(feeAssignment.concession_cancelled_amount || 0) + cancel,
      }).eq("id", feeAssignment.id);
      if (faErr) throw faErr;
      // Add the cancelled amount to the next unpaid instalment
      const { data: ins } = await supabase.from("installments").select("*").eq("fee_assignment_id", feeAssignment.id).order("installment_no");
      const nextUnpaid = (ins || []).find((i: any) => Number(i.amount) - Number(i.amount_paid) > 0);
      if (nextUnpaid) {
        await supabase.from("installments").update({ amount: Number(nextUnpaid.amount) + cancel }).eq("id", nextUnpaid.id);
      }
      const { error: ccErr } = await supabase.from("concession_cancellations").insert({
        student_id: student.id,
        fee_assignment_id: feeAssignment.id,
        original_discount: original,
        cancelled_amount: cancel,
        new_net_payable: newNet,
        reason: reason || null,
        performed_by: user?.id ?? null,
        performed_by_name: fullName,
      });
      if (ccErr) throw ccErr;
      await logAudit({ actorName: fullName, actorRole: role, action: "cancel_concession", entityType: "student", entityId: student.id, oldValue: { discount: original }, newValue: { discount: newDiscount, cancelled: cancel }, reason });
    },
    onSuccess: () => { toast.success("Concession cancelled"); onDone(); onClose(); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Concession</DialogTitle>
          <DialogDescription>Original concession {inr(original)}. Cancelled amount is added back to the next unpaid instalment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="mb-1 block text-xs">Amount to cancel (₹) *</Label><Input type="number" min={0} max={original} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <div><Label className="mb-1 block text-xs">Reason</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || amount <= 0}>{submit.isPending ? "Saving…" : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpgradePlanDialog({ open, onClose, student, feeAssignment, currentPlan, installments, onDone }: { open: boolean; onClose: () => void; student: any; feeAssignment: any; currentPlan: PlanKind; installments: any[]; onDone: () => void }) {
  const { fullName, role, user } = useAuth();
  const nextPlan = PLAN_NEXT[currentPlan]!;
  const [reason, setReason] = useState("Payment delay");

  const submit = useMutation({
    mutationFn: async () => {
      const newMonths = PLAN_MONTHS[nextPlan];
      const paidSum = installments.reduce((a, i) => a + Number(i.amount_paid), 0);
      const remaining = Number(feeAssignment.net_payable) - paidSum;
      const paidCount = installments.filter((i) => Number(i.amount_paid) >= Number(i.amount)).length;
      const newRemainingCount = newMonths.length - paidCount;
      if (newRemainingCount <= 0) throw new Error("Plan already covers all paid instalments");
      const splits = evenSplit(remaining, newRemainingCount);
      const year = new Date().getFullYear();
      const dueDay = 5;

      // Delete unpaid instalments
      const unpaidIds = installments.filter((i) => Number(i.amount_paid) < Number(i.amount)).map((i) => i.id);
      if (unpaidIds.length > 0) await supabase.from("installments").delete().in("id", unpaidIds);

      // Insert new instalments for the remaining months
      const newRows = newMonths.slice(paidCount).map((m, idx) => ({
        fee_assignment_id: feeAssignment.id,
        student_id: student.id,
        installment_no: paidCount + idx + 1,
        amount: splits[idx],
        due_date: new Date(year, m.month, dueDay).toISOString().slice(0, 10),
        month_label: m.label,
      }));
      const { error: insErr } = await supabase.from("installments").insert(newRows);
      if (insErr) throw insErr;

      const { error: faErr } = await supabase.from("fee_assignments").update({
        plan_kind: nextPlan, installment_count: newMonths.length,
      }).eq("id", feeAssignment.id);
      if (faErr) throw faErr;

      await supabase.from("plan_upgrades").insert({
        student_id: student.id, fee_assignment_id: feeAssignment.id,
        from_plan: currentPlan, to_plan: nextPlan,
        reason: reason || null,
        performed_by: user?.id ?? null, performed_by_name: fullName,
      });
      await logAudit({ actorName: fullName, actorRole: role, action: "upgrade_plan", entityType: "student", entityId: student.id, oldValue: { plan: currentPlan }, newValue: { plan: nextPlan }, reason });
    },
    onSuccess: () => { toast.success(`Upgraded to ${PLAN_LABEL[nextPlan]}`); onDone(); onClose(); },
    onError: (e: any) => toast.error(e?.message || "Upgrade failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade Instalment Plan</DialogTitle>
          <DialogDescription>From {PLAN_LABEL[currentPlan]} to {PLAN_LABEL[nextPlan]}. Unpaid instalments are rebalanced across the new months.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="mb-1 block text-xs">Reason</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? "Upgrading…" : "Confirm upgrade"}</Button>
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