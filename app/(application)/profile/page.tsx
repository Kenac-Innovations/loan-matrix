"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, Check, Circle, Eye, EyeOff, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMySignature } from "@/app/actions/user-signature-actions";
import { useAuth } from "@/contexts/auth-context";
import { PASSWORD_RULES, validateNewPassword } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

const CURRENT_PASSWORD_REQUIRED = "Enter your current password.";

function getInitials(name: string | null | undefined) {
  const initials = (name ?? "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "U";
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 border-t py-6 md:grid-cols-[200px_1fr]">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: string;
  error?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { logout } = useAuth();

  // Password change state
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Signature state
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureLoading, setSignatureLoading] = useState(true);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  // Load saved signature
  useEffect(() => {
    if (status !== "authenticated") return;
    getMySignature()
      .then(({ signatureData }) => setSignatureData(signatureData))
      .catch(() => setSignatureError("Failed to load signature"))
      .finally(() => setSignatureLoading(false));
  }, [status]);

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setPassword("");
    setRepeatPassword("");
    setShowCurrentPassword(false);
    setShowPassword(false);
    setShowRepeatPassword(false);
    setCurrentPasswordError(null);
    setPasswordError(null);
  };

  const handleCancel = () => {
    resetPasswordForm();
    setPasswordOpen(false);
  };

  const passwordChecks = [
    ...PASSWORD_RULES.map((rule) => ({
      id: rule.id,
      label: rule.label,
      met: password.length > 0 && rule.test(password),
    })),
    {
      id: "match",
      label: "Passwords match",
      met: repeatPassword.length > 0 && password === repeatPassword,
    },
    {
      id: "different",
      label: "Different from current",
      met: password.length > 0 && password !== currentPassword,
    },
  ];
  const passedChecks = passwordChecks.filter((check) => check.met).length;
  const progressPercent = Math.round((passedChecks / passwordChecks.length) * 100);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPasswordError(null);
    setPasswordError(null);

    const validation = validateNewPassword({ currentPassword, password, repeatPassword });
    if (!validation.valid) {
      if (validation.errors[0] === CURRENT_PASSWORD_REQUIRED) {
        setCurrentPasswordError(validation.errors[0]);
      } else {
        setPasswordError(validation.errors[0]);
      }
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch("/api/users/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, password, repeatPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.field === "currentPassword") {
          setCurrentPasswordError(data.error);
        } else {
          setPasswordError(data.error || "Failed to change password");
        }
        return;
      }

      resetPasswordForm();
      setPasswordOpen(false);
      setPasswordSuccess(true);
      // Not cancelled on unmount: the session still holds the old password, so the
      // user must sign in again even if they navigate away.
      setTimeout(() => {
        void logout();
      }, 2500);
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError("Couldn't update your password. Try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Please login to view your profile</p>
      </div>
    );
  }

  const user = session?.user;
  const roles = (user?.roles ?? []).filter((role) => !role.disabled);
  const email = user?.email ?? user?.name;
  const subline = [email, user?.officeName].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Header */}
      <header className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
          {getInitials(user?.name)}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{user?.name || "Your profile"}</h1>
          {subline && <p className="text-sm text-muted-foreground">{subline}</p>}
        </div>
      </header>

      {/* Account */}
      <Section title="Account" hint="Managed by your administrator.">
        <div className="divide-y">
          <InfoRow label="Username" value={user?.name || "N/A"} />
          {user?.email && user.email !== user.name && (
            <InfoRow label="Email" value={user.email} />
          )}
          <InfoRow label="Office" value={user?.officeName || "N/A"} />
          <InfoRow label="User ID" value={user?.userId ? `#${user.userId}` : "N/A"} mono />
        </div>
      </Section>

      {/* Roles */}
      <Section title="Roles" hint="Assigned by your administrator.">
        {roles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <span
                key={role.id}
                title={role.description}
                className="rounded-full border px-2.5 py-0.5 text-xs"
              >
                {role.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No roles assigned.</p>
        )}
      </Section>

      {/* Password */}
      <Section
        title="Password"
        hint="You'll need your current password to set a new one."
      >
        {passwordSuccess ? (
          <p className="text-sm text-green-600 dark:text-green-400">
            Password updated. Signing you out so you can sign in with your new password.
          </p>
        ) : !passwordOpen ? (
          <div className="flex items-center justify-between">
            <span className="text-sm tracking-widest text-muted-foreground">••••••••••</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPasswordOpen(true)}
            >
              Change password
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <PasswordField
              id="current-password"
              label="Current password"
              value={currentPassword}
              onChange={(value) => {
                setCurrentPassword(value);
                setCurrentPasswordError(null);
              }}
              visible={showCurrentPassword}
              onToggleVisible={() => setShowCurrentPassword(!showCurrentPassword)}
              autoComplete="current-password"
              error={currentPasswordError}
            />

            <div className="border-t" />

            <PasswordField
              id="new-password"
              label="New password"
              value={password}
              onChange={setPassword}
              visible={showPassword}
              onToggleVisible={() => setShowPassword(!showPassword)}
              autoComplete="new-password"
            />

            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              value={repeatPassword}
              onChange={setRepeatPassword}
              visible={showRepeatPassword}
              onToggleVisible={() => setShowRepeatPassword(!showRepeatPassword)}
              autoComplete="new-password"
            />

            {/* Strength progress */}
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Checklist */}
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {passwordChecks.map((check) => (
                <li
                  key={check.id}
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    check.met
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground"
                  )}
                >
                  {check.met ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                  {check.label}
                </li>
              ))}
            </ul>

            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={passwordLoading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={passwordLoading}>
                {passwordLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </div>
          </form>
        )}
      </Section>

      {/* Signature */}
      <Section
        title="Signature"
        hint="Used as the loan officer signature on contracts."
      >
        {signatureLoading ? (
          <div className="flex h-32 items-center justify-center rounded-xl border bg-muted/30">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex h-32 items-center justify-center rounded-xl border bg-muted/30">
              {signatureData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signatureData}
                  alt="Your signature"
                  className="max-h-24 rounded bg-white p-2"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <PenLine className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No signature added yet.</p>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Need a change? Ask an administrator to update it.
            </p>
            {signatureError && (
              <p className="mt-2 text-sm text-destructive">{signatureError}</p>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
