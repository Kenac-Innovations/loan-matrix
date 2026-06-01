"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Shield } from "lucide-react";
import { changeUserPasswordAction } from "@/app/actions/user-management-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import type { UserDetail } from "@/shared/types/user-management";

interface UserDetailActionsProps {
  user: UserDetail;
  canUpdate: boolean;
}

export function UserDetailActions({
  user,
  canUpdate,
}: Readonly<UserDetailActionsProps>) {
  const router = useRouter();
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handlePasswordChange = () => {
    setPasswordError(null);

    startTransition(async () => {
      const result = await changeUserPasswordAction({
        userId: user.id,
        firstname: user.firstname,
        password,
        repeatPassword,
      });

      if (!result.success) {
        const nextError =
          result.fieldErrors?.password?.[0] ||
          result.fieldErrors?.repeatPassword?.[0] ||
          result.error ||
          "Failed to change password";
        setPasswordError(nextError);
        return;
      }

      toast({
        title: "Password changed",
        description: `Updated password for ${user.displayName}.`,
        variant: "success",
      });
      setPassword("");
      setRepeatPassword("");
      setShowPasswords(false);
      setPasswordError(null);
      setIsPasswordOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {canUpdate && (
          <Button
            variant="outline"
            onClick={() => router.push(`/organization/users/${user.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}

        {canUpdate && (
          <Button variant="secondary" onClick={() => setIsPasswordOpen(true)}>
            <Shield className="h-4 w-4" />
            Change Password
          </Button>
        )}
      </div>

      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Set a new password for {user.displayName}. Use 12-50 characters
              with uppercase, lowercase, number, and special character.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type={showPasswords ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="repeat-password">Repeat Password</Label>
              <Input
                id="repeat-password"
                type={showPasswords ? "text" : "password"}
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
              />
            </div>

            <label className="flex items-center gap-3">
              <Checkbox
                checked={showPasswords}
                onCheckedChange={(checked) => setShowPasswords(checked === true)}
              />
              <span className="text-sm text-muted-foreground">
                Show passwords
              </span>
            </label>

            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPasswordOpen(false);
                setShowPasswords(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handlePasswordChange} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
