import { Link } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { useAccess } from "./AccessProvider";
import { Button } from "./ui/button";

export function OperationNotice() {
  const access = useAccess();
  if (access.loading || access.allowed) return null;
  return <div className="flex flex-wrap items-center gap-3 border-y py-3 text-sm text-muted-foreground">
    <LockKeyhole className="h-4 w-4 shrink-0" />
    <span>{access.signedIn ? "Operator approval required. Your account currently has read-only access." : "Read-only demo"}</span>
    <Button asChild variant="outline" size="sm"><Link to="/auth">{access.signedIn ? "Account access" : "Sign in"}</Link></Button>
  </div>;
}