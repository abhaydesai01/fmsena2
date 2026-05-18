import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  PRIVILEGES_BY_ROLE,
  roleLabel,
  type AppRole,
  type Privileges,
  type PrivilegeKey,
} from "@/lib/permissions";
import {
  listUsersFn,
  createUserFn,
  updateUserPrivilegesFn,
  updateUserRoleFn,
  updateUserStatusFn,
} from "@/fns/users";
import { fmtDateTime } from "@/lib/format";
import { getSessionFn } from "@/fns/auth";
import { hasRole } from "@/lib/permissions";

export const Route = createFileRoute("/_auth/users")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session || !hasRole({ role: session.role, privileges: session.privileges }, ["ADMIN"])) {
      throw new Error("Access denied");
    }
  },
  component: Page,
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: "ACTIVE" | "INACTIVE";
  privileges: Privileges;
  lastModifiedBy: string | null;
  lastModifiedByName: string | null;
  lastModifiedAt: string | null;
};

function Page() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [draft, setDraft] = useState<Partial<Privileges>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "ACCOUNTANT" as AppRole,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    forcePasswordReset: true,
  });

  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsersFn(),
    enabled: isAdmin,
  });

  const updateRole = useMutation({
    mutationFn: (payload: { userId: string; role: AppRole }) => updateUserRoleFn({ data: payload }),
    onSuccess: () => {
      toast.success("Role updated. Default privileges applied.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update role"),
  });

  const createUser = useMutation({
    mutationFn: (payload: {
      name: string;
      email: string;
      password: string;
      role: AppRole;
      status: "ACTIVE" | "INACTIVE";
      forcePasswordReset: boolean;
    }) => createUserFn({ data: payload }),
    onSuccess: () => {
      toast.success("User created");
      setAddOpen(false);
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "ACCOUNTANT",
        status: "ACTIVE",
        forcePasswordReset: true,
      });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to create user"),
  });

  const updateStatus = useMutation({
    mutationFn: (payload: { userId: string; status: "ACTIVE" | "INACTIVE" }) =>
      updateUserStatusFn({ data: payload }),
    onSuccess: () => {
      toast.success("User status updated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update status"),
  });

  const updatePrivileges = useMutation({
    mutationFn: (payload: { userId: string; privileges: Partial<Privileges> }) =>
      updateUserPrivilegesFn({ data: payload }),
    onSuccess: () => {
      toast.success("Custom privileges saved");
      setEditing(null);
      setDraft({});
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save privileges"),
  });

  const rows = (users.data as UserRow[] | undefined) ?? [];
  const roleOptions: AppRole[] = ["ADMIN", "ACCOUNTANT", "ENROLLMENT_OFFICER"];
  const allowedForEditing = editing ? PRIVILEGES_BY_ROLE[editing.role] : [];
  const canSaveDraft = useMemo(
    () => editing && Object.keys(draft).some((k) => allowedForEditing.includes(k as PrivilegeKey)),
    [editing, draft, allowedForEditing],
  );

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="User Management" description="Role and privilege assignment." />
        <EmptyState
          icon={ShieldAlert}
          title="Admin access required"
          description="Only administrators can view and modify users."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="User Management"
        description="Assign roles, toggle custom privileges, and manage active status."
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            Add User
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => {
                const isSelf = user?.id === u.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {isSelf && u.role === "ADMIN" ? (
                        <Badge variant="outline">{roleLabel(u.role)}</Badge>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(value) =>
                            updateRole.mutate({ userId: u.id, role: value as AppRole })
                          }
                        >
                          <SelectTrigger className="h-8 w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((role) => (
                              <SelectItem key={role} value={role}>
                                {roleLabel(role)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "ACTIVE" ? "default" : "secondary"}>
                        {u.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastModifiedAt ? (
                        <div>
                          <div>{u.lastModifiedByName || "Unknown"}</div>
                          <div>{fmtDateTime(u.lastModifiedAt)}</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(u);
                            setDraft(u.privileges);
                          }}
                        >
                          Privileges
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSelf && u.role === "ADMIN"}
                          onClick={() =>
                            updateStatus.mutate({
                              userId: u.id,
                              status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                            })
                          }
                        >
                          {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Custom Privileges
            </DialogTitle>
            <DialogDescription>
              {editing ? `${editing.name} · ${roleLabel(editing.role)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            {allowedForEditing.map((privilege) => (
              <label key={privilege} className="flex items-center gap-2 rounded-md border p-2">
                <Checkbox
                  checked={Boolean(draft[privilege])}
                  onCheckedChange={(checked) =>
                    setDraft((prev) => ({ ...prev, [privilege]: Boolean(checked) }))
                  }
                />
                <span className="text-sm">{privilege}</span>
              </label>
            ))}
            {allowedForEditing.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No custom privileges available for this role.
              </p>
            )}
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Changing role resets custom privileges to that role's defaults.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editing || !canSaveDraft || updatePrivileges.isPending}
              onClick={() => {
                if (!editing) return;
                updatePrivileges.mutate({ userId: editing.id, privileges: draft });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Create a user with role defaults. Custom privileges can be adjusted after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div>
              <Label className="mb-1 block text-xs">Name</Label>
              <Input
                value={newUser.name}
                onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Temporary Password</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) => setNewUser((p) => ({ ...p, role: value as AppRole }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Status</Label>
                <Select
                  value={newUser.status}
                  onValueChange={(value) =>
                    setNewUser((p) => ({ ...p, status: value as "ACTIVE" | "INACTIVE" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-md border p-2">
              <Checkbox
                checked={newUser.forcePasswordReset}
                onCheckedChange={(checked) =>
                  setNewUser((p) => ({ ...p, forcePasswordReset: Boolean(checked) }))
                }
              />
              <span className="text-sm">Force password reset on first login</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                createUser.isPending ||
                !newUser.name.trim() ||
                !newUser.email.trim() ||
                newUser.password.length < 6
              }
              onClick={() => createUser.mutate(newUser)}
            >
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
