import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Loading } from "@/components/app/Loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, ShieldAlert, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_auth/settings")({ component: Page });

function Page() {
  const { isAdmin, fullName, role } = useAuth();
  const qc = useQueryClient();

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Settings" description="Institute and policy configuration." />
        <EmptyState icon={ShieldAlert} title="Admin access required" description="Only administrators can change settings." />
      </div>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase.from("settings").update({
        institute_name: form.institute_name,
        institute_address: form.institute_address,
        active_academic_year: form.active_academic_year,
        admission_prefix: form.admission_prefix,
        receipt_prefix: form.receipt_prefix,
        grace_period_days: Number(form.grace_period_days),
        late_fee_amount: Number(form.late_fee_amount),
        late_fee_percent: Number(form.late_fee_percent),
        bounce_charge: Number(form.bounce_charge),
      }).eq("id", form.id);
      if (error) throw error;
      await logAudit({
        actorName: fullName, actorRole: role,
        action: "update_settings", entityType: "settings", entityId: form.id,
        oldValue: data, newValue: form,
      });
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  if (isLoading || !form) return <Loading />;

  const set = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Institute info, numbering prefixes, and fee policy."
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
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1 block text-xs">{label}</Label>{children}</div>;
}
