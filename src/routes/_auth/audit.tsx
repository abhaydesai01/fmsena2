import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Loading } from "@/components/app/Loading";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, ShieldAlert, Search, Eye } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_auth/audit")({ component: Page });

function Page() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<any>(null);

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Audit Trail" description="System log of every action taken." />
        <EmptyState icon={ShieldAlert} title="Admin access required" description="Only administrators can view the audit trail." />
      </div>
    );
  }

  const data = useQuery({
    queryKey: ["audit", from, to],
    queryFn: async () => {
      let query = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to + "T23:59:59");
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data.data || [];
    return (data.data || []).filter((r: any) =>
      r.actor_name?.toLowerCase().includes(term) ||
      r.action?.toLowerCase().includes(term) ||
      r.entity_type?.toLowerCase().includes(term)
    );
  }, [data.data, q]);

  return (
    <div>
      <PageHeader title="Audit Trail" description="System log of every action taken." />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action, entity…" className="pl-9" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {data.isLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No audit entries" description="Actions like enrollments, collections, and edits will appear here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{fmtDateTime(r.created_at)}</TableCell>
                      <TableCell className="font-medium">{r.actor_name}</TableCell>
                      <TableCell className="text-xs uppercase">{r.actor_role}</TableCell>
                      <TableCell className="font-mono text-xs">{r.action}</TableCell>
                      <TableCell className="text-xs">{r.entity_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.reason || "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Audit entry · {view?.action}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <Row k="When" v={view ? fmtDateTime(view.created_at) : ""} />
            <Row k="Actor" v={`${view?.actor_name} (${view?.actor_role})`} />
            <Row k="Entity" v={`${view?.entity_type}${view?.entity_id ? " · " + view.entity_id : ""}`} />
            {view?.old_value && <JsonBlock title="Previous" value={view.old_value} />}
            {view?.new_value && <JsonBlock title="New" value={view.new_value} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
function JsonBlock({ title, value }: { title: string; value: any }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
