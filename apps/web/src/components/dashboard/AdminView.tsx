"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, ShieldCheck, Database, Layers3 } from "lucide-react";
import { MetricCard, DataTableCard } from "./shared";

export function AdminView() {
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users?limit=25").then(res => res.json())
  });

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => fetch("/api/roles").then(res => res.json())
  });

  const { data: sitesData } = useQuery({
    queryKey: ["sites"],
    queryFn: () => fetch("/api/sites?limit=25").then(res => res.json())
  });

  const { data: areasData } = useQuery({
    queryKey: ["areas"],
    queryFn: () => fetch("/api/areas?limit=25").then(res => res.json())
  });

  if (usersLoading) return <div className="p-8">Loading admin data...</div>;

  const users = usersData?.data?.items || [];
  const roles = rolesData?.data?.items || [];
  const sites = sitesData?.data?.items || [];
  const areas = areasData?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Users} label="Users" value={users.length} />
        <MetricCard icon={ShieldCheck} label="Roles" value={roles.length} />
        <MetricCard icon={Database} label="Sites" value={sites.length} />
        <MetricCard icon={Layers3} label="Areas" value={areas.length} />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <DataTableCard
          title="Users"
          icon={Users}
          columns={[
            ["user.name", "Name"],
            ["user.email", "Email"],
            ["user.role", "Role"],
            ["user.status", "Status"],
          ]}
          rows={users}
        />
        <DataTableCard
          title="Master Data"
          icon={Database}
          columns={[
            ["name", "Name"],
            ["code", "Code"],
            ["status", "Status"],
          ]}
          rows={sites}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DataTableCard
          title="Areas"
          icon={Layers3}
          columns={[
            ["name", "Area"],
            ["code", "Code"],
            ["minimumSkillLevel", "Min Skill"],
            ["status", "Status"],
          ]}
          rows={areas}
        />
        <DataTableCard
          title="Role Permissions"
          icon={ShieldCheck}
          columns={[
            ["role.name", "Role"],
            ["role.description", "Description"],
          ]}
          rows={roles}
        />
      </div>
    </div>
  );
}
