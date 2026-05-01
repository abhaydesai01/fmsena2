import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Pencil,
  Layers,
  Users,
  Calendar as CalendarIcon,
  Trash2,
  Power,
  Building2,
} from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth";
import { useCampus } from "@/lib/campus";
import type { Database } from "@/integrations/supabase/types";

type Course = Database["public"]["Tables"]["courses"]["Row"];
type Batch = Database["public"]["Tables"]["batches"]["Row"];
type BatchStatus = Database["public"]["Enums"]["batch_status"];
type Campus = Database["public"]["Tables"]["campuses"]["Row"];

export const Route = createFileRoute("/_auth/courses")({ component: Page });

function Page() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div>
        <PageHeader
          title="Courses & Batches"
          description="Configure courses, fee structures, batches, capacity, and timings."
        />
        <EmptyState
          icon={BookOpen}
          title="Admin access required"
          description="Only administrators can manage courses and batches."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Courses & Batches"
        description="Configure courses, fee structures, batches, capacity, and timings."
      />
      <Tabs defaultValue="courses" className="w-full">
        <TabsList>
          <TabsTrigger value="campuses">
            <Building2 className="h-4 w-4" /> Campuses
          </TabsTrigger>
          <TabsTrigger value="courses">
            <BookOpen className="h-4 w-4" /> Courses
          </TabsTrigger>
          <TabsTrigger value="batches">
            <Layers className="h-4 w-4" /> Batches
          </TabsTrigger>
        </TabsList>
        <TabsContent value="campuses" className="mt-4">
          <CampusesPanel />
        </TabsContent>
        <TabsContent value="courses" className="mt-4">
          <CoursesPanel />
        </TabsContent>
        <TabsContent value="batches" className="mt-4">
          <BatchesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------- Campuses ----------------------------- */

type CampusFormState = {
  name: string;
  city: string;
  address: string;
  is_active: boolean;
};

const emptyCampus: CampusFormState = {
  name: "",
  city: "",
  address: "",
  is_active: true,
};

