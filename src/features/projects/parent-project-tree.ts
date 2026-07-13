import type { ProjectSummary } from "@/features/workspace/workspace-types";

export interface ParentProjectGroup {
  parent: ProjectSummary;
  children: ProjectSummary[];
  rolledIncomeMinor: bigint;
  rolledExpenseMinor: bigint;
  rolledProfitMinor: bigint;
  rolledCapitalMinor: bigint;
  childCount: number;
}

export function groupProjectsByParent(
  projects: readonly ProjectSummary[],
): {
  roots: ParentProjectGroup[];
  orphans: ProjectSummary[];
  standalone: ProjectSummary[];
} {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const childrenByParent = new Map<string, ProjectSummary[]>();

  for (const project of projects) {
    const parentId = project.parentProjectId;
    if (!parentId || !byId.has(parentId)) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(project);
    childrenByParent.set(parentId, list);
  }

  const childIds = new Set(
    [...childrenByParent.values()].flatMap((items) => items.map((item) => item.id)),
  );

  const roots: ParentProjectGroup[] = [];
  const standalone: ProjectSummary[] = [];
  const orphans: ProjectSummary[] = [];

  for (const project of projects) {
    const children = childrenByParent.get(project.id) ?? [];
    if (children.length > 0) {
      const rolledIncomeMinor =
        project.incomeMinor +
        children.reduce((total, child) => total + child.incomeMinor, 0n);
      const rolledExpenseMinor =
        project.expenseMinor +
        children.reduce((total, child) => total + child.expenseMinor, 0n);
      roots.push({
        parent: project,
        children,
        rolledIncomeMinor,
        rolledExpenseMinor,
        rolledProfitMinor: rolledIncomeMinor - rolledExpenseMinor,
        rolledCapitalMinor:
          project.capitalMinor +
          children.reduce((total, child) => total + child.capitalMinor, 0n),
        childCount: children.length,
      });
      continue;
    }

    if (childIds.has(project.id)) continue;

    if (project.parentProjectId && !byId.has(project.parentProjectId)) {
      orphans.push(project);
      continue;
    }

    standalone.push(project);
  }

  return { roots, orphans, standalone };
}
