import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCoursesFn } from "@/fns/courses";
import { getBatchesFn, createBatchFn } from "@/fns/courses";
import { nextAdmissionNumberFn, createEnrollmentFn } from "@/fns/students";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import { UserPlus, ChevronLeft, ChevronRight, ShieldAlert, Check } from "lucide-react";
import { inr } from "@/lib/format";
import {
  PLAN_LABEL,
  evenSplit,
  buildInstallmentSchedule,
  type PlanKind,
  type LateJoinerMode,
} from "@/lib/installments";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth";
import { useCampus } from "@/lib/campus";
import type { AppRole } from "@/lib/permissions";

export const Route = createFileRoute("/_auth/enroll")({ component: Page });

function Page() {
  const { hasPermission, fullName, role } = useAuth();
  if (!hasPermission("canEnrollStudents")) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Enrol Student"
          description="Two-step enrollment: profile and fee assignment."
        />
        <EmptyState
          icon={ShieldAlert}
          title="Access denied"
          description="You do not have permission to enroll students."
        />
      </div>
    );
  }
  return <EnrollFlow actorName={fullName} actorRole={role} />;
}

type Step = 1 | 2 | 3;

function EnrollFlow({ actorName, actorRole }: { actorName: string; actorRole: AppRole | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { campusId, campus } = useCampus();
  const [step, setStep] = useState<Step>(1);

  const [profile, setProfile] = useState({
    full_name: "",
    date_of_birth: "",
    gender: "male" as "male" | "female" | "other",
    mobile: "",
    email: "",
    aadhaar_number: "",
    permanent_address: "",
    class_year: "12th" as "11th" | "12th" | "dropper",
    father_name: "",
    father_mobile: "",
    mother_name: "",
    mother_mobile: "",
    course_id: "",
    batch_id: "",
    hostel_required: false,
    transport_required: false,
    medium: "English",
    blood_group: "",
    category: "",
    religion: "",
    sub_caste: "",
    mother_tongue: "",
    languages_known: "",
    place_of_birth: "",
    sibling_info: "",
    emergency_name: "",
    emergency_relation: "",
    emergency_mobile: "",
    previous_school: "",
    board: "",
    marks_10th: "",
    marks_12th: "",
    admission_date: new Date().toISOString().slice(0, 10),
  });

  const [fee, setFee] = useState({
    plan: "plan_3" as PlanKind,
    concession_amount: 0,
    concession_reason: "",
    transport_fee_monthly: 0,
    hostel_fee_monthly: 0,
    due_day: 5,
    plan_year: new Date().getFullYear(),
    late_joiner_mode: "start_from_admission_month" as LateJoinerMode,
  });
  const [instAmounts, setInstAmounts] = useState<number[]>([]);

  const courses = useQuery({
    queryKey: ["enroll", "courses", campusId],
    enabled: !!campusId,
    queryFn: () => getCoursesFn({ data: { campusId: campusId ?? undefined, activeOnly: true } }),
  });
  const batches = useQuery({
    queryKey: ["enroll", "batches", profile.course_id, campusId],
    enabled: !!profile.course_id && !!campusId,
    queryFn: () =>
      getBatchesFn({
        data: { courseId: profile.course_id, campusId: campusId ?? undefined, excludeClosed: true },
      }),
  });

  const selectedCourse = (courses.data as any[])?.find((c) => c.id === profile.course_id);
  const grossFee = Number(selectedCourse?.gross_fee || 0);
  const netPayable = Math.max(0, grossFee - Number(fee.concession_amount || 0));
  const scheduleData = useMemo(
    () =>
      buildInstallmentSchedule({
        plan: fee.plan,
        planYear: fee.plan_year,
        dueDay: fee.due_day,
        admissionDate: profile.admission_date,
        mode: fee.late_joiner_mode,
      }),
    [fee.plan, fee.plan_year, fee.due_day, profile.admission_date, fee.late_joiner_mode],
  );
  const schedule = scheduleData.schedule;
  const missedCount = scheduleData.missedCount;
  const lateJoinerModeLabel =
    fee.late_joiner_mode === "remaining_only"
      ? "Remaining due months only"
      : fee.late_joiner_mode === "start_from_admission_month"
        ? "Start from admission month"
        : fee.late_joiner_mode === "catchup_now"
          ? "Catch-up now + remaining months"
          : "Original full plan";

  useEffect(() => {
    setInstAmounts(evenSplit(netPayable, schedule.length));
  }, [netPayable, schedule.length]);

  const sumInst = instAmounts.reduce((a, b) => a + Number(b || 0), 0);
  const amountMismatch = Math.abs(sumInst - netPayable) > 0.5;

  const create = useMutation({
    mutationFn: async () => {
      if (!campusId) throw new Error("Select a campus first");
      const admNo = await nextAdmissionNumberFn({ data: { year: "2025-26" } });
      const installments = schedule.map((s, i) => ({
        installment_no: s.installment_no || i + 1,
        amount: Number(instAmounts[i] || 0),
        due_date: s.due_date,
        month_label: s.month_label,
      }));
      const result = await createEnrollmentFn({
        data: {
          student: {
            ...profile,
            campus_id: campusId,
            admission_number: admNo,
            academic_year: "2025-26",
            admission_date: profile.admission_date,
          },
          feeAssignment: {
            course_id: profile.course_id,
            gross_fee: grossFee,
            discount_amount: Number(fee.concession_amount || 0),
            discount_reason: fee.concession_reason || null,
            net_payable: netPayable,
            plan_kind: fee.plan,
            registration_fee: Number(selectedCourse?.registration_fee || 0),
            material_fee: Number(selectedCourse?.material_fee || 0),
            transport_fee_monthly: profile.transport_required
              ? Number(fee.transport_fee_monthly)
              : 0,
            hostel_fee_monthly: profile.hostel_required ? Number(fee.hostel_fee_monthly) : 0,
          },
          installments,
        },
      });
      await logAudit({
        actorName: actorName || "—",
        actorRole,
        action: "enroll_student",
        entityType: "student",
        entityId: result.studentId,
        newValue: {
          admission_number: admNo,
          net_payable: netPayable,
          plan: fee.plan,
          installments: installments.length,
          campus_id: campusId,
        },
      });
      return { studentId: result.studentId, full_name: profile.full_name, admission_number: admNo };
    },
    onSuccess: (s) => {
      toast.success(`Enrolled ${s.full_name} · ${s.admission_number}`);
      qc.invalidateQueries({ queryKey: ["students"] });
      navigate({ to: "/students" });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to enroll"),
  });

  const canStep2 =
    profile.full_name &&
    profile.date_of_birth &&
    profile.mobile &&
    profile.permanent_address &&
    profile.father_name &&
    profile.father_mobile &&
    profile.admission_date &&
    profile.course_id &&
    profile.batch_id;
  const canStep3 = grossFee > 0 && netPayable > 0 && !amountMismatch;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Enrol Student"
        description={`Profile → Fee plan → Review. Campus: ${campus?.name || "—"}`}
      />
      <Stepper step={step} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1 · Student Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Full Name *">
              <Input
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />
            </Field>
            <Field label="Date of Birth *">
              <Input
                type="date"
                value={profile.date_of_birth}
                onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
              />
            </Field>
            <Field label="Gender *">
              <Select
                value={profile.gender}
                onValueChange={(v: any) => setProfile({ ...profile, gender: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Class Year *">
              <Select
                value={profile.class_year}
                onValueChange={(v: any) => setProfile({ ...profile, class_year: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="11th">11th</SelectItem>
                  <SelectItem value="12th">12th</SelectItem>
                  <SelectItem value="dropper">Dropper</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Admission Date *">
              <Input
                type="date"
                value={profile.admission_date}
                onChange={(e) => setProfile({ ...profile, admission_date: e.target.value })}
              />
            </Field>
            <Field label="Mobile *">
              <Input
                value={profile.mobile}
                onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </Field>
            <Field label="Aadhaar Number">
              <Input
                value={profile.aadhaar_number}
                onChange={(e) => setProfile({ ...profile, aadhaar_number: e.target.value })}
              />
            </Field>
            <Field label="Medium">
              <Input
                value={profile.medium}
                onChange={(e) => setProfile({ ...profile, medium: e.target.value })}
              />
            </Field>
            <Field label="Permanent Address *" className="md:col-span-2">
              <Textarea
                rows={2}
                value={profile.permanent_address}
                onChange={(e) => setProfile({ ...profile, permanent_address: e.target.value })}
              />
            </Field>
            <Field label="Father's Name *">
              <Input
                value={profile.father_name}
                onChange={(e) => setProfile({ ...profile, father_name: e.target.value })}
              />
            </Field>
            <Field label="Father's Mobile *">
              <Input
                value={profile.father_mobile}
                onChange={(e) => setProfile({ ...profile, father_mobile: e.target.value })}
              />
            </Field>
            <Field label="Mother's Name">
              <Input
                value={profile.mother_name}
                onChange={(e) => setProfile({ ...profile, mother_name: e.target.value })}
              />
            </Field>
            <Field label="Mother's Mobile">
              <Input
                value={profile.mother_mobile}
                onChange={(e) => setProfile({ ...profile, mother_mobile: e.target.value })}
              />
            </Field>
            <Field label="Course *">
              <Select
                value={profile.course_id}
                onValueChange={(v) => setProfile({ ...profile, course_id: v, batch_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {((courses.data as any[]) || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {inr(c.gross_fee)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Batch *">
              <div className="flex gap-2">
                <Select
                  value={profile.batch_id}
                  onValueChange={(v) => setProfile({ ...profile, batch_id: v })}
                  disabled={!profile.course_id || ((batches.data as any[])?.length ?? 0) === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !profile.course_id
                          ? "Pick course first"
                          : ((batches.data as any[])?.length ?? 0) === 0
                            ? "No batches — create one"
                            : "Select batch"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {((batches.data as any[]) || []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.timing ? `· ${b.timing}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {profile.course_id && ((batches.data as any[])?.length ?? 0) === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      if (!campusId) return;
                      try {
                        const b = await createBatchFn({
                          data: {
                            course_id: profile.course_id,
                            campus_id: campusId,
                            name: "Default Batch",
                            timing: "",
                            capacity: 50,
                            status: "active",
                            academic_year: "2025-26",
                            start_date: null,
                          },
                        });
                        await qc.invalidateQueries({
                          queryKey: ["enroll", "batches", profile.course_id, campusId],
                        });
                        setProfile((p) => ({ ...p, batch_id: b.id }));
                        toast.success("Default batch created");
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    + Create
                  </Button>
                )}
              </div>
            </Field>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label>Hostel required</Label>
                <p className="text-xs text-muted-foreground">Adds monthly hostel fee.</p>
              </div>
              <Switch
                checked={profile.hostel_required}
                onCheckedChange={(v) => setProfile({ ...profile, hostel_required: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label>Transport required</Label>
                <p className="text-xs text-muted-foreground">Adds monthly transport fee.</p>
              </div>
              <Switch
                checked={profile.transport_required}
                onCheckedChange={(v) => setProfile({ ...profile, transport_required: v })}
              />
            </div>
            <div className="md:col-span-2 mt-2 border-t pt-3 text-sm font-semibold">
              Personal details (optional)
            </div>
            <Field label="Blood Group">
              <Input
                value={profile.blood_group}
                onChange={(e) => setProfile({ ...profile, blood_group: e.target.value })}
                placeholder="e.g. B+"
              />
            </Field>
            <Field label="Category">
              <Input
                value={profile.category}
                onChange={(e) => setProfile({ ...profile, category: e.target.value })}
                placeholder="General / OBC / SC / ST"
              />
            </Field>
            <Field label="Religion">
              <Input
                value={profile.religion}
                onChange={(e) => setProfile({ ...profile, religion: e.target.value })}
              />
            </Field>
            <Field label="Sub-caste">
              <Input
                value={profile.sub_caste}
                onChange={(e) => setProfile({ ...profile, sub_caste: e.target.value })}
              />
            </Field>
            <Field label="Mother Tongue">
              <Input
                value={profile.mother_tongue}
                onChange={(e) => setProfile({ ...profile, mother_tongue: e.target.value })}
              />
            </Field>
            <Field label="Languages Known">
              <Input
                value={profile.languages_known}
                onChange={(e) => setProfile({ ...profile, languages_known: e.target.value })}
              />
            </Field>
            <Field label="Place of Birth">
              <Input
                value={profile.place_of_birth}
                onChange={(e) => setProfile({ ...profile, place_of_birth: e.target.value })}
              />
            </Field>
            <Field label="Sibling Info">
              <Input
                value={profile.sibling_info}
                onChange={(e) => setProfile({ ...profile, sibling_info: e.target.value })}
              />
            </Field>
            <div className="md:col-span-2 mt-2 border-t pt-3 text-sm font-semibold">
              Emergency contact (optional)
            </div>
            <Field label="Contact Name">
              <Input
                value={profile.emergency_name}
                onChange={(e) => setProfile({ ...profile, emergency_name: e.target.value })}
              />
            </Field>
            <Field label="Relation">
              <Input
                value={profile.emergency_relation}
                onChange={(e) => setProfile({ ...profile, emergency_relation: e.target.value })}
              />
            </Field>
            <Field label="Contact Mobile">
              <Input
                value={profile.emergency_mobile}
                onChange={(e) => setProfile({ ...profile, emergency_mobile: e.target.value })}
              />
            </Field>
            <div className="md:col-span-2 mt-2 border-t pt-3 text-sm font-semibold">
              Academic background (optional)
            </div>
            <Field label="Previous School">
              <Input
                value={profile.previous_school}
                onChange={(e) => setProfile({ ...profile, previous_school: e.target.value })}
              />
            </Field>
            <Field label="Board">
              <Input
                value={profile.board}
                onChange={(e) => setProfile({ ...profile, board: e.target.value })}
                placeholder="CBSE / ICSE / State"
              />
            </Field>
            <Field label="10th Marks / %">
              <Input
                value={profile.marks_10th}
                onChange={(e) => setProfile({ ...profile, marks_10th: e.target.value })}
              />
            </Field>
            <Field label="12th Marks / %">
              <Input
                value={profile.marks_12th}
                onChange={(e) => setProfile({ ...profile, marks_12th: e.target.value })}
              />
            </Field>
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
          <CardHeader>
            <CardTitle>2 · Fee Plan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md bg-muted/50 p-4 md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Course Gross Fee
              </div>
              <div className="text-2xl font-bold">{inr(grossFee)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selectedCourse?.name} · {selectedCourse?.duration_months} months
              </div>
            </div>
            <Field label="Instalment Plan *">
              <Select value={fee.plan} onValueChange={(v: PlanKind) => setFee({ ...fee, plan: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plan_3">{PLAN_LABEL.plan_3} · Jun / Aug / Oct</SelectItem>
                  <SelectItem value="plan_4">
                    {PLAN_LABEL.plan_4} · Jun / Aug / Oct / Nov
                  </SelectItem>
                  <SelectItem value="plan_5">
                    {PLAN_LABEL.plan_5} · Jun / Aug / Oct / Nov / Dec
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Late Joiner Handling">
              <Select
                value={fee.late_joiner_mode}
                onValueChange={(v: LateJoinerMode) => setFee({ ...fee, late_joiner_mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remaining_only">Remaining due months only</SelectItem>
                  <SelectItem value="start_from_admission_month">
                    Start from admission month (July/Aug supported)
                  </SelectItem>
                  <SelectItem value="catchup_now">Catch-up now + remaining months</SelectItem>
                  <SelectItem value="original">
                    Keep original full plan (includes past due months)
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Concession (₹)">
              <Input
                type="number"
                min={0}
                value={fee.concession_amount}
                onChange={(e) => setFee({ ...fee, concession_amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Plan Year">
              <Input
                type="number"
                value={fee.plan_year}
                onChange={(e) => setFee({ ...fee, plan_year: Number(e.target.value) })}
              />
            </Field>
            <Field label="Due day of month">
              <Input
                type="number"
                min={1}
                max={28}
                value={fee.due_day}
                onChange={(e) => setFee({ ...fee, due_day: Number(e.target.value) })}
              />
            </Field>
            <Field label="Concession Reason" className="md:col-span-2">
              <Input
                value={fee.concession_reason}
                onChange={(e) => setFee({ ...fee, concession_reason: e.target.value })}
                placeholder="Sibling, scholarship, board topper…"
              />
            </Field>
            {profile.transport_required && (
              <Field label="Transport Fee (monthly)">
                <Input
                  type="number"
                  value={fee.transport_fee_monthly}
                  onChange={(e) =>
                    setFee({ ...fee, transport_fee_monthly: Number(e.target.value) })
                  }
                />
              </Field>
            )}
            {profile.hostel_required && (
              <Field label="Hostel Fee (monthly)">
                <Input
                  type="number"
                  value={fee.hostel_fee_monthly}
                  onChange={(e) => setFee({ ...fee, hostel_fee_monthly: Number(e.target.value) })}
                />
              </Field>
            )}
            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <Stat label="Concession" value={inr(Number(fee.concession_amount || 0))} />
              <Stat label="Net Payable" value={inr(netPayable)} accent />
              <Stat label="Installments" value={String(schedule.length)} />
            </div>
            {missedCount > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 md:col-span-2">
                {missedCount} plan month(s) are before admission date. Current mode:{" "}
                <strong>{lateJoinerModeLabel}</strong>
                .
              </div>
            )}
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Instalment Schedule (amounts editable)</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInstAmounts(evenSplit(netPayable, schedule.length))}
                >
                  Auto-split evenly
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{s.installment_no}</TableCell>
                      <TableCell>{s.month_label}</TableCell>
                      <TableCell>
                        {new Date(s.due_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="ml-auto h-8 w-32 text-right"
                          value={instAmounts[idx] ?? 0}
                          onChange={(e) => {
                            const next = [...instAmounts];
                            next[idx] = Number(e.target.value);
                            setInstAmounts(next);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div
                className={`mt-2 text-xs ${amountMismatch ? "text-destructive" : "text-muted-foreground"}`}
              >
                Sum of instalments: <strong>{inr(sumInst)}</strong>{" "}
                {amountMismatch
                  ? `(must equal Net Payable ${inr(netPayable)})`
                  : "✓ matches Net Payable"}
              </div>
            </div>
            <div className="flex justify-between md:col-span-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button disabled={!canStep3} onClick={() => setStep(3)}>
                Review <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>3 · Review & Confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Section title="Student">
              <Row k="Name" v={profile.full_name} />
              <Row k="DOB / Gender" v={`${profile.date_of_birth} · ${profile.gender}`} />
              <Row k="Mobile" v={profile.mobile} />
              <Row k="Class Year" v={profile.class_year} />
              <Row
                k="Course / Batch"
                v={`${selectedCourse?.name} · ${(batches.data as any[])?.find((b) => b.id === profile.batch_id)?.name}`}
              />
            </Section>
            <Section title="Fees">
              <Row k="Gross" v={inr(grossFee)} />
              <Row k="Plan" v={PLAN_LABEL[fee.plan]} />
              <Row
                k="Late Joiner Mode"
                v={lateJoinerModeLabel}
              />
              <Row k="Concession" v={inr(Number(fee.concession_amount || 0))} />
              <Row k="Net Payable" v={inr(netPayable)} />
              <Row k="Installments" v={String(schedule.length)} />
            </Section>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? (
                  "Enrolling…"
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Confirm enrollment
                  </>
                )}
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
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {done ? "✓" : n}
            </div>
            <span className={active ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>
              {label}
            </span>
            {i < 2 && <div className="h-px w-8 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function Field({
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