function CampusesPanel() {
  const qc = useQueryClient();
  const { fullName, role } = useAuth();
  const { setCampusId } = useCampus();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campus | null>(null);
  const [form, setForm] = useState<CampusFormState>(emptyCampus);

  const campuses = useQuery({
    queryKey: ["campuses-manage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campus[];
    },
  });

  const courseCounts = useQuery({
    queryKey: ["campus-course-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("campus_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const c of data || []) map[c.campus_id] = (map[c.campus_id] || 0) + 1;
      return map;
    },
  });

  const startCreate = () => {
    setEditing(null);
    setForm(emptyCampus);
    setOpen(true);
  };

  const startEdit = (c: Campus) => {
    setEditing(c);
    setForm({
      name: c.name,
      city: c.city || "",
      address: c.address || "",
      is_active: c.is_active,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Campus name is required");
      const payload = {
        name: form.name.trim(),
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("campuses").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit({
          actorName: fullName || "—",
          actorRole: role,
          action: "update",
          entityType: "campus",
          entityId: editing.id,
          oldValue: editing,
          newValue: payload,
        });
        return { kind: "updated" as const, id: editing.id };
      } else {
        const { data, error } = await supabase.from("campuses").insert(payload).select().single();
        if (error) throw error;
        await logAudit({
          actorName: fullName || "—",
          actorRole: role,
          action: "create",
          entityType: "campus",
          entityId: data?.id,
          newValue: payload,
        });
        return { kind: "created" as const, id: data!.id };
      }
    },
    onSuccess: (res) => {
      toast.success(`Campus ${res.kind}`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["campuses-manage"] });
      qc.invalidateQueries({ queryKey: ["campuses-all"] });
      if (res.kind === "created") {
        // switch active campus to the new one so admin can immediately add courses
        setCampusId(res.id);
        toast.message("Switched to new campus — add courses & fee structure under the Courses tab.");
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save campus");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (c: Campus) => {
      const { error } = await supabase
        .from("campuses")
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
      await logAudit({
        actorName: fullName || "—",
        actorRole: role,
        action: c.is_active ? "deactivate" : "activate",
        entityType: "campus",
        entityId: c.id,
        oldValue: { is_active: c.is_active },
        newValue: { is_active: !c.is_active },
      });
    },
    onSuccess: () => {
      toast.success("Campus status updated");
      qc.invalidateQueries({ queryKey: ["campuses-manage"] });
      qc.invalidateQueries({ queryKey: ["campuses-all"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const list = campuses.data || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Campuses</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {list.length} campus{list.length === 1 ? "" : "es"} configured. Each campus has its own
            courses, batches, and fee structure.
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" /> New Campus
        </Button>
      </CardHeader>
      <CardContent>
        {campuses.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No campuses yet"
            description="Add your first campus to start configuring courses and fee structures."
            action={
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" /> Create Campus
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campus</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Courses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.city || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{c.address || "—"}</TableCell>
                    <TableCell className="text-right">{courseCounts.data?.[c.id] ?? 0}</TableCell>
                    <TableCell>
                      <span
                        className={
                          c.is_active
                            ? "inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
                            : "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCampusId(c.id);
                            toast.success(`Switched to ${c.name}`);
                          }}
                          title="Set as active campus"
                        >
                          Use
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(c)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive.mutate(c)}
                          title={c.is_active ? "Deactivate" : "Activate"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Campus" : "New Campus"}</DialogTitle>
            <DialogDescription>
              After creating, you'll be switched to this campus so you can immediately add its
              courses and fee structure under the Courses tab.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="cm-name">Campus Name *</Label>
              <Input
                id="cm-name"
                placeholder="e.g. Dharwad Main"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cm-city">City</Label>
              <Input
                id="cm-city"
                placeholder="Dharwad"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="cm-addr">Address</Label>
              <Input
                id="cm-addr"
                placeholder="Street, area, landmark"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="cm-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label htmlFor="cm-active" className="cursor-pointer">
                Active — selectable from the campus switcher
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save Changes" : "Create Campus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ----------------------------- Courses ----------------------------- */

type CourseFormState = {
  name: string;
  academic_year: string;
  duration_months: string;
  gross_fee: string;
  registration_fee: string;
  material_fee: string;
  test_series_fee: string;
  is_active: boolean;
};

const emptyCourse: CourseFormState = {
  name: "",
  academic_year: "2025-26",
  duration_months: "12",
  gross_fee: "",
  registration_fee: "0",
  material_fee: "0",
  test_series_fee: "0",
  is_active: true,
};

function CoursesPanel() {
  const qc = useQueryClient();
  const { fullName, role } = useAuth();
  const { campusId, campus } = useCampus();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseFormState>(emptyCourse);

  const courses = useQuery({
    queryKey: ["courses-list", campusId],
    queryFn: async () => {
      let q = supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (campusId) q = q.eq("campus_id", campusId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Course[];
    },
    enabled: !!campusId,
  });

  const studentCounts = useQuery({
    queryKey: ["course-student-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("course_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const s of data || []) map[s.course_id] = (map[s.course_id] || 0) + 1;
      return map;
    },
  });

  const startCreate = () => {
    setEditing(null);
    setForm(emptyCourse);
    setOpen(true);
  };

  const startEdit = (c: Course) => {
    setEditing(c);
    setForm({
      name: c.name,
      academic_year: c.academic_year,
      duration_months: String(c.duration_months),
      gross_fee: String(c.gross_fee),
      registration_fee: String(c.registration_fee),
      material_fee: String(c.material_fee),
      test_series_fee: String(c.test_series_fee),
      is_active: c.is_active,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Course name is required");
      if (!campusId) throw new Error("Select a campus first");
      const gross = Number(form.gross_fee);
      if (!gross || gross <= 0) throw new Error("Gross fee must be greater than 0");
      const payload = {
        name: form.name.trim(),
        academic_year: form.academic_year.trim() || "2025-26",
        duration_months: Number(form.duration_months) || 12,
        gross_fee: gross,
        registration_fee: Number(form.registration_fee) || 0,
        material_fee: Number(form.material_fee) || 0,
        test_series_fee: Number(form.test_series_fee) || 0,
        is_active: form.is_active,
        campus_id: campusId,
      };
      if (editing) {
        const { error } = await supabase.from("courses").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit({
          actorName: fullName || "—",
          actorRole: role,
          action: "update",
          entityType: "course",
          entityId: editing.id,
          oldValue: editing,
          newValue: payload,
        });
        return "updated";
      } else {
        const { data, error } = await supabase.from("courses").insert(payload).select().single();
        if (error) throw error;
        await logAudit({
          actorName: fullName || "—",
          actorRole: role,
          action: "create",
          entityType: "course",
          entityId: data?.id,
          newValue: payload,
        });
        return "created";
      }
    },
    onSuccess: (kind) => {
      toast.success(`Course ${kind}`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["courses-list"] });
      qc.invalidateQueries({ queryKey: ["batches-list"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save course");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (c: Course) => {
      const { error } = await supabase
        .from("courses")
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
      await logAudit({
        actorName: fullName || "—",
        actorRole: role,
        action: c.is_active ? "deactivate" : "activate",
        entityType: "course",
        entityId: c.id,
        oldValue: { is_active: c.is_active },
        newValue: { is_active: !c.is_active },
      });
    },
    onSuccess: () => {
      toast.success("Course status updated");
      qc.invalidateQueries({ queryKey: ["courses-list"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const list = courses.data || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Courses</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {list.length} course{list.length === 1 ? "" : "s"} in {campus?.name || "—"}
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" /> New Course
        </Button>
      </CardHeader>
      <CardContent>
        {courses.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Add your first course (e.g. NEET 11th, NEET 12th, Dropper) to start enrolling students."
            action={
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" /> Create Course
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Gross Fee</TableHead>
                  <TableHead className="text-right">Reg. Fee</TableHead>
                  <TableHead className="text-right">Material</TableHead>
                  <TableHead className="text-right">Test Series</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.academic_year}</TableCell>
                    <TableCell>{c.duration_months} mo</TableCell>
                    <TableCell className="text-right font-semibold">{inr(c.gross_fee)}</TableCell>
                    <TableCell className="text-right">{inr(c.registration_fee)}</TableCell>
                    <TableCell className="text-right">{inr(c.material_fee)}</TableCell>
                    <TableCell className="text-right">{inr(c.test_series_fee)}</TableCell>
                    <TableCell className="text-right">{studentCounts.data?.[c.id] ?? 0}</TableCell>
                    <TableCell>
                      <span
                        className={
                          c.is_active
                            ? "inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
                            : "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(c)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive.mutate(c)}
                          title={c.is_active ? "Deactivate" : "Activate"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Course" : "New Course"}</DialogTitle>
            <DialogDescription>
              Define the course name, duration, and the fee components used during enrolment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="c-name">Course Name *</Label>
              <Input
                id="c-name"
                placeholder="e.g. NEET 12th — Regular"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="c-year">Academic Year</Label>
              <Input
                id="c-year"
                placeholder="2025-26"
                value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="c-dur">Duration (months)</Label>
              <Input
                id="c-dur"
                type="number"
                min={1}
                value={form.duration_months}
                onChange={(e) => setForm({ ...form, duration_months: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="c-gross">Gross Fee (₹) *</Label>
              <Input
                id="c-gross"
                type="number"
                min={0}
                value={form.gross_fee}
                onChange={(e) => setForm({ ...form, gross_fee: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="c-reg">Registration Fee (₹)</Label>
              <Input
                id="c-reg"
                type="number"
                min={0}
                value={form.registration_fee}
                onChange={(e) => setForm({ ...form, registration_fee: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="c-mat">Material Fee (₹)</Label>
              <Input
                id="c-mat"
                type="number"
                min={0}
                value={form.material_fee}
                onChange={(e) => setForm({ ...form, material_fee: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="c-test">Test Series Fee (₹)</Label>
              <Input
                id="c-test"
                type="number"
                min={0}
                value={form.test_series_fee}
                onChange={(e) => setForm({ ...form, test_series_fee: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="c-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label htmlFor="c-active" className="cursor-pointer">
                Active — available for new enrolments
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save Changes" : "Create Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ----------------------------- Batches ----------------------------- */

type BatchFormState = {
  course_id: string;
  name: string;
  timing: string;
  capacity: string;
  academic_year: string;
  start_date: string;
  status: BatchStatus;
};

const emptyBatch: BatchFormState = {
  course_id: "",
  name: "",
  timing: "",
  capacity: "50",
  academic_year: "2025-26",
  start_date: "",
  status: "active",
};

function BatchesPanel() {
  const qc = useQueryClient();
  const { fullName, role } = useAuth();
  const { campusId } = useCampus();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState<BatchFormState>(emptyBatch);
  const [confirmDelete, setConfirmDelete] = useState<Batch | null>(null);
  const [filterCourse, setFilterCourse] = useState<string>("all");

  const courses = useQuery({
    queryKey: ["courses-active", campusId],
    queryFn: async () => {
      let q = supabase.from("courses").select("id, name, is_active").order("name");
      if (campusId) q = q.eq("campus_id", campusId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!campusId,
  });

  const batches = useQuery({
    queryKey: ["batches-list", campusId],
    queryFn: async () => {
      let q = supabase.from("batches").select("*, courses(name)").order("created_at", { ascending: false });
      if (campusId) q = q.eq("campus_id", campusId);
      const { data, error } = await q;
      if (error) throw error;
      return data as (Batch & { courses: { name: string } | null })[];
    },
    enabled: !!campusId,
  });

  const enrolledCounts = useQuery({
    queryKey: ["batch-student-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("batch_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const s of data || []) map[s.batch_id] = (map[s.batch_id] || 0) + 1;
      return map;
    },
  });

  const startCreate = () => {
    setEditing(null);
    setForm({
      ...emptyBatch,
      course_id: courses.data?.find((c) => c.is_active)?.id || "",
    });
    setOpen(true);
  };

  const startEdit = (b: Batch) => {
    setEditing(b);
    setForm({
      course_id: b.course_id,
      name: b.name,
      timing: b.timing || "",
      capacity: String(b.capacity),
      academic_year: b.academic_year,
      start_date: b.start_date || "",
      status: b.status,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.course_id) throw new Error("Select a course");
      if (!campusId) throw new Error("Select a campus first");
      if (!form.name.trim()) throw new Error("Batch name is required");
      const cap = Number(form.capacity);
      if (!cap || cap <= 0) throw new Error("Capacity must be greater than 0");
      const enrolled = editing ? enrolledCounts.data?.[editing.id] ?? 0 : 0;
      if (editing && cap < enrolled) {
        throw new Error(`Capacity cannot be less than enrolled (${enrolled})`);
      }
      const payload = {
        course_id: form.course_id,
        name: form.name.trim(),
        timing: form.timing.trim(),
        capacity: cap,
        academic_year: form.academic_year.trim() || "2025-26",
        start_date: form.start_date || null,
        status: form.status,
        campus_id: campusId,
      };
      if (editing) {
        const { error } = await supabase.from("batches").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit({
          actorName: fullName || "—",
          actorRole: role,
          action: "update",
          entityType: "batch",
          entityId: editing.id,
          oldValue: editing,
          newValue: payload,
        });
        return "updated";
      } else {
        const { data, error } = await supabase.from("batches").insert(payload).select().single();
        if (error) throw error;
        await logAudit({
          actorName: fullName || "—",
          actorRole: role,
          action: "create",
          entityType: "batch",
          entityId: data?.id,
          newValue: payload,
        });
        return "created";
      }
    },
    onSuccess: (kind) => {
      toast.success(`Batch ${kind}`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["batches-list"] });
      qc.invalidateQueries({ queryKey: ["dash", "batches"] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to save batch"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ b, status }: { b: Batch; status: BatchStatus }) => {
      const { error } = await supabase.from("batches").update({ status }).eq("id", b.id);
      if (error) throw error;
      await logAudit({
        actorName: fullName || "—",
        actorRole: role,
        action: "status_change",
        entityType: "batch",
        entityId: b.id,
        oldValue: { status: b.status },
        newValue: { status },
      });
    },
    onSuccess: () => {
      toast.success("Batch status updated");
      qc.invalidateQueries({ queryKey: ["batches-list"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (b: Batch) => {
      const enrolled = enrolledCounts.data?.[b.id] ?? 0;
      if (enrolled > 0) {
        throw new Error(`Cannot delete: ${enrolled} student(s) enrolled in this batch.`);
      }
      const { error } = await supabase.from("batches").delete().eq("id", b.id);
      if (error) throw error;
      await logAudit({
        actorName: fullName || "—",
        actorRole: role,
        action: "delete",
        entityType: "batch",
        entityId: b.id,
        oldValue: b,
      });
    },
    onSuccess: () => {
      toast.success("Batch deleted");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["batches-list"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const filtered = useMemo(() => {
    const list = batches.data || [];
    return filterCourse === "all" ? list : list.filter((b) => b.course_id === filterCourse);
  }, [batches.data, filterCourse]);

  const noCourses = (courses.data || []).length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Batches</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtered.length} batch{filtered.length === 1 ? "" : "es"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {(courses.data || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={startCreate} disabled={noCourses}>
            <Plus className="h-4 w-4" /> New Batch
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {noCourses ? (
          <EmptyState
            icon={BookOpen}
            title="Create a course first"
            description="Batches belong to courses. Add a course in the Courses tab before creating batches."
          />
        ) : batches.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No batches yet"
            description="Create batches to group students by timing and capacity."
            action={
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" /> Create Batch
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((b) => {
              const enrolled = enrolledCounts.data?.[b.id] ?? 0;
              const pct = Math.min(100, Math.round((enrolled / Math.max(1, b.capacity)) * 100));
              const isFull = enrolled >= b.capacity;
              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{b.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {b.courses?.name || "—"}
                      </div>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {b.start_date ? fmtDate(b.start_date) : "Start TBD"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {enrolled} / {b.capacity}
                    </div>
                    <div className="col-span-2 truncate">
                      <span className="font-medium text-foreground">Timing:</span>{" "}
                      {b.timing || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          "h-full rounded-full " +
                          (isFull ? "bg-destructive" : "bg-[var(--gradient-primary)]")
                        }
                        style={{ width: pct + "%" }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {pct}% occupancy{isFull ? " · Full" : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Select
                      value={b.status}
                      onValueChange={(v) =>
                        setStatus.mutate({ b, status: v as BatchStatus })
                      }
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="full">Full</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(b)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Batch" : "New Batch"}</DialogTitle>
            <DialogDescription>
              Group students by course, timing, and seat capacity.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Course *</Label>
              <Select
                value={form.course_id}
                onValueChange={(v) => setForm({ ...form, course_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {(courses.data || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {!c.is_active ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="b-name">Batch Name *</Label>
              <Input
                id="b-name"
                placeholder="e.g. Batch A — Morning"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="b-timing">Timing</Label>
              <Input
                id="b-timing"
                placeholder="e.g. 7:00 AM – 1:00 PM"
                value={form.timing}
                onChange={(e) => setForm({ ...form, timing: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="b-cap">Capacity *</Label>
              <Input
                id="b-cap"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="b-year">Academic Year</Label>
              <Input
                id="b-year"
                value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="b-start">Start Date</Label>
              <Input
                id="b-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as BatchStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save Changes" : "Create Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove “{confirmDelete?.name}”. Batches with enrolled
              students cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) remove.mutate(confirmDelete);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
