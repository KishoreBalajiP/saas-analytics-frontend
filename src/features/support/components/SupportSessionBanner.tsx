import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, LogOut, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import {
  consumeSupportExit,
  endSupportSession,
  useSupportSession,
} from "@/lib/auth/supportSession";
import * as supportApi from "@/features/support/api";
import { formatCountdown, secondsUntil } from "@/features/support/lib/countdown";

/**
 * Shown at the top of the tenant portal while a platform support admin
 * views the workspace in a read-only support session: who is acting, as
 * whom, that nothing can be changed, and how long is left. The session ends
 * by itself at zero; "End support session" ends it now.
 */
export function SupportSessionBanner() {
  const local = useSupportSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const ending = useRef(false);

  // The server is the source of truth for the operator and the expiry.
  const server = useQuery({
    queryKey: [...supportApi.supportAccessKeys.current, local?.sessionId ?? null],
    queryFn: supportApi.getCurrentSupportSession,
    enabled: Boolean(local),
    staleTime: 30_000,
    retry: false,
  });

  const finish = useCallback(
    async (outcome: "ended" | "expired" | "revoked") => {
      if (ending.current) return;
      ending.current = true;
      await endSupportSession();
      consumeSupportExit(); // we route back to the console ourselves
      queryClient.clear();
      if (outcome === "expired") toast.info("The support session expired.");
      else if (outcome === "revoked") toast.info("The support session was ended by the workspace.");
      else toast.success("Support session ended.");
      void navigate({ to: "/admin/support" });
    },
    [navigate, queryClient],
  );

  useEffect(() => {
    ending.current = false;
  }, [local?.sessionId]);

  useEffect(() => {
    if (!local) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [local]);

  const expiresAt = server.data?.expiresAt ?? local?.expiresAt ?? null;
  const remaining = secondsUntil(expiresAt, now);

  useEffect(() => {
    if (local && remaining !== null && remaining <= 0) void finish("expired");
  }, [local, remaining, finish]);

  useEffect(() => {
    if (!local) return;
    const error = server.error;
    const endedOnServer =
      (error instanceof ApiError && error.statusCode === 401) ||
      (server.data && server.data.active === false);
    if (endedOnServer) void finish("revoked");
  }, [local, server.error, server.data, finish]);

  if (!local) return null;

  const operator = server.data?.operator?.display ?? local.operator.email ?? "Platform support";
  const viewingAs = server.data?.user?.display ?? local.user.email;
  const breakGlass = server.data?.breakGlass ?? local.breakGlass;

  return (
    <div
      role="status"
      aria-label="Support session"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm lg:px-8"
    >
      <ShieldAlert className="h-4 w-4 text-warning" aria-hidden />
      <span className="font-medium">Support session</span>
      <span className="text-muted-foreground">
        {operator} is viewing this workspace as <span className="font-medium">{viewingAs}</span>
      </span>
      <Badge variant="outline" className="gap-1">
        <Eye className="h-3 w-3" aria-hidden /> Read-only
      </Badge>
      {breakGlass ? <Badge variant="destructive">Break-glass</Badge> : null}
      <span className="tabular-nums text-muted-foreground" aria-label="Time remaining">
        Ends in {remaining === null ? "—" : formatCountdown(remaining)}
      </span>
      <Button size="sm" variant="outline" className="ml-auto" onClick={() => void finish("ended")}>
        <LogOut className="mr-1 h-3.5 w-3.5" /> End support session
      </Button>
    </div>
  );
}
