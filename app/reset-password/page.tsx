"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeAwareLogo } from "@/components/ui/theme-aware-logo";
import { ThemeToggle } from "@/components/theme-toggle";

type ResetStep = "request" | "verify" | "complete" | "done";

const passwordRequirements = [
  "At least 12 characters",
  "One uppercase letter",
  "One lowercase letter",
  "One number",
  "One special character",
];

export default function ResetPasswordPage() {
  const [step, setStep] = useState<ResetStep>("request");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [deliveryDescription, setDeliveryDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const callApi = async (path: string, body: Record<string, string>) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }
    return data;
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const data = await callApi("/api/auth/password-reset/request", { username });
      setChallengeId(data.challengeId || "");
      setDeliveryDescription(data.deliveryDescription || "your configured contact");
      setMessage(data.message || "A verification code has been sent.");
      setStep("verify");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to start password reset"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const data = await callApi("/api/auth/password-reset/verify", {
        challengeId,
        code,
      });
      setVerificationToken(data.verificationToken);
      setStep("complete");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Unable to verify the code"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const data = await callApi("/api/auth/password-reset/resend", {
        challengeId,
      });
      setDeliveryDescription(data.deliveryDescription || deliveryDescription);
      setMessage("A new verification code has been sent.");
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Unable to resend the code"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const completeReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const data = await callApi("/api/auth/password-reset/complete", {
        challengeId,
        verificationToken,
        password,
        repeatPassword,
      });
      setMessage(data.message || "Password reset successfully.");
      setStep("done");
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Unable to complete password reset"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full shadow-xl">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <ThemeAwareLogo width={150} height={50} className="h-12 w-auto" />
            </div>
            <div>
              <CardTitle className="text-2xl">Reset your password</CardTitle>
              <CardDescription className="mt-2">
                {step === "request" && "Enter your username to receive a verification code."}
                {step === "verify" && `Enter the code sent to ${deliveryDescription}.`}
                {step === "complete" && "Choose a new password for your account."}
                {step === "done" && "Your password has been changed."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {message && step !== "done" && (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-700">
                {message}
              </div>
            )}

            {step === "request" && (
              <form onSubmit={submitRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send verification code
                </Button>
              </form>
            )}

            {step === "verify" && (
              <form onSubmit={verifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification code</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="text-center text-xl tracking-[0.35em]"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || code.length !== 6}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verify code
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={resendCode} disabled={isLoading}>
                  Resend code
                </Button>
              </form>
            )}

            {step === "complete" && (
              <form onSubmit={completeReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      className="pl-10"
                      required
                    />
                    <LockIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repeat-password">Repeat new password</Label>
                  <Input
                    id="repeat-password"
                    type="password"
                    value={repeatPassword}
                    onChange={(event) => setRepeatPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Password requirements</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {passwordRequirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Change password
                </Button>
              </form>
            )}

            {step === "done" && (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
                <p className="text-sm text-muted-foreground">{message}</p>
                <Button asChild className="w-full">
                  <Link href="/auth/login">Return to login</Link>
                </Button>
              </div>
            )}

            {step !== "done" && (
              <div className="text-center text-sm">
                <Link href="/auth/login" className="text-blue-600 hover:underline">
                  Back to login
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
