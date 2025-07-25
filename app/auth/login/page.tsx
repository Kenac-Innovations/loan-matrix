"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockIcon, ShieldIcon, ServerIcon, AlertCircle } from "lucide-react";
import { LoanSystemLogo } from "@/components/ui/loan-system-logo";
import { Globe } from "@/components/magicui/globe";
import { useEffect, useRef, useState } from "react";
import { Particles } from "@/components/magicui/particles";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Meteors } from "@/components/magicui/meteors";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Username and password are required");
      return;
    }

    setIsLoading(true);

    try {
      const success = await login(username, password);

      if (success) {
        router.push("/dashboard");
      } else {
        setError("Invalid username or password");
      }
    } catch (err) {
      setError("An error occurred during login");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#020b14] overflow-hidden relative">
      {/* Star Field Animation */}
      {/* <Particles /> */}

      {/* Globe Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-30">
        <Meteors number={10} />
        <Particles />
        <div className="absolute inset-0 translate-x-[200px]">
          <Globe />
        </div>
      </div>

      {/* Left side - Image and Marketing */}
      <div className="hidden md:block md:w-1/2 relative z-10">
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-12 mx-auto max-w-4xl">
          <div>
            <Image
              src="/kenac_logo.png"
              alt="Kenac Logo"
              width={150}
              height={150}
            />
          </div>

          <div className="space-y-8 max-w-md">
            <div className="space-y-2">
              <p className="text-[#2a9fff] text-lg font-medium">
                Let's put Security everywhere
              </p>
              <p className="text-white text-lg">
                Empowering Secure Lending, Everywhere.
              </p>
            </div>

            <h2 className="text-6xl font-bold text-white leading-tight">
              LOAN
              <br />
              MATRIX
            </h2>

            <div className="relative translate-x-[200px]">
              <div className="absolute -right-40 -top-20 w-80 h-80">
                <div className="absolute inset-0 border-2 border-[#2a9fff]/30 rounded-full animate-[spin_30s_linear_infinite]"></div>
                <div className="absolute inset-4 border border-[#2a9fff]/20 rounded-full animate-[spin_20s_linear_infinite_reverse]"></div>
                <div className="absolute inset-10 border border-[#2a9fff]/10 rounded-full animate-[spin_25s_linear_infinite]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 bg-[#041e42]/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <LockIcon className="h-16 w-16 text-[#2a9fff]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="flex flex-col items-center bg-[#041e42]/50 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 hover:bg-[#041e42]/70 border border-[#2a9fff]/20">
                <ShieldIcon className="h-8 w-8 text-[#2a9fff] mb-2" />
                <span className="text-white text-sm font-medium text-center">
                  Enterprise Security
                </span>
              </div>
              <div className="flex flex-col items-center bg-[#041e42]/50 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 hover:bg-[#041e42]/70 border border-[#2a9fff]/20">
                <ServerIcon className="h-8 w-8 text-[#2a9fff] mb-2" />
                <span className="text-white text-sm font-medium text-center">
                  Advanced Analytics
                </span>
              </div>
              <div className="flex flex-col items-center bg-[#041e42]/50 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 hover:bg-[#041e42]/70 border border-[#2a9fff]/20">
                <svg
                  className="h-8 w-8 text-[#2a9fff] mb-2"
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
                <span className="text-white text-sm font-medium text-center">
                  Compliance Ready
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button className="bg-transparent border border-[#2a9fff] text-white hover:bg-[#2a9fff]/20 transition-all duration-300">
              LOAN MANAGEMENT
            </Button>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex flex-col justify-center items-center p-6 md:p-12 lg:p-16 w-full md:w-1/2 relative z-10">
        <div className="w-full max-w-md space-y-8 mx-auto">
          <div className="md:hidden flex justify-center mb-8">
            <LoanSystemLogo className="h-12 w-auto" />
          </div>

          <div className="text-center space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Secure Login
            </h1>
            <p className="text-[#2a9fff]">Access your account to continue</p>
          </div>

          <Card className="w-full shadow-xl border-[#2a9fff]/20 overflow-hidden transition-all duration-300 hover:border-[#2a9fff]/40 bg-[#041e42]/70 backdrop-blur-sm">
            <CardContent className="p-8 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-sm font-medium text-white"
                  >
                    Username
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      className="pl-10 py-6 bg-[#020b14] border-[#2a9fff]/30 focus:border-[#2a9fff] focus:ring-[#2a9fff] transition-all duration-200 text-white"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#2a9fff]"
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-sm font-medium text-white"
                    >
                      Password
                    </Label>
                    <Link
                      href="/reset-password"
                      className="text-xs text-[#2a9fff] hover:text-[#5eb8ff] font-medium transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      className="pl-10 py-6 bg-[#020b14] border-[#2a9fff]/30 focus:border-[#2a9fff] focus:ring-[#2a9fff] transition-all duration-200 text-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#2a9fff]" />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="rounded border-[#2a9fff]/30 text-[#2a9fff] focus:ring-[#2a9fff] h-4 w-4 bg-[#020b14]"
                  />
                  <label htmlFor="remember" className="text-sm text-white">
                    Remember me for 30 days
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full py-6 bg-[#2a9fff] hover:bg-[#1d8ae6] text-white font-medium rounded-md transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-[#2a9fff]/20 flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span>SIGNING IN...</span>
                  ) : (
                    <>
                      <span>SIGN IN</span>
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
            </CardContent>
            <BorderBeam
              duration={8}
              size={100}
              className="from-transparent via-red-500 to-transparent"
            />
          </Card>

          <div className="flex items-center justify-center space-x-2 pt-4">
            <div className="p-2 rounded-full bg-[#041e42]">
              <svg
                className="h-4 w-4 text-[#2a9fff]"
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
            <span className="text-sm text-[#2a9fff]">
              Secure, encrypted connection
            </span>
          </div>

          <div className="text-center text-sm text-[#2a9fff]/70 pt-4">
            © 2025 Enterprise Loan Management System. All rights reserved.
            <div className="flex justify-center space-x-4 mt-2">
              <Link
                href="/terms"
                className="text-[#2a9fff] hover:text-[#5eb8ff] text-xs"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="text-[#2a9fff] hover:text-[#5eb8ff] text-xs"
              >
                Privacy
              </Link>
              <Link
                href="/support"
                className="text-[#2a9fff] hover:text-[#5eb8ff] text-xs"
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
