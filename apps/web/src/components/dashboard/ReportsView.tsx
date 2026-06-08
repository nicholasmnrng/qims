"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Download } from "lucide-react";
import { MetricCard, DataTableCard } from "./shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

export function ReportsView() {
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ["reports_summary"],
    queryFn: () => fetch("/api/reports/dashboard-summary").then(res => res.json())
  });

  const { data: tasksData } = useQuery({
    queryKey: ["reports_tasks"],
    queryFn: () => fetch("/api/reports/task-completion?limit=5").then(res => res.json())
  });

  if (isLoading) return <div className="p-8">Loading reports...</div>;

  const summary = summaryData?.data || {};
  const tasks = tasksData?.data?.items || [];

  // Mock data for Recharts
  const chartData = [
    { name: 'Monday', completed: 12, pending: 4 },
    { name: 'Tuesday', completed: 19, pending: 3 },
    { name: 'Wednesday', completed: 15, pending: 5 },
    { name: 'Thursday', completed: 22, pending: 2 },
    { name: 'Friday', completed: 18, pending: 7 },
  ];

  const exportReport = () => {
    fetch("/api/reports/export-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "task-completion" })
    })
    .then(res => res.json())
    .then(data => {
       toast.success("Export job started. Job ID: " + data.data?.id);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold tracking-tight">Analytics & Reports</h2>
         <Button onClick={exportReport}><Download className="w-4 h-4 mr-2"/> Export Data</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={FileText} label="Active Inspectors" value={summary.activeInspectorsToday || 0} />
        <MetricCard icon={FileText} label="Open Critical" value={summary.openCriticalTasks || 0} />
        <MetricCard icon={FileText} label="SOP Unread" value={summary.sopUnreadCount || 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
             <CardTitle>Task Completion Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                <Bar dataKey="pending" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-muted" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <DataTableCard
          title="Recent Task Reports"
          icon={FileText}
          columns={[
            ["id", "ID"],
            ["title", "Task"],
            ["status", "Status"],
          ]}
          rows={tasks}
        />
      </div>
    </div>
  );
}
