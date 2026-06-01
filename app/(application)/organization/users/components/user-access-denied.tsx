import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UserAccessDeniedProps {
  title?: string;
  description?: string;
}

export function UserAccessDenied({
  title = "Access denied",
  description = "You do not have permission to access user management.",
}: Readonly<UserAccessDeniedProps>) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/organization/payment-types">Back to Organization</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
