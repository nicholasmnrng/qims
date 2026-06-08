"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useQuery } from "@tanstack/react-query";
import { FileClock, ShieldAlert } from "lucide-react";
import { MetricCard, DataTableCard } from "./shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AuditView() {
  const { data: auditData, isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: () => fetch("/api/audit-logs?limit=50").then(res => res.json())
  });

  if (isLoading) return <div className="p-8">Loading audit logs...</div>;

  const logs = auditData?.data?.items || [];

  return (
    <div className="space-y-6">
      <Alert variant="default" className="bg-muted">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Read-Only Mode</AlertTitle>
        <AlertDescription>
          Audit logs are strictly read-only for compliance reasons. You cannot modify or delete these entries.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={FileClock} label="Total Entries" value={logs.length} />
      </div>

      <DataTableCard
        title="Audit Logs"
        icon={FileClock}
        columns={[
          ["action", "Action"],
          ["entityType", "Entity"],
          ["entityId", "Entity ID"],
          ["createdAt", "Timestamp"],
        ]}
        rows={logs.map((log: any) => ({
          ...log,
          createdAt: new Date(log.createdAt).toLocaleString()
        }))}
        emptyText="No audit logs found."
      />
    </div>
  );
}
