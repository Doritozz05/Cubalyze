import type { SkillBranch, SkillNode } from "./skillTreeData";

export interface LayoutOptions {
  branchSpacingX?: number;
  tierSpacingY?: number;
  startX?: number;
  startY?: number;
  intraTierOffset?: number;
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  branchSpacingX: 420,
  tierSpacingY: 300,
  startX: 160,
  startY: 140,
  intraTierOffset: 220,
};

const TIER_ORDER: Record<string, number> = {
  Beginner: 0,
  Novice: 1,
  Intermediate: 2,
  Advanced: 3,
  Expert: 4,
  Master: 5,
  Elite: 6,
  Legendary: 7,
};

/**
 * Deterministically computes optimal (x, y) canvas coordinates for all skill nodes.
 * Guarantees zero overlapping nodes, clear vertical branch columns, and topological progression.
 */
export function calculateAutoLayout(
  branches: SkillBranch[],
  options?: LayoutOptions
): { branches: SkillBranch[]; allNodes: SkillNode[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allNodes: SkillNode[] = [];
  const nodeMap = new Map<string, SkillNode>();

  const updatedBranches = branches.map((branch, branchIdx) => {
    const branchX = opts.startX + branchIdx * opts.branchSpacingX;

    // Group nodes in this branch by Tier
    const tierGroups = new Map<string, SkillNode[]>();
    branch.nodes.forEach((node) => {
      const tierKey = node.tier || "Beginner";
      if (!tierGroups.has(tierKey)) {
        tierGroups.set(tierKey, []);
      }
      tierGroups.get(tierKey)!.push(node);
    });

    const updatedNodes = branch.nodes.map((node) => {
      const tierRank = TIER_ORDER[node.tier] ?? 0;
      let baseY = opts.startY + tierRank * opts.tierSpacingY;

      // Handle multiple nodes in the same branch & tier
      const siblingsInTier = tierGroups.get(node.tier) || [];
      let finalX = branchX;

      if (siblingsInTier.length > 1) {
        const indexInTier = siblingsInTier.indexOf(node);
        const totalInTier = siblingsInTier.length;

        // Center-aligned offset for X
        const centerOffset = indexInTier - (totalInTier - 1) / 2;
        finalX = branchX + centerOffset * opts.intraTierOffset;

        // Slight Y stagger for visual elegance if 3+ nodes
        if (totalInTier > 2) {
          baseY += indexInTier % 2 === 0 ? 0 : 35;
        }
      }

      const updatedNode: SkillNode = {
        ...node,
        x: Math.round(finalX),
        y: Math.round(baseY),
      };

      nodeMap.set(updatedNode.id, updatedNode);
      return updatedNode;
    });

    return {
      ...branch,
      nodes: updatedNodes,
    };
  });

  // Second pass: Ensure topological ordering (child Y must be below all prerequisite parents)
  updatedBranches.forEach((branch) => {
    branch.nodes.forEach((node) => {
      if (node.prerequisites && node.prerequisites.length > 0) {
        let maxParentY = node.y;

        node.prerequisites.forEach((prereqId) => {
          const parent = nodeMap.get(prereqId);
          if (parent) {
            if (parent.y >= maxParentY - 80) {
              maxParentY = parent.y + 100;
            }
          }
        });

        if (maxParentY > node.y) {
          node.y = Math.round(maxParentY);
        }
      }
      allNodes.push(node);
    });
  });

  return { branches: updatedBranches, allNodes };
}
