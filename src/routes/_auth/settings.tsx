import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettingsFn, updateSettingsFn } from "@/fns/settings";
import { getCampusesManageFn } from "@/fns/campus";
import { getCoursesFn } from "@/fns/courses";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Loading } from "@/components/app/Loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, ShieldAlert, Settings as SettingsIcon, Building2, BookOpen, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { useCampus } from "@/lib/campus";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_auth/settings")({ component: Page });

function Page() {
  const { isAdmin, fullName, role } = useAuth();
  const qc = useQueryClient();

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" description="Institute and policy configuration." />
        <EmptyState icon={ShieldAlert} title="Admin access required" description="Only administrators can change settings." />
      </div>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettingsFn({ data: {} }),
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const prev = data;
      await updateSettingsFn({
        data: {
          institute_name: form.institute_name,
          institute_address: form.institute_address,
          active_academic_year: form.active_academic_year,
          admission_prefix: form.admission_prefix,
          receipt_prefix: form.receipt_prefix,
          grace_period_days: Number(form.grace_period_days),
          late_fee_amount: Number(form.late_fee_amount),
          late_fee_percent: Number(form.late_fee_percent),
          bounce_charge: Number(form.bounce_charge),
        },
      });
      await logAudit({ actorName: fullName, actorRole: role, action: "update_settings", entityType: "settings", oldValue: prev, newValue: form });
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  if (isLoading || !form) return <Loading />;

  const set = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Institute info, numbering prefixes, and fee policy."
        actions={<Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save Changes"}</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><SettingsIcon className="mr-2 inline h-4 w-4" /> Institute</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Institute Name"><Input value={form.institute_name} onChange={(e) => set("institute_name", e.target.value)} /></Field>
            <Field label="Address"><Textarea rows={2} value={form.institute_address} onChange={(e) => set("institute_address", e.target.value)} /></Field>
            <Field label="Active Academic Year"><Input value={form.active_academic_year} onChange={(e) => set("active_academic_year", e.target.value)} placeholder="2025-26" /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Numbering</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Admission Prefix"><Input value={form.admission_prefix} onChange={(e) => set("admission_prefix", e.target.value)} /></Field>
            <Field label="Receipt Prefix"><Input value={form.receipt_prefix} onChange={(e) => set("receipt_prefix", e.target.value)} /></Field>
            <p className="text-xs text-muted-foreground">Format: PREFIX/YYYY/NNNN (admission) and PREFIX/YYYY/NNNNN (receipt). Sequence is generated server-side.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Fee Policy</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <Field label="Grace Period (days)"><Input type="number" value={form.grace_period_days} onChange={(e) => set("grace_period_days", e.target.value)} /></Field>
            <Field label="Late Fee Amount (₹)"><Input type="number" value={form.late_fee_amount} onChange={(e) => set("late_fee_amount", e.target.value)} /></Field>
            <Field label="Late Fee Percent (%)"><Input type="number" value={form.late_fee_percent} onChange={(e) => set("late_fee_percent", e.target.value)} /></Field>
            <Field label="Bounce Charge (₹)"><Input type="number" value={form.bounce_charge} onChange={(e) => set("bounce_charge", e.target.value)} /></Field>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <PerCampusFeeStructure />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block text-xs">{label}</Label>{children}</div>;
}

function PerCampusFeeStructure() {
  const { setCampusId } = useCampus();

  const { data, isLoading } = useQuery({
    queryKey: ["settings-per-campus-fees"],
    queryFn: async () => {
      const [campuses, courses] = await Promise.all([
        getCampusesManageFn({ data: {} }),
        getCoursesFn({ data: {} }),
      ]);
      return { campuses: campuses || [], courses: courses || [] };
    },
  });

  if (isLoading) return <Loading />;
  const campuses = (data?.campuses as any[]) || [];
  const allCourses = (data?.courses as any[]) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle><Building2 className="mr-2 inline h-4 w-4" /> Per-Campus Fee Structure</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Each campus has its own courses and fee structure.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {campuses.length === 0 ? (
          <EmptyState icon={Building2} title="No campuses yet" description="Create campuses under Courses → Campuses to start configuring per-campus fees." />
        ) : (
          campuses.map((c: any) => {
            const list = allCourses.filter((co: any) => co.campus_id === c.id);
            return (
              <div key={c.id} className="rounded-lg border bg-card">
                <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.city || "—"} · {list.length} course{list.length === 1 ? "" : "s"}</div>
                  </div>
                  <Link to="/courses" onClick={() => setCampusId(c.id)} className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                    <BookOpen className="h-3.5 w-3.5" /> Edit fees <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {list.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No courses configured for this campus yet.</p>
                ) : (
                  <div className="divide-y">
                    {list.map((co: any) => (
                      <div key={co.id} className="grid grid-cols-2 gap-2 px-4 py-2 text-sm sm:grid-cols-5">
                        <div className="sm:col-span-2 font-medium">{co.name}</div>
                        <div className="text-xs text-muted-foreground"><span className="block">Gross</span><span className="text-foreground">{inr(Number(co.gross_fee))}</span></div>
                        <div className="text-xs text-muted-foreground"><span className="block">Registration</span><span className="text-foreground">{inr(Number(co.registration_fee))}</span></div>
                        <div className="text-xs text-muted-foreground"><span className="block">Material</span><span className="text-foreground">{inr(Number(co.material_fee))}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
