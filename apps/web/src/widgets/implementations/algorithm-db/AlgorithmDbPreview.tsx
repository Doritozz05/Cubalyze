"use client";

import { useMemo } from "react";
import { getSeedData } from "@cubeforge/algorithm-db";
import { CaseDiagram } from "@/views/Algorithms/components/CaseDiagram";

export function AlgorithmDbPreview() {
  // Select a random OLL case from seed data for preview
  const ollCase = useMemo(() => {
    const { cases } = getSeedData();
    const olls = cases.filter(
      (c) =>
        c.subsetId === "00000000-0000-4000-9000-000000000002" ||
        c.name.toUpperCase().startsWith("OLL"),
    );
    if (olls.length === 0) return cases[0];
    const randomIndex = Math.floor(Math.random() * olls.length);
    return olls[randomIndex] ?? olls[0];
  }, []);

  return (
    <div className="flex size-full items-center justify-center p-1 select-none bg-surface border border-line rounded overflow-hidden">
      <CaseDiagram
        setupScramble={ollCase?.setupScramble}
        style="yellow-gray"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
