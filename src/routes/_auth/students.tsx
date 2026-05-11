import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStudentsFn } from "@/fns/students";
import { getCoursesFn } from "@/fns/courses";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Loading } from "@/components/app/Loading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { GraduationCap, Search, Download, UserPlus } from "lucide-react";
import { fmtDate, exportCSV } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_auth/students")({ component: Page });

function Page() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [courseId, setCourseId] = useState<string>("all");

  const courses = useQuery({
    queryKey: ["students", "courses-filter"],
    queryFn: () => getCoursesFn({ data: {} }),
  });

  const students = useQuery({
    queryKey: ["students", "list", status, courseId],
    queryFn: () => getStudentsFn({ data: { status: status === "all" ? undefined : status, courseId: courseId === "all" ? undefined : courseId } }),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return students.data || [];
    return (students.data || []).filter(
      (s: any) =>
        s.full_name?.toLowerCase().includes(term) ||
        s.admission_number?.toLowerCase().includes(term) ||
        s.mobile?.toLowerCase().includes(term)
    );
  }, [students.data, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Students"
        description="Search and filter all enrolled students."
        actions={
          <>
            <Button variant="outline" size="sm" disabled={!filtered.length} onClick={() => exportCSV(`students_${Date.now()}.csv`, filtered.map((s: any) => ({
              admission_number: s.admission_number, full_name: s.full_name, mobile: s.mobile,
              course: s.courses?.name, batch: s.batches?.name, class_year: s.class_year,
              admission_date: s.admission_date, status: s.status,
            })))}>
              <Download className="h-4 w-4" /> Export
            </Button>
            {isAdmin && (
              <Link to="/enroll"><Button size="sm"><UserPlus className="h-4 w-4" /> Enrol Student</Button></Link>
            )}
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, admission no, mobile…" className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {(courses.data || []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {students.isLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students found"
          description="Adjust filters or enroll a new student to get started."
          action={isAdmin ? <Link to="/enroll"><Button><UserPlus className="h-4 w-4" /> Enrol Student</Button></Link> : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Course / Batch</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">
                        <Link to="/students/$studentId" params={{ studentId: s.id }} className="underline-offset-2 hover:underline">
                          {s.admission_number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link to="/students/$studentId" params={{ studentId: s.id }} className="hover:underline">
                          {s.full_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>{s.courses?.name}</div>
                        <div className="text-xs text-muted-foreground">{s.batches?.name}</div>
                      </TableCell>
                      <TableCell>{s.class_year}</TableCell>
                      <TableCell>{s.mobile}</TableCell>
                      <TableCell className="text-sm">{fmtDate(s.admission_date)}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
