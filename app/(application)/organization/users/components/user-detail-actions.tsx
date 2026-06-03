"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, LockOpen, Pencil, Shield } from "lucide-react";
import {
  blockUserAccountAction,
  changeUserPasswordAction,
  unblockUserAccountAction,
} from "@/app/actions/user-management-actions";
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
import { Textarea } from "@/components/ui/textarea";
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
  const [accountAction, setAccountAction] = useState<"block" | "unblock" | null>(
    null
  );
  const [accountNote, setAccountNote] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
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

  const handleAccountAction = () => {
    const nextAction = accountAction;

    if (!nextAction) {
      return;
    }

    setAccountError(null);

    startTransition(async () => {
      const result =
        nextAction === "block"
          ? await blockUserAccountAction({
              userId: user.id,
              note: accountNote,
            })
          : await unblockUserAccountAction({
              userId: user.id,
              note: accountNote,
            });

      if (!result.success) {
        setAccountError(result.fieldErrors?.note?.[0] || result.error || "Unable to update account status");
        return;
      }

      toast({
        title:
          nextAction === "block" ? "Account blocked" : "Account unblocked",
        description:
          result.message ||
          `${user.displayName} has been ${nextAction === "block" ? "blocked" : "unblocked"}.`,
        variant: "success",
      });
      setAccountNote("");
      setAccountError(null);
      setAccountAction(null);
      router.refresh();
    });
  };

  const isBlockAction = accountAction === "block";

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

        {canUpdate && (
          <Button
            variant={user.isBlocked ? "secondary" : "destructive"}
            className={
              user.isBlocked
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : undefined
            }
            onClick={() => {
              setAccountNote("");
              setAccountError(null);
              setAccountAction(user.isBlocked ? "unblock" : "block");
            }}
          >
            {user.isBlocked ? (
              <LockOpen className="h-4 w-4" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            {user.isBlocked ? "Unblock Account" : "Block Account"}
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

      <Dialog
        open={accountAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAccountAction(null);
            setAccountNote("");
            setAccountError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isBlockAction ? "Block User Account" : "Unblock User Account"}
            </DialogTitle>
            <DialogDescription>
              {isBlockAction
                ? `Block ${user.displayName} from receiving MFA codes and completing sign-in.`
                : `Restore MFA access for ${user.displayName}.`}
              {" "}
              A note is required for the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-note">Note</Label>
              <Textarea
                id="account-note"
                value={accountNote}
                onChange={(event) => setAccountNote(event.target.value)}
                placeholder={
                  isBlockAction
                    ? "Explain why this account is being blocked"
                    : "Explain why this account is being unblocked"
                }
                rows={4}
              />
            </div>

            {accountError && (
              <p className="text-sm text-destructive">{accountError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAccountAction(null);
                setAccountNote("");
                setAccountError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant={isBlockAction ? "destructive" : "default"}
              className={
                isBlockAction
                  ? undefined
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }
              onClick={handleAccountAction}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isBlockAction ? "Block Account" : "Unblock Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
