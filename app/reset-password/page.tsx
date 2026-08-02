"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Loader2,
  LockIcon,
  ServerIcon,
  ShieldIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Globe } from "@/components/magicui/globe";
import { Meteors } from "@/components/magicui/meteors";
import { Particles } from "@/components/magicui/particles";
import { ThemeAwareLogo } from "@/components/ui/theme-aware-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { PASSWORD_REQUIREMENTS } from "@/shared/password-policy";

type ResetStep = "request" | "verify" | "complete" | "done";
const PASSWORD_RESET_CODE_LENGTH = 6;

function emptyCodeDigits() {
  return Array.from({ length: PASSWORD_RESET_CODE_LENGTH }, () => "");
}

export default function ResetPasswordPage() {
  const [step, setStep] = useState<ResetStep>("request");
  const [username, setUsername] = useState("");
  const [codeDigits, setCodeDigits] = useState<string[]>(() => emptyCodeDigits());
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [deliveryDescription, setDeliveryDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const code = codeDigits.join("");
  const passwordRequirementScore = PASSWORD_REQUIREMENTS.filter(({ test }) =>
    test(password)
  ).length;
  const passwordMeetsRequirements =
    passwordRequirementScore === PASSWORD_REQUIREMENTS.length;
  const passwordsMatch =
    repeatPassword.length > 0 && password === repeatPassword;

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

  useEffect(() => {
    if (step === "verify") {
      window.requestAnimationFrame(() => {
        digitRefs.current[0]?.focus();
      });
    }
  }, [step]);

  const focusDigit = (index: number) => {
    const nextIndex = Math.max(
      0,
      Math.min(index, PASSWORD_RESET_CODE_LENGTH - 1)
    );
    digitRefs.current[nextIndex]?.focus();
    digitRefs.current[nextIndex]?.select();
  };

  const applyDigits = (startIndex: number, value: string) => {
    const sanitized = value
      .replace(/\D/g, "")
      .slice(0, PASSWORD_RESET_CODE_LENGTH - startIndex);

    if (!sanitized) {
      setCodeDigits((current) => {
        const next = [...current];
        next[startIndex] = "";
        return next;
      });
      return;
    }

    setCodeDigits((current) => {
      const next = [...current];
      sanitized.split("").forEach((digit, offset) => {
        next[startIndex + offset] = digit;
      });
      return next;
    });

    const focusIndex = Math.min(
      startIndex + sanitized.length,
      PASSWORD_RESET_CODE_LENGTH - 1
    );
    window.requestAnimationFrame(() => {
      focusDigit(focusIndex);
    });
  };

  const handleDigitChange = (index: number, value: string) => {
    setError("");
    setMessage("");
    applyDigits(index, value);
  };

  const handleDigitKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusDigit(index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusDigit(index + 1);
      return;
    }

    if (event.key !== "Backspace") {
      return;
    }

    event.preventDefault();
    setError("");
    setMessage("");

    setCodeDigits((current) => {
      const next = [...current];

      if (next[index]) {
        next[index] = "";
        return next;
      }

      if (index > 0) {
        next[index - 1] = "";
        window.requestAnimationFrame(() => {
          focusDigit(index - 1);
        });
      }

      return next;
    });
  };

  const handleDigitPaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>
  ) => {
    event.preventDefault();
    setError("");
    setMessage("");
    applyDigits(index, event.clipboardData.getData("text"));
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
      setCodeDigits(emptyCodeDigits());
      setMessage("A new verification code has been sent.");
      window.requestAnimationFrame(() => {
        focusDigit(0);
      });
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
    <div className="min-h-screen flex flex-col md:flex-row bg-background overflow-x-hidden relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-90">
        <Meteors number={10} />
        <Particles />
        <div className="absolute inset-0 translate-x-[200px]">
          <Globe />
        </div>
      </div>

      <div className="hidden md:block md:w-1/2 relative z-10">
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-12 mx-auto max-w-4xl">
          <div>
            <ThemeAwareLogo width={150} height={150} />
          </div>

          <div className="space-y-8 max-w-md">
            <div className="space-y-2">
              <p className="text-blue-500 text-lg font-medium">
                Let&apos;s put Security everywhere
              </p>
              <p className="text-foreground text-lg">
                Empowering Secure Lending, Everywhere.
              </p>
            </div>

            <h2 className="text-6xl font-bold text-foreground leading-tight">
              LOAN
              <br />
              MATRIX
            </h2>

            <div className="relative translate-x-[200px]">
              <div className="absolute -right-40 -top-20 w-80 h-80">
                <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full animate-[spin_30s_linear_infinite]"></div>
                <div className="absolute inset-4 border border-blue-500/20 rounded-full animate-[spin_20s_linear_infinite_reverse]"></div>
                <div className="absolute inset-10 border border-blue-500/10 rounded-full animate-[spin_25s_linear_infinite]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 bg-card/50 backdrop-blur-sm rounded-lg flex items-center justify-center border border-border">
                    <LockIcon className="h-16 w-16 text-blue-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="flex flex-col items-center bg-card/50 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 hover:bg-card/70 border border-border">
                <ShieldIcon className="h-8 w-8 text-blue-500 mb-2" />
                <span className="text-foreground text-sm font-medium text-center">
                  Enterprise Security
                </span>
              </div>
              <div className="flex flex-col items-center bg-card/50 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 hover:bg-card/70 border border-border">
                <ServerIcon className="h-8 w-8 text-blue-500 mb-2" />
                <span className="text-foreground text-sm font-medium text-center">
                  Advanced Analytics
                </span>
              </div>
              <div className="flex flex-col items-center bg-card/50 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 hover:bg-card/70 border border-border">
                <svg
                  className="h-8 w-8 text-blue-500 mb-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-foreground text-sm font-medium text-center">
                  Compliance Ready
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              className="border-blue-500 text-foreground hover:bg-blue-500/20 transition-all duration-300"
            >
              LOAN MANAGEMENT
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center p-6 md:p-12 lg:p-16 w-full md:w-1/2 relative z-10">
        <div className="w-full max-w-md space-y-8 mx-auto">
          <div className="md:hidden flex justify-center mb-8">
            <ThemeAwareLogo width={120} height={40} className="h-12 w-auto" />
          </div>

          <Card className="w-full shadow-xl border-border overflow-hidden transition-all duration-300 hover:border-blue-500/40 bg-card/70 backdrop-blur-sm">
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Reset your password
                </h1>
                <p className="text-blue-500">
                  {step === "request" && "Enter your username to continue"}
                  {step === "verify" && `Enter the code sent to ${deliveryDescription}.`}
                  {step === "complete" && "Choose a new password for your account."}
                  {step === "done" && "Your password has been changed."}
                </p>
              </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            {message && step !== "done" && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 text-sm text-blue-500">
                {message}
              </div>
            )}

            {step === "request" && (
              <form onSubmit={submitRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-sm font-medium text-foreground"
                  >
                    Username
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Enter your username"
                      autoComplete="username"
                      className="pl-10 py-6 bg-background border-border focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-foreground"
                      required
                    />
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-blue-500/20 flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>SENDING CODE...</span>
                    </>
                  ) : (
                    <span>SEND VERIFICATION CODE</span>
                  )}
                </Button>
              </form>
            )}

            {step === "verify" && (
              <form onSubmit={verifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="code"
                    className="text-sm font-medium text-foreground"
                  >
                    Verification code
                  </Label>
                  <div className="grid grid-cols-6 gap-2">
                    {codeDigits.map((digit, index) => (
                      <input
                        key={`password-reset-digit-${index + 1}`}
                        id={index === 0 ? "code" : undefined}
                        ref={(element) => {
                          digitRefs.current[index] = element;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        value={digit}
                        aria-label={`Verification code digit ${index + 1}`}
                        onChange={(event) =>
                          handleDigitChange(index, event.target.value)
                        }
                        onKeyDown={(event) => handleDigitKeyDown(index, event)}
                        onPaste={(event) => handleDigitPaste(index, event)}
                        onFocus={(event) => event.currentTarget.select()}
                        className={cn(
                          "h-14 rounded-md border bg-background text-center text-xl font-semibold text-foreground outline-none transition-all duration-200",
                          "border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                          digit && "border-blue-500"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Type or paste your {PASSWORD_RESET_CODE_LENGTH}-digit verification code.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-blue-500/20 flex items-center justify-center gap-2"
                  disabled={isLoading || code.length !== PASSWORD_RESET_CODE_LENGTH}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>VERIFYING CODE...</span>
                    </>
                  ) : (
                    <span>VERIFY CODE</span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full py-6 border-blue-500 text-foreground hover:bg-blue-500/20 transition-all duration-300"
                  onClick={resendCode}
                  disabled={isLoading}
                >
                  RESEND CODE
                </Button>
              </form>
            )}

            {step === "complete" && (
              <form onSubmit={completeReset} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="new-password"
                    className="text-sm font-medium text-foreground"
                  >
                    New password
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      className="pl-10 pr-12 py-6 bg-background border-border focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-foreground"
                      required
                    />
                    <LockIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="repeat-password"
                    className="text-sm font-medium text-foreground"
                  >
                    Repeat new password
                  </Label>
                  <div className="relative">
                    <Input
                      id="repeat-password"
                      type={showRepeatPassword ? "text" : "password"}
                      value={repeatPassword}
                      onChange={(event) => setRepeatPassword(event.target.value)}
                      autoComplete="new-password"
                      className="pr-12 py-6 bg-background border-border focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-foreground"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowRepeatPassword((current) => !current)
                      }
                      aria-label={
                        showRepeatPassword
                          ? "Hide repeated password"
                          : "Show repeated password"
                      }
                      aria-pressed={showRepeatPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showRepeatPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {repeatPassword && !passwordsMatch && (
                    <p className="text-sm text-red-500">Passwords do not match.</p>
                  )}
                </div>
                <div className="rounded-md border border-border bg-card/50 p-3 text-xs text-muted-foreground">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">Password requirements</p>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {passwordRequirementScore}/{PASSWORD_REQUIREMENTS.length} met
                    </span>
                  </div>
                  <div
                    className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-300"
                      style={{
                        width: `${
                          (passwordRequirementScore / PASSWORD_REQUIREMENTS.length) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <ul className="space-y-1.5">
                    {PASSWORD_REQUIREMENTS.map(({ key, label, test }) => {
                      const isMet = test(password);

                      return (
                        <li
                          key={key}
                          className={cn(
                            "flex items-center gap-2 transition-colors duration-200",
                            isMet ? "text-green-500" : "text-muted-foreground"
                          )}
                        >
                          {isMet ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0" />
                          )}
                          <span>{label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <Button
                  type="submit"
                  className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-blue-500/20 flex items-center justify-center gap-2"
                  disabled={
                    isLoading || !passwordMeetsRequirements || !passwordsMatch
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>CHANGING PASSWORD...</span>
                    </>
                  ) : (
                    <span>CHANGE PASSWORD</span>
                  )}
                </Button>
              </form>
            )}

            {step === "done" && (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                <p className="text-sm text-muted-foreground">{message}</p>
                <Button
                  asChild
                  className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-blue-500/20"
                >
                  <Link href="/auth/login">RETURN TO LOGIN</Link>
                </Button>
              </div>
            )}

            {step !== "done" && (
              <div className="text-center text-sm pt-2">
                <Link
                  href="/auth/login"
                  className="text-blue-500 hover:text-blue-600 font-medium transition-colors"
                >
                  Back to login
                </Link>
              </div>
            )}

            </CardContent>
            <BorderBeam
              duration={8}
              size={100}
              className="from-transparent via-blue-500 to-transparent"
            />
          </Card>

          <div className="flex items-center justify-center space-x-2 pt-4">
            <div className="p-2 rounded-full bg-card border border-border">
              <svg
                className="h-4 w-4 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <span className="text-sm text-blue-500">
              Secure, encrypted connection
            </span>
          </div>

          <div className="text-center text-sm text-muted-foreground pt-4">
            © 2025 Enterprise Loan Management System. All rights reserved.
            <div className="flex justify-center space-x-4 mt-2">
              <Link
                href="/terms"
                className="text-blue-500 hover:text-blue-600 text-xs"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="text-blue-500 hover:text-blue-600 text-xs"
              >
                Privacy
              </Link>
              <Link
                href="/support"
                className="text-blue-500 hover:text-blue-600 text-xs"
              >
                Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
