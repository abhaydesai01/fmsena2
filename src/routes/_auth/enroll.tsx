import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, ChevronLeft, ChevronRight, ShieldAlert, Check } from "lucide-react";
import { inr, discountLabel } from "@/lib/format";
import { calculateNetPayable, splitInstallments, defaultDueDates, type DiscountType } from "@/lib/installments";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth";
import { useCampus } from "@/lib/campus";
import type { Database } from "@/integrations/supabase/types";

type Course = Database["public"]["Tables"]["courses"]["Row"];
type Batch = Database["public"]["Tables"]["batches"]["Row"];

export const Route = createFileRoute("/_auth/enroll")({ component: Page });

function Page() {
  const { isAdmin, fullName, role } = useAuth();
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Enrol Student" description="Two-step enrollment: profile and fee assignment." />
        <EmptyState icon={ShieldAlert} title="Admin access required" description="Only administrators can enroll new students." />
      </div>
    );
  }
  return <EnrollFlow actorName={fullName} actorRole={role} />;
}

type Step = 1 | 2 | 3;

function EnrollFlow({ actorName, actorRole }: { actorName: string; actorRole: "admin" | "cashier" | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { campusId, campus } = useCampus();
  const [step, setStep] = useState<Step>(1);

  // Step 1 — Student profile
  const [profile, setProfile] = useState({
    full_name: "", date_of_birth: "", gender: "male" as "male" | "female" | "other",
    mobile: "", email: "", aadhaar_number: "", permanent_address: "",
    class_year: "12th" as "11th" | "12th" | "dropper",
    father_name: "", father_mobile: "",
    mother_name: "", mother_mobile: "",
    course_id: "", batch_id: "",
    hostel_required: false, transport_required: false,
    medium: "English",
    // Extended offline-form fields
    blood_group: "", category: "", religion: "", sub_caste: "",
    mother_tongue: "", languages_known: "", place_of_birth: "",
    sibling_info: "",
    emergency_name: "", emergency_relation: "", emergency_mobile: "",
    previous_school: "", board: "", marks_10th: "", marks_12th: "",
  });

  // Step 1.5 — Document uploads (queued, uploaded after student is created)
  const [docs, setDocs] = useState<{ label: string; file: File }[]>([]);

  // Step 2 — Fee assignment
  const [fee, setFee] = useState({
    discount_type: "round_off" as DiscountType,
    rounded_amount: 0,
    special_amount: 0,
    discount_reason: "",
    transport_fee_monthly: 0,
    hostel_fee_monthly: 0,
  });

  const courses = useQuery({
    queryKey: ["enroll", "courses", campusId],
    enabled: !!campusId,
    queryFn: async () => {
      let q = supabase.from("courses").select("*").eq("is_active", true).order("name");
      if (campusId) q = q.eq("campus_id", campusId);
      const { data } = await q;
      return (data || []) as Course[];
    },
  });
  const batches = useQuery({
    queryKey: ["enroll", "batches", profile.course_id, campusId],
    enabled: !!profile.course_id && !!campusId,
    queryFn: async () => {
      let q = supabase.from("batches").select("*")
        .eq("course_id", profile.course_id).neq("status", "closed").order("name");
      if (campusId) q = q.eq("campus_id", campusId);
      const { data } = await q;
      return (data || []) as Batch[];
    },
  });

  const selectedCourse = courses.data?.find((c) => c.id === profile.course_id);
  const grossFee = Number(selectedCourse?.gross_fee || 0);

  const calc = useMemo(() => {
    if (!grossFee) return { netPayable: 0, discountAmount: 0, installmentCount: 3 as 3 | 4 };
    return calculateNetPayable({
      grossFee,
      discountType: fee.discount_type,
      roundedAmount: fee.discount_type === "round_off" ? (fee.rounded_amount || grossFee) : undefined,
      specialAmount: fee.discount_type === "special" ? fee.special_amount : undefined,
    });
  }, [grossFee, fee]);

  const installments = useMemo(() => {
    if (!calc.netPayable) return [];
    const amounts = splitInstallments(calc.netPayable, calc.installmentCount);
    const dates = defaultDueDates(new Date(), calc.installmentCount);
    return amounts.map((amt, i) => ({ no: i + 1, amount: amt, due: dates[i] }));
  }, [calc]);

  const create = useMutation({
    mutationFn: async () => {
      if (!campusId) throw new Error("Select a campus first");
      // 1) admission number
      const { data: admNo, error: admErr } = await supabase.rpc("next_admission_number", { _year: "2025-26" });
      if (admErr) throw admErr;

      // 2) insert student
      const { data: student, error: stErr } = await supabase.from("students").insert({
        admission_number: admNo as string,
        full_name: profile.full_name,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        mobile: profile.mobile,
        email: profile.email || null,
        aadhaar_number: profile.aadhaar_number || null,
        permanent_address: profile.permanent_address,
        class_year: profile.class_year,
        father_name: profile.father_name,
        father_mobile: profile.father_mobile,
        mother_name: profile.mother_name || null,
        mother_mobile: profile.mother_mobile || null,
        course_id: profile.course_id,
        batch_id: profile.batch_id,
        campus_id: campusId,
        hostel_required: profile.hostel_required,
        transport_required: profile.transport_required,
        medium: profile.medium,
        blood_group: profile.blood_group || null,
        category: profile.category || null,
        religion: profile.religion || null,
        sub_caste: profile.sub_caste || null,
        mother_tongue: profile.mother_tongue || null,
        languages_known: profile.languages_known || null,
        place_of_birth: profile.place_of_birth || null,
        sibling_info: profile.sibling_info || null,
        emergency_name: profile.emergency_name || null,
        emergency_relation: profile.emergency_relation || null,
        emergency_mobile: profile.emergency_mobile || null,
        previous_school: profile.previous_school || null,
        board: profile.board || null,
        marks_10th: profile.marks_10th || null,
        marks_12th: profile.marks_12th || null,
      }).select("*").single();
      if (stErr) throw stErr;

      // 3) fee assignment
      const { data: fa, error: faErr } = await supabase.from("fee_assignments").insert({
        student_id: student.id,
        course_id: profile.course_id,
        gross_fee: grossFee,
        discount_type: fee.discount_type,
        discount_amount: calc.discountAmount,
        discount_reason: fee.discount_reason || null,
        net_payable: calc.netPayable,
        installment_count: calc.installmentCount,
        registration_fee: Number(selectedCourse?.registration_fee || 0),
        material_fee: Number(selectedCourse?.material_fee || 0),
        transport_fee_monthly: profile.transport_required ? Number(fee.transport_fee_monthly) : 0,
        hostel_fee_monthly: profile.hostel_required ? Number(fee.hostel_fee_monthly) : 0,
        confirmed: true,
      }).select("*").single();
      if (faErr) throw faErr;

      // 4) installments
      const rows = installments.map((i) => ({
        fee_assignment_id: fa.id,
        student_id: student.id,
        installment_no: i.no,
        amount: i.amount,
        due_date: i.due.toISOString().slice(0, 10),
      }));
      const { error: insErr } = await supabase.from("installments").insert(rows);
      if (insErr) throw insErr;

      // 5) upload queued documents (optional)
      if (docs.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        for (const d of docs) {
          const ext = d.file.name.split(".").pop() || "bin";
          const path = `${student.id}/${Date.now()}_${d.label.replace(/\W+/g, "_")}.${ext}`;
          const up = await supabase.storage.from("student-files").upload(path, d.file, {
            contentType: d.file.type || undefined, upsert: false,
          });
          if (up.error) {
            console.warn("Upload failed for", d.label, up.error.message);
            continue;
          }
          const { data: pub } = supabase.storage.from("student-files").getPublicUrl(path);
          await supabase.from("student_documents").insert({
            student_id: student.id,
            label: d.label,
            file_url: pub.publicUrl,
            mime_type: d.file.type || null,
            size_bytes: d.file.size,
            uploaded_by: user?.id ?? null,
            uploaded_by_name: actorName,
          });
        }
      }

      await logAudit({
        actorName, actorRole,
        action: "enroll_student", entityType: "student", entityId: student.id,
        newValue: { admission_number: admNo, net_payable: calc.netPayable, installments: rows.length, campus_id: campusId, docs: docs.length },
      });
      return student;
    },
    onSuccess: (s) => {
      toast.success(`Enrolled ${s.full_name} · ${s.admission_number}`);
      qc.invalidateQueries({ queryKey: ["students"] });
      navigate({ to: "/students" });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to enroll"),
  });

  const canStep2 =
    profile.full_name && profile.date_of_birth && profile.mobile && profile.permanent_address &&
    profile.father_name && profile.father_mobile && profile.course_id && profile.batch_id;
  const canStep3 = grossFee > 0 && calc.netPayable > 0;

  return (
    <div>
      <PageHeader
        title="Enrol Student"
        description={`Profile → Fee plan → Review. Campus: ${campus?.name || "—"}`}
      />

      <Stepper step={step} />

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>1 · Student Profile</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Full Name *">
              <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </Field>
            <Field label="Date of Birth *">
              <Input type="date" value={profile.date_of_birth} onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })} />
            </Field>
            <Field label="Gender *">
              <Select value={profile.gender} onValueChange={(v: any) => setProfile({ ...profile, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Class Year *">
              <Select value={profile.class_year} onValueChange={(v: any) => setProfile({ ...profile, class_year: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="11th">11th</SelectItem>
                  <SelectItem value="12th">12th</SelectItem>
                  <SelectItem value="dropper">Dropper</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mobile *">
              <Input value={profile.mobile} onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </Field>
            <Field label="Aadhaar Number">
              <Input value={profile.aadhaar_number} onChange={(e) => setProfile({ ...profile, aadhaar_number: e.target.value })} />
            </Field>
            <Field label="Medium">
              <Input value={profile.medium} onChange={(e) => setProfile({ ...profile, medium: e.target.value })} />
            </Field>
            <Field label="Permanent Address *" className="md:col-span-2">
              <Textarea rows={2} value={profile.permanent_address} onChange={(e) => setProfile({ ...profile, permanent_address: e.target.value })} />
            </Field>

            <Field label="Father's Name *">
              <Input value={profile.father_name} onChange={(e) => setProfile({ ...profile, father_name: e.target.value })} />
            </Field>
            <Field label="Father's Mobile *">
              <Input value={profile.father_mobile} onChange={(e) => setProfile({ ...profile, father_mobile: e.target.value })} />
            </Field>
            <Field label="Mother's Name">
              <Input value={profile.mother_name} onChange={(e) => setProfile({ ...profile, mother_name: e.target.value })} />
            </Field>
            <Field label="Mother's Mobile">
              <Input value={profile.mother_mobile} onChange={(e) => setProfile({ ...profile, mother_mobile: e.target.value })} />
            </Field>

            <Field label="Course *">
              <Select value={profile.course_id} onValueChange={(v) => setProfile({ ...profile, course_id: v, batch_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} · {inr(c.gross_fee)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Batch *">
              <Select value={profile.batch_id} onValueChange={(v) => setProfile({ ...profile, batch_id: v })} disabled={!profile.course_id}>
                <SelectTrigger><SelectValue placeholder={profile.course_id ? "Select batch" : "Pick course first"} /></SelectTrigger>
                <SelectContent>
                  {batches.data?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} {b.timing ? `· ${b.timing}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-center justify-between rounded-md border border-border p-3 md:col-span-1">
              <div>
                <Label>Hostel required</Label>
                <p className="text-xs text-muted-foreground">Adds monthly hostel fee.</p>
              </div>
              <Switch checked={profile.hostel_required} onCheckedChange={(v) => setProfile({ ...profile, hostel_required: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3 md:col-span-1">
              <div>
                <Label>Transport required</Label>
                <p className="text-xs text-muted-foreground">Adds monthly transport fee.</p>
              </div>
              <Switch checked={profile.transport_required} onCheckedChange={(v) => setProfile({ ...profile, transport_required: v })} />
            </div>

            {/* Additional offline-form fields */}
            <div className="md:col-span-2 mt-2 border-t border-border pt-3 text-sm font-semibold">
              Personal details (optional)
            </div>
            <Field label="Blood Group">
              <Input value={profile.blood_group} onChange={(e) => setProfile({ ...profile, blood_group: e.target.value })} placeholder="e.g. B+" />
            </Field>
            <Field label="Category">
              <Input value={profile.category} onChange={(e) => setProfile({ ...profile, category: e.target.value })} placeholder="General / OBC / SC / ST" />
            </Field>
            <Field label="Religion">
              <Input value={profile.religion} onChange={(e) => setProfile({ ...profile, religion: e.target.value })} />
            </Field>
            <Field label="Sub-caste">
              <Input value={profile.sub_caste} onChange={(e) => setProfile({ ...profile, sub_caste: e.target.value })} />
            </Field>
            <Field label="Mother Tongue">
              <Input value={profile.mother_tongue} onChange={(e) => setProfile({ ...profile, mother_tongue: e.target.value })} />
            </Field>
            <Field label="Languages Known">
              <Input value={profile.languages_known} onChange={(e) => setProfile({ ...profile, languages_known: e.target.value })} placeholder="e.g. English, Hindi, Kannada" />
            </Field>
            <Field label="Place of Birth">
              <Input value={profile.place_of_birth} onChange={(e) => setProfile({ ...profile, place_of_birth: e.target.value })} />
            </Field>
            <Field label="Sibling Info">
              <Input value={profile.sibling_info} onChange={(e) => setProfile({ ...profile, sibling_info: e.target.value })} placeholder="e.g. 1 brother, 1 sister" />
            </Field>

            <div className="md:col-span-2 mt-2 border-t border-border pt-3 text-sm font-semibold">
              Emergency contact (optional)
            </div>
            <Field label="Contact Name">
              <Input value={profile.emergency_name} onChange={(e) => setProfile({ ...profile, emergency_name: e.target.value })} />
            </Field>
            <Field label="Relation">
              <Input value={profile.emergency_relation} onChange={(e) => setProfile({ ...profile, emergency_relation: e.target.value })} />
            </Field>
            <Field label="Contact Mobile">
              <Input value={profile.emergency_mobile} onChange={(e) => setProfile({ ...profile, emergency_mobile: e.target.value })} />
            </Field>

            <div className="md:col-span-2 mt-2 border-t border-border pt-3 text-sm font-semibold">
              Academic background (optional)
            </div>
            <Field label="Previous School">
              <Input value={profile.previous_school} onChange={(e) => setProfile({ ...profile, previous_school: e.target.value })} />
            </Field>
            <Field label="Board">
              <Input value={profile.board} onChange={(e) => setProfile({ ...profile, board: e.target.value })} placeholder="CBSE / ICSE / State" />
            </Field>
            <Field label="10th Marks / %">
              <Input value={profile.marks_10th} onChange={(e) => setProfile({ ...profile, marks_10th: e.target.value })} />
            </Field>
            <Field label="12th Marks / %">
              <Input value={profile.marks_12th} onChange={(e) => setProfile({ ...profile, marks_12th: e.target.value })} />
            </Field>

            <div className="md:col-span-2 mt-2 border-t border-border pt-3 text-sm font-semibold">
              Documents (optional — can also be uploaded later)
            </div>
            <div className="md:col-span-2">
              <DocumentsUploader docs={docs} setDocs={setDocs} />
            </div>

            <div className="flex justify-end md:col-span-2">
              <Button disabled={!canStep2} onClick={() => setStep(2)}>
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>2 · Fee Plan</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md bg-muted/50 p-4 md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Course Gross Fee</div>
              <div className="text-2xl font-bold">{inr(grossFee)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{selectedCourse?.name} · {selectedCourse?.duration_months} months</div>
            </div>

            <Field label="Discount Type">
              <Select value={fee.discount_type} onValueChange={(v: DiscountType) => setFee({ ...fee, discount_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_off">Round-Off (3 inst.)</SelectItem>
                  <SelectItem value="slab_10">Slab 10% (3 inst.)</SelectItem>
                  <SelectItem value="slab_15">Slab 15% (3 inst.)</SelectItem>
                  <SelectItem value="slab_20">Slab 20% (3 inst.)</SelectItem>
                  <SelectItem value="special">Special (4 inst.)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {fee.discount_type === "round_off" && (
              <Field label="Rounded Net Payable">
                <Input type="number" value={fee.rounded_amount || grossFee} onChange={(e) => setFee({ ...fee, rounded_amount: Number(e.target.value) })} />
              </Field>
            )}
            {fee.discount_type === "special" && (
              <Field label="Special Discount Amount">
                <Input type="number" value={fee.special_amount} onChange={(e) => setFee({ ...fee, special_amount: Number(e.target.value) })} />
              </Field>
            )}

            <Field label="Discount Reason" className="md:col-span-2">
              <Input value={fee.discount_reason} onChange={(e) => setFee({ ...fee, discount_reason: e.target.value })} placeholder="Sibling, scholarship, board topper…" />
            </Field>

            {profile.transport_required && (
              <Field label="Transport Fee (monthly)">
                <Input type="number" value={fee.transport_fee_monthly} onChange={(e) => setFee({ ...fee, transport_fee_monthly: Number(e.target.value) })} />
              </Field>
            )}
            {profile.hostel_required && (
              <Field label="Hostel Fee (monthly)">
                <Input type="number" value={fee.hostel_fee_monthly} onChange={(e) => setFee({ ...fee, hostel_fee_monthly: Number(e.target.value) })} />
              </Field>
            )}

            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <Stat label="Discount" value={inr(calc.discountAmount)} />
              <Stat label="Net Payable" value={inr(calc.netPayable)} accent />
              <Stat label="Installments" value={String(calc.installmentCount)} />
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 text-sm font-semibold">Installment Schedule</div>
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Due Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {installments.map((i) => (
                    <TableRow key={i.no}>
                      <TableCell>{i.no}</TableCell>
                      <TableCell>{i.due.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                      <TableCell className="text-right font-semibold">{inr(i.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between md:col-span-2">
              <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" /> Back</Button>
              <Button disabled={!canStep3} onClick={() => setStep(3)}>Review <ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>3 · Review & Confirm</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Section title="Student">
              <Row k="Name" v={profile.full_name} />
              <Row k="DOB / Gender" v={`${profile.date_of_birth} · ${profile.gender}`} />
              <Row k="Mobile" v={profile.mobile} />
              <Row k="Class Year" v={profile.class_year} />
              <Row k="Course / Batch" v={`${selectedCourse?.name} · ${batches.data?.find((b) => b.id === profile.batch_id)?.name}`} />
            </Section>
            <Section title="Fees">
              <Row k="Gross" v={inr(grossFee)} />
              <Row k="Discount" v={`${discountLabel(fee.discount_type)} · ${inr(calc.discountAmount)}`} />
              <Row k="Net Payable" v={inr(calc.netPayable)} />
              <Row k="Installments" v={String(calc.installmentCount)} />
            </Section>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Enrolling…" : <><Check className="h-4 w-4" /> Confirm enrollment</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Profile", "Fee Plan", "Review"];
  return (
    <div className="mb-6 flex items-center gap-3">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
              done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{done ? "✓" : n}</div>
            <span className={active ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{label}</span>
            {i < 2 && <div className="h-px w-8 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border border-border p-3 ${accent ? "bg-primary/5" : ""}`}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <dl className="grid gap-1 text-sm">{children}</dl>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

const DEFAULT_DOC_LABELS = [
  "Photo",
  "Aadhaar",
  "10th Marksheet",
  "12th Marksheet",
  "TC (Transfer Certificate)",
  "Caste Certificate",
  "Income Certificate",
  "Migration Certificate",
];

function DocumentsUploader({
  docs,
  setDocs,
}: {
  docs: { label: string; file: File }[];
  setDocs: (d: { label: string; file: File }[]) => void;
}) {
  const [label, setLabel] = useState(DEFAULT_DOC_LABELS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const add = () => {
    if (!file) return;
    const finalLabel = label === "__other__" ? customLabel.trim() : label;
    if (!finalLabel) return;
    setDocs([...docs, { label: finalLabel, file }]);
    setFile(null);
    setCustomLabel("");
  };

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="grid gap-2 md:grid-cols-[200px_1fr_auto]">
        <select
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {DEFAULT_DOC_LABELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
          <option value="__other__">Other…</option>
        </select>
        {label === "__other__" ? (
          <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Document name" />
        ) : (
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        )}
        {label === "__other__" && (
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="md:col-span-2" />
        )}
        <Button type="button" size="sm" onClick={add} disabled={!file}>Add</Button>
      </div>
      {docs.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
              <span><span className="font-medium">{d.label}</span> · <span className="text-xs text-muted-foreground">{d.file.name} ({Math.round(d.file.size / 1024)} KB)</span></span>
              <button type="button" className="text-xs text-destructive underline" onClick={() => setDocs(docs.filter((_, ix) => ix !== i))}>remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No documents queued. Files are uploaded after the student is created.</p>
      )}
    </div>
  );
}
