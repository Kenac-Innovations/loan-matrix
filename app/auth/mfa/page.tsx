"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  LockIcon,
  ShieldIcon,
  ServerIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Globe } from "@/components/magicui/globe";
import { Particles } from "@/components/magicui/particles";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Meteors } from "@/components/magicui/meteors";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeAwareLogo } from "@/components/ui/theme-aware-logo";
import { MFA_CODE_LENGTH } from "@/shared/constants/mfa";
import type { MfaChannel } from "@/shared/types/tenant";

type ChallengeSummary = {
  id: string;
  username: string;
  channel: MfaChannel;
  maskedDestination: string;
  expiresAt: string;
  resendAvailableAt: string;
  attemptsUsed: number;
  maxAttempts: number;
  remainingAttempts: number;
};

function emptyCodeDigits() {
  return Array.from({ length: MFA_CODE_LENGTH }, () => "");
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function hasActiveSession(
  attempts = 5,
  delayMs = 120
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const currentSession = await getSession();
    if (currentSession) {
      return true;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

export default function MfaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    }>
      <MfaPageContent />
    </Suspense>
  );
}

function MfaPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const challengeId = searchParams.get("challengeId") || "";
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [challenge, setChallenge] = useState<ChallengeSummary | null>(null);
  const [codeDigits, setCodeDigits] = useState<string[]>(() => emptyCodeDigits());
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const code = useMemo(() => codeDigits.join(""), [codeDigits]);
  const resendCountdown = challenge
    ? Math.max(0, new Date(challenge.resendAvailableAt).getTime() - now)
    : 0;
  const expiresCountdown = challenge
    ? Math.max(0, new Date(challenge.expiresAt).getTime() - now)
    : 0;
  const isResendLocked = resendCountdown > 0;
  const showAttemptWarning = (challenge?.attemptsUsed ?? 0) > 0;

  useEffect(() => {
    if (!challengeId) {
      setError("Verification challenge is missing. Please log in again.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadChallenge() {
      try {
        const response = await fetch(
          `/api/auth/mfa/challenge?challengeId=${encodeURIComponent(challengeId)}`
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to load verification challenge");
        }

        if (!cancelled) {
          setChallenge(data.challenge);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load verification challenge"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadChallenge();

    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  useEffect(() => {
    if (!challenge) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [challenge]);

  useEffect(() => {
    if (!loading && challenge) {
      digitRefs.current[0]?.focus();
    }
  }, [loading, challenge]);

  const focusDigit = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, MFA_CODE_LENGTH - 1));
    digitRefs.current[nextIndex]?.focus();
    digitRefs.current[nextIndex]?.select();
  };

  const applyDigits = (startIndex: number, value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, MFA_CODE_LENGTH - startIndex);

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
      MFA_CODE_LENGTH - 1
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

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (code.length !== MFA_CODE_LENGTH) {
      setError(`Enter the ${MFA_CODE_LENGTH}-digit verification code to continue.`);
      return;
    }

    setVerifying(true);

    try {
      const verifyResponse = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          code,
        }),
      });
      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.success) {
        if (
          challenge &&
          typeof verifyData.attemptsUsed === "number" &&
          typeof verifyData.maxAttempts === "number"
        ) {
          setChallenge({
            ...challenge,
            attemptsUsed: verifyData.attemptsUsed,
            maxAttempts: verifyData.maxAttempts,
            remainingAttempts:
              typeof verifyData.remainingAttempts === "number"
                ? verifyData.remainingAttempts
                : Math.max(
                    verifyData.maxAttempts - verifyData.attemptsUsed,
                    0
                  ),
          });
        }

        setCodeDigits(emptyCodeDigits());
        window.requestAnimationFrame(() => {
          focusDigit(0);
        });
        setError(verifyData.error || "Verification failed");
        return;
      }

      const signInResult = await signIn("credentials", {
        challengeId,
        verificationToken: verifyData.verificationToken,
        redirect: false,
        callbackUrl: "/leads",
      });

      if (signInResult?.error && !(await hasActiveSession())) {
        throw new Error("Verification succeeded, but we could not complete sign-in.");
      }

      window.location.href = "/leads";
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Unable to verify the MFA code"
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setMessage("");
    setResending(true);

    try {
      const resendResponse = await fetch("/api/auth/mfa/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });
      const resendData = await resendResponse.json();

      if (!resendResponse.ok || !resendData.success) {
        throw new Error(resendData.error || "Unable to resend the code");
      }

      setChallenge((current) =>
        current
          ? {
              ...current,
              ...resendData.challenge,
            }
          : current
      );
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
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background overflow-hidden relative">
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
                  Multi-Factor Verification
                </h1>
                <p className="text-blue-500">
                  Enter the code to continue signing in
                </p>
                {challenge && (
                  <p className="text-sm text-muted-foreground">
                    {challenge.channel.toUpperCase()} to {challenge.maskedDestination}
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}

              {showAttemptWarning && challenge && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Attempt {challenge.attemptsUsed} of {challenge.maxAttempts}.
                  </p>
                  <p className="mt-1 text-sm text-amber-700/90 dark:text-amber-200">
                    {challenge.remainingAttempts > 0
                      ? `Your account will be blocked once ${challenge.maxAttempts} failed attempts are reached. ${challenge.remainingAttempts} attempt${challenge.remainingAttempts === 1 ? "" : "s"} remaining.`
                      : `Your account will be blocked once ${challenge.maxAttempts} failed attempts are reached.`}
                  </p>
                </div>
              )}

              {message && (
                <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3">
                  <p className="text-sm text-green-600">{message}</p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      Verification Code
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires in {formatCountdown(expiresCountdown)}
                    </p>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {codeDigits.map((digit, index) => (
                      <input
                        key={`mfa-digit-${index + 1}`}
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
                        onChange={(event) => handleDigitChange(index, event.target.value)}
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
                    Type or paste your {MFA_CODE_LENGTH}-digit verification code.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-blue-500/20 flex items-center justify-center gap-2"
                  disabled={verifying || !challengeId || code.length !== MFA_CODE_LENGTH}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>VERIFYING...</span>
                    </>
                  ) : (
                    <>
                      <span>VERIFY AND SIGN IN</span>
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </Button>
              </form>

              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResend}
                  disabled={resending || !challengeId || isResendLocked}
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>RESENDING...</span>
                    </>
                  ) : (
                    <span>
                      {isResendLocked
                        ? `Resend available in ${formatCountdown(resendCountdown)}`
                        : "Resend Code"}
                    </span>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => router.push("/auth/login")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>

                <div className="text-center">
                  <Link
                    href="/auth/login"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Start over with a different account
                  </Link>
                </div>
              </div>
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
