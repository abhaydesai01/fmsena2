import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getStudentFn, getFeeAssignmentFn } from "@/fns/students";
import { getCampusesFn } from "@/fns/campus";
import { useAuth } from "@/lib/auth";
import { fmtDate, inr } from "@/lib/format";
import logoUrl from "@/assets/logo.png";
import { ChevronLeft, Printer } from "lucide-react";

type StudentView = Record<string, unknown> & {
  campus_id?: string;
  admission_number?: string;
  admission_date?: string;
  full_name?: string;
  class_year?: string;
  academic_year?: string;
  date_of_birth?: string;
  gender?: string;
  mobile?: string;
  email?: string;
  aadhaar_number?: string;
  permanent_address?: string;
  current_address?: string;
  father_name?: string;
  father_mobile?: string;
  mother_name?: string;
  mother_mobile?: string;
  emergency_name?: string;
  emergency_relation?: string;
  emergency_mobile?: string;
  courses?: { name?: string | null } | null;
  batches?: { name?: string | null } | null;
};

export const Route = createFileRoute("/_auth/students_/$studentId/admission-form")({
  component: AdmissionFormPage,
});

function AdmissionFormPage() {
  const { studentId } = Route.useParams();
  const { hasRole } = useAuth();

  const student = useQuery({
    queryKey: ["student", studentId, "admission-form"],
    queryFn: () => getStudentFn({ data: { id: studentId } }),
  });
  const feeAssignment = useQuery({
    queryKey: ["student", studentId, "fee-assignment", "admission-form"],
    queryFn: () => getFeeAssignmentFn({ data: { studentId } }),
  });
  const campuses = useQuery({
    queryKey: ["campuses-all", "admission-form"],
    queryFn: () => getCampusesFn(),
  });

  const s = student.data as StudentView | null;
  const fa = feeAssignment.data as Record<string, unknown> | null;
  const campus = useMemo(() => {
    const list = (campuses.data as Array<{ id: string; name: string; city?: string | null }>) || [];
    const campusId = String(s?.campus_id || "");
    return list.find((c) => c.id === campusId) || null;
  }, [campuses.data, s]);

  useEffect(() => {
    if (!s) return;
    const id = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(id);
  }, [s]);

  if (!hasRole(["ADMIN", "ACCOUNTANT", "ENROLLMENT_OFFICER"])) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    );
  }
  if (student.isLoading || feeAssignment.isLoading || campuses.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading admission form…</p>;
  }
  if (!s) {
    return <p className="text-sm text-muted-foreground">Student not found.</p>;
  }

  const gender = String(s.gender || "").toLowerCase();
  const collegeType = String(s.college_type || "");
  const courseType = String(s.course_type || "");
  const courseStream = String(s.course_stream || "").toUpperCase();
  const admissionType = String(s.admission_type || "");
  const subCaste = String(s.sub_caste || "");
  const subCasteGroup = String(s.sub_caste_group || "");
  const vanRequired = Boolean(s.van_facility_required);
  const familyIncome = s.family_annual_income ? inr(Number(s.family_annual_income || 0)) : "—";
  const presentAddress = String(s.current_address || s.permanent_address || "—");
  const permanentAddress = String(s.permanent_address || "—");
  const mobilePrimary = String(s.mobile || "—");
  const mobileSecondary = String(s.mobile_secondary || "—");

  return (
    <div id="admission-print" className="space-y-3 print:space-y-0">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .admission-page { width: 190mm; min-height: 277mm; margin: 0 auto; }
          .no-print-shadow { box-shadow: none !important; border: 0 !important; }
          .hairline { border-bottom: 0.6px solid #111; }
        }
      `}</style>
      <div className="flex items-center justify-between print:hidden">
        <Link
          to="/students/$studentId"
          params={{ studentId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to student
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <Card className="mx-auto max-w-5xl print:shadow-none print:border-0 no-print-shadow">
        <CardContent className="admission-page space-y-3 p-5 text-[12px] leading-[1.25] print:p-0">
          <div className="hairline pb-2">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Excellent NEET Academy" className="h-14 w-14 object-contain" />
              <div className="leading-tight">
                <div className="text-[18px] font-bold tracking-[0.3px]">EXCELLENT NEET ACADEMY DHARWAD</div>
                <div className="text-[10.5px] text-muted-foreground">
                  Near Survarna Petrol Pump, P. B. Road, Dharwad-04 (Karnataka)
                </div>
                <div className="mt-0.5 text-[12px] font-semibold">ADMISSION FORM</div>
              </div>
              <div className="ml-auto text-right text-[10.5px]">
                <div className="font-semibold">Admission No: {String(s.admission_number || "—")}</div>
                <div>Registration: {fmtDate(String(s.registration_date || new Date().toISOString()))}</div>
                <div>Joining: {fmtDate(String(s.joining_date || s.admission_date || new Date().toISOString()))}</div>
                <div>Campus: {campus?.name || "—"}</div>
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            <FormLine label="Course" value={`${String(s.courses?.name || "—")} · ${String(s.batches?.name || "—")}`} />
            <FormLine label="Academic Year" value={String(s.academic_year || "—")} suffix={`NEET ${tick(courseStream === "NEET")}   K-CET ${tick(courseStream === "KCET")}`} />
            <FormLine label="No." value={String(s.admission_number || "—")} />
            <FormLine label="Registration Date" value={fmtDate(String(s.registration_date || "—"))} />
            <FormLine label="Joining Date" value={fmtDate(String(s.joining_date || s.admission_date || "—"))} />
            <FormLine label="1. Name" value={String(s.full_name || "—")} />
            <FormLine
              label="2. Gender"
              value={`Male ${tick(gender === "male")}   Female ${tick(gender === "female")}   Other ${tick(gender === "other")}`}
            />
            <FormLine label="3. Date of Birth" value={fmtDate(String(s.date_of_birth || ""))} />
            <FormLine label="4. Name of the Father" value={String(s.father_name || "—")} />
            <FormLine label="   Occupation" value={String(s.father_occupation || "—")} />
            <FormLine label="5. Name of the Mother" value={String(s.mother_name || "—")} />
            <FormLine label="   Occupation" value={String(s.mother_occupation || "—")} />
            <FormLine label="6. Name of the College last studied" value={String(s.previous_school || "—")} />
            <FormLine
              label="7. Type of the College"
              value={`State Board ${tick(collegeType === "state_board")}   CBSE Board ${tick(collegeType === "cbse_board")}`}
            />
            <FormLine
              label="8. PUC Hall Ticket No / SSLC Register No"
              value={`${String(s.puc_hall_ticket_no || "—")} / ${String(s.sslc_register_number || "—")}`}
            />
            <FormLine
              label="9. % in PUC"
              value={`Total %: ${String(s.puc_total_percent || "—")}   PCMB %: ${String(s.puc_pcmb_percent || "—")}`}
            />
            <FormLine label="10. Marks obtained in NEET Exam" value={String(s.neet_marks_obtained || "—")} />
            <FormLine
              label="11. Type of Admission"
              value={`Non-Residential ${tick(admissionType === "non_residential")}   Residential ${tick(admissionType === "residential")}`}
            />
            <FormLine
              label="12. Caste / Sub Caste / Category"
              value={`${String(s.category || "—")} / ${subCaste || "—"} / ${subCasteGroup || "—"}`}
            />
            <FormLine
              label="13. Van Facility"
              value={`Required ${tick(vanRequired)}   Not Required ${tick(!vanRequired)}`}
            />
            <div className="grid grid-cols-2 gap-4 border-b border-black py-1">
              <div>
                <div className="font-medium">14. Present Address</div>
                <div>{presentAddress}</div>
                <div>Pin Code: {String(s.present_address_pincode || "—")}</div>
              </div>
              <div>
                <div className="font-medium">Permanent Address</div>
                <div>{permanentAddress}</div>
                <div>Pin Code: {String(s.permanent_address_pincode || "—")}</div>
              </div>
            </div>
            <FormLine label="Mobile No" value={`1: ${mobilePrimary} / 2: ${mobileSecondary}`} />
            <FormLine label="Email Address" value={String(s.email || "—")} />
            <FormLine label="Aadhar Card No / PAN No" value={`${String(s.aadhaar_number || "—")} / ${String(s.pan_number || "—")}`} />
            <FormLine label="Annual Income of the Family" value={familyIncome} />
            <FormLine
              label="Fee Snapshot"
              value={`Gross ${inr(Number(fa?.gross_fee || 0))} · Concession ${inr(Number(fa?.discount_amount || 0))} · Net ${inr(Number(fa?.net_payable || 0))}`}
            />
            <FormLine
              label="Course Type"
              value={`Long Term ${tick(courseType === "long_term")}   Crash Course ${tick(courseType === "crash_course")}`}
            />
          </div>

          <div className="mt-7 grid grid-cols-3 gap-6 text-[10.5px]">
            <div className="border-t border-black pt-2">Signature of the Student</div>
            <div className="border-t border-black pt-2 text-center">Signature of the Parent</div>
            <div className="border-t border-black pt-2 text-right">Signature of the Principal</div>
          </div>

          <div className="mt-6 text-center text-[10px] text-muted-foreground">-- 1 of 2 --</div>

          <div className="mt-6 break-before-page border-t border-black pt-3 print:mt-0 print:pt-2">
            <div className="text-center text-[13px] font-semibold">GUIDELINES FOR PARENTS & STUDENTS</div>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[10.5px] leading-[1.35]">
              <li>Strict prohibition of electronic gadgets; if found, items may be seized.</li>
              <li>Students should follow dress code as per academy rules.</li>
              <li>Sickness should be reported immediately to caretakers/wardens.</li>
              <li>Students are responsible for safety of their valuables.</li>
              <li>Discipline is mandatory; violations may lead to immediate action.</li>
              <li>Punctuality is mandatory; holidays are restricted until course completion.</li>
              <li>Parent visits require prior permission from principal/administration.</li>
              <li>Use water judiciously and report any leakage promptly.</li>
              <li>Hostel students are not allowed to leave premises without authorization.</li>
              <li>Registration fees are non-refundable if student does not join.</li>
              <li>Any refund for discontinuation is subject to refund policy.</li>
              <li>Residential to non-residential conversion does not auto-refund hostel fee.</li>
            </ol>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-sm border border-black p-2.5 text-[10.5px]">
              <div className="mb-1 text-[11px] font-semibold">DECLARATION</div>
              <p>
                I/We have read the rules and regulations for admission and agree to adhere to
                academy policies. I understand that fee refund (if any) is governed strictly by the
                official refund policy.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-[10px]">
                <div className="border-t border-black pt-2">Signature of Parent/Guardian</div>
                <div className="border-t border-black pt-2 text-right">Signature of Candidate</div>
              </div>
            </div>

            <div className="rounded-sm border border-black p-2.5 text-[10.5px]">
              <div className="mb-1 text-[11px] font-semibold">OFFICE USE</div>
              <OfficeRow k="Name of Student" v={String(s.full_name || "—")} />
              <OfficeRow k="Name of Father" v={String(s.father_name || "—")} />
              <OfficeRow k="Course" v={String(s.courses?.name || "—")} />
              <OfficeRow k="Amount Paid" v={inr(Number(fa?.net_payable || 0))} />
              <OfficeRow k="Receipt No" v="________________" />
              <OfficeRow k="Cash / Cheque / Bank / No / Date" v="________________" />
              <div className="mt-5 grid grid-cols-2 gap-3 text-[10px]">
                <div className="border-t border-black pt-2">Signature of Administrator</div>
                <div className="border-t border-black pt-2 text-right">Signature of Director</div>
              </div>
            </div>
          </div>
          <div className="mt-2 text-center text-[10px] text-muted-foreground">-- 2 of 2 --</div>
        </CardContent>
      </Card>
    </div>
  );
}

function FormLine({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="grid grid-cols-[245px_1fr] items-center gap-2 border-b border-black py-[3px]">
      <div className="font-medium">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <span>{value}</span>
        {suffix ? <span className="text-[10px] text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

function OfficeRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[155px_1fr] gap-2 border-b border-black py-[3px]">
      <div>{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}

function tick(value: boolean) {
  return value ? "✓" : "□";
}

