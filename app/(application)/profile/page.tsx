"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Mail,
  Building2,
  Shield,
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SystemRole {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  permissions: string[];
  assignedAt: string;
  assignedBy: string | null;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "One number (0-9)", test: (p) => /[0-9]/.test(p) },
  { label: "One special character (!@#$%^&*)", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [localRoles, setLocalRoles] = useState<SystemRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);

  // Password change state
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Fetch local roles
  useEffect(() => {
    async function fetchLocalRoles() {
      try {
        setRolesLoading(true);
        setRolesError(null);
        const response = await fetch("/api/users/roles");
        
        if (!response.ok) {
          if (response.status === 401) {
            setRolesError("Please login to view your roles");
          } else {
            const data = await response.json();
            setRolesError(data.error || "Failed to fetch roles");
          }
          return;
        }

        const data = await response.json();
        setLocalRoles(data.roles || []);
      } catch (error) {
        console.error("Error fetching roles:", error);
        setRolesError("Failed to fetch roles");
      } finally {
        setRolesLoading(false);
      }
    }

    if (status === "authenticated") {
      fetchLocalRoles();
    }
  }, [status]);

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== repeatPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    // Check all requirements
    const failedRequirements = passwordRequirements.filter((req) => !req.test(password));
    if (failedRequirements.length > 0) {
      setPasswordError("Password does not meet all requirements");
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const response = await fetch("/api/users/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, repeatPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || "Failed to change password");
        return;
      }

      setPasswordSuccess(true);
      setPassword("");
      setRepeatPassword("");
      
      // Clear success message after 5 seconds
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError("Failed to change password. Please try again.");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">
          View your account details and manage your password
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Information Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium">{user?.name || "N/A"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email / Username</p>
                <p className="font-medium">{user?.email || "N/A"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Office</p>
                <p className="font-medium">{(user as any)?.officeName || "N/A"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">User ID (Mifos)</p>
                <p className="font-medium">{(user as any)?.userId || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Mifos Roles (from session) */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Mifos Roles
            </h3>
            <div className="flex flex-wrap gap-2">
              {(user as any)?.roles?.length > 0 ? (
                (user as any).roles.map((role: any) => (
                  <Badge
                    key={role.id}
                    variant="secondary"
                    className="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  >
                    {role.name}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No Mifos roles assigned</p>
              )}
            </div>
          </div>
        </Card>

        {/* System Roles Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            System Roles
          </h2>

          {rolesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rolesError ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{rolesError}</p>
            </div>
          ) : localRoles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Shield className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No system roles assigned
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your administrator to assign roles
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {localRoles.map((role) => (
                <div
                  key={role.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{role.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {role.description || role.name}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {role.name}
                    </Badge>
                  </div>
                  {role.assignedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Assigned: {new Date(role.assignedAt).toLocaleDateString()}
                      {role.assignedBy && ` by ${role.assignedBy}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Change Password Card */}
        <Card className="p-6 md:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </h2>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Repeat Password */}
              <div className="space-y-2">
                <Label htmlFor="repeatPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="repeatPassword"
                    type={showRepeatPassword ? "text" : "password"}
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showRepeatPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Password Requirements:</p>
              <div className="grid gap-1 text-sm">
                {passwordRequirements.map((req, index) => {
                  const passed = password.length > 0 && req.test(password);
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-2 ${
                        password.length > 0
                          ? passed
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {password.length > 0 ? (
                        passed ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )
                      ) : (
                        <div className="h-3 w-3 rounded-full border" />
                      )}
                      {req.label}
                    </div>
                  );
                })}
              </div>
              
              {/* Password match indicator */}
              {repeatPassword.length > 0 && (
                <div
                  className={`flex items-center gap-2 mt-2 ${
                    password === repeatPassword
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {password === repeatPassword ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                  Passwords match
                </div>
              )}
            </div>

            {/* Error Message */}
            {passwordError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">{passwordError}</p>
              </div>
            )}

            {/* Success Message */}
            {passwordSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">Password changed successfully!</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={
                passwordLoading ||
                !password ||
                !repeatPassword ||
                password !== repeatPassword ||
                passwordRequirements.some((req) => !req.test(password))
              }
              className="w-full md:w-auto"
            >
              {passwordLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Changing Password...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Change Password
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
