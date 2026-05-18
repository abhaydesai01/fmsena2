import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getSessionFn, resetPasswordFn } from "@/fns/auth";

export const Route = createFileRoute("/_auth/reset-password")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
    if (!session.forcePasswordReset) throw redirect({ to: "/dashboard" });
    return { session };
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error("New password must be at least 6 characters");
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
      const result = await resetPasswordFn({ data: { currentPassword, newPassword } });
      if (!result.ok) throw new Error(result.error || "Unable to update password");
      return result;
    },
    onSuccess: () => {
      toast.success("Password updated");
      navigate({ to: "/dashboard" });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to update password");
    },
  });

  return (
    <div className="mx-auto mt-10 w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            Your account requires a password reset before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="current-password" className="mb-1 block text-xs">
              Current Password
            </Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-password" className="mb-1 block text-xs">
              New Password
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirm-password" className="mb-1 block text-xs">
              Confirm New Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={
              submit.isPending ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword ||
              newPassword !== confirmPassword
            }
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
