import { NextRequest } from "next/server";
import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { requireRole } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { areas, shiftAssignments, skillLevelValues, skillMatrix, users, type SkillLevel } from "@/server/db/schema";
import { eq, ne } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireSession(req);
    requireRole(actor, ["super_admin", "supervisor", "qa_manager"]);

    const inspectors = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.role, "inspector"));

    const [skills, allAreas, activeAssignments] = await Promise.all([
      db.select().from(skillMatrix),
      db.select().from(areas).where(eq(areas.status, "active")),
      db
        .select({ userId: shiftAssignments.userId })
        .from(shiftAssignments)
        .where(ne(shiftAssignments.assignmentStatus, "cancelled")),
    ]);

    const skillRank = new Map<SkillLevel, number>(
      skillLevelValues.map((level, index) => [level, index]),
    );
    const assignmentLoad = activeAssignments.reduce<Record<string, number>>((acc, assignment) => {
      acc[assignment.userId] = (acc[assignment.userId] ?? 0) + 1;
      return acc;
    }, {});

    const recommendations = allAreas.map((area) => {
      const areaSkills = skills
        .filter((skill) => skill.areaId === area.id)
        .sort((a, b) => {
          const skillDiff =
            (skillRank.get(b.skillLevel) ?? 0) - (skillRank.get(a.skillLevel) ?? 0);
          if (skillDiff !== 0) return skillDiff;
          return (assignmentLoad[a.userId] ?? 0) - (assignmentLoad[b.userId] ?? 0);
        });

      const topSkill = areaSkills[0];
      const fallbackInspector = [...inspectors].sort(
        (a, b) => (assignmentLoad[a.id] ?? 0) - (assignmentLoad[b.id] ?? 0),
      )[0];
      const inspectorId = topSkill?.userId ?? fallbackInspector?.id;
      const inspector = inspectors.find((item) => item.id === inspectorId);

      return {
        areaId: area.id,
        areaName: area.name,
        minimumSkillLevel: area.minimumSkillLevel,
        recommendedInspectorId: inspector?.id,
        recommendedInspectorName: inspector?.name,
        currentAssignmentLoad: inspector ? (assignmentLoad[inspector.id] ?? 0) : 0,
        reason: topSkill
          ? `Highest available skill for area (${topSkill.skillLevel}) with current load considered.`
          : "No skill matrix match yet; fallback uses lowest current assignment load.",
        skillLevel: topSkill?.skillLevel ?? "not_trained",
      };
    });

    return ok({ items: recommendations });
  } catch (error) {
    return handleApiError(error);
  }
}
