import { describe, expect, it } from "vitest";
import {
  attemptToCloudRow,
  cloudRowToAttempt,
  cloudRowToProfile,
  cloudRowToSession,
  cloudRowToSolve,
  cloudRowToTask,
  profileToCloudRow,
  sessionToCloudRow,
  solveToCloudRow,
  taskToCloudRow,
} from "../mappers";
import type { Solve, Session, Profile } from "@cubeforge/models";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const solve: Solve = {
  id: "11111111-2222-3333-4444-555555555555",
  sessionId: "99999999-8888-7777-6666-555555555555",
  timeMs: 12345,
  timestamp: 1700000000000,
  scramble: "R U R'",
  penalty: "none",
  method: "CFOP",
  source: "smart",
  note: "nice",
  moves: [
    { face: "R", direction: 1, cubeTimestamp: 1, hostTimestamp: 2 },
    { face: "U", direction: -1, cubeTimestamp: 3, hostTimestamp: 4 },
  ],
  orientationTimeline: [
    [1, 5],
    [2, 12],
  ],
  analysisEngineVersion: "1.0",
  analysis: "{}",
  puzzleType: "333",
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
};

describe("solve mappers", () => {
  it("round-trips every field including JSON columns", () => {
    const row = solveToCloudRow(solve, UID);
    expect(row.user_id).toBe(UID);
    const back = cloudRowToSolve(row);
    expect(back).toEqual(solve);
  });

  it("carries the cube attribution both ways, one column each", () => {
    const row = solveToCloudRow({ ...solve, cubeId: "item_gan12", cubeLabel: "GAN 12" }, UID);
    expect(row.cube_id).toBe("item_gan12");
    expect(row.cube_label).toBe("GAN 12");

    const back = cloudRowToSolve(row);
    expect(back.cubeId).toBe("item_gan12");
    expect(back.cubeLabel).toBe("GAN 12");
  });

  it("maps a missing cube to NULL, not the string \"undefined\"", () => {
    const row = solveToCloudRow({ ...solve, cubeId: undefined, cubeLabel: undefined }, UID);
    expect(row.cube_id).toBeNull();
    expect(row.cube_label).toBeNull();

    // NULL — and a row pulled before the columns existed — both read back as
    // "no cube", so no history entry ever shows a placeholder name.
    expect(cloudRowToSolve({ ...row, cube_id: null, cube_label: null }).cubeId).toBeUndefined();
    expect(cloudRowToSolve({ ...row, cube_id: null, cube_label: null }).cubeLabel).toBeUndefined();

    const legacyRow = { ...row } as Record<string, unknown>;
    delete legacyRow.cube_id;
    delete legacyRow.cube_label;
    expect(cloudRowToSolve(legacyRow as never).cubeId).toBeUndefined();
    expect(cloudRowToSolve(legacyRow as never).cubeLabel).toBeUndefined();
  });

  it("rounds float times to whole ms so Postgres bigint accepts them", () => {
    // StackMat/BLE timers deliver sub-ms floats (112.729…); the cloud
    // declares time_ms as bigint and rejects floats with 22P02.
    const row = solveToCloudRow(
      { ...solve, timeMs: 112.72999998927116 },
      UID,
    );
    expect(row.time_ms).toBe(113);
  });

  it("handles a PostgREST bigint-as-string row", () => {
    const row = solveToCloudRow(solve, UID);
    // PostgREST serializes bigint columns as strings.
    row.time_ms = String(solve.timeMs);
    row.created_at = String(solve.createdAt!);
    row.updated_at = String(solve.updatedAt!);
    const back = cloudRowToSolve(row);
    expect(back.timeMs).toBe(solve.timeMs);
    expect(back.updatedAt).toBe(solve.updatedAt);
  });

  it("degrades corrupt JSON to empty arrays", () => {
    const row = solveToCloudRow(solve, UID);
    row.moves = "not-json";
    row.orientation_timeline = "nope";
    const back = cloudRowToSolve(row);
    expect(back.moves).toEqual([]);
    expect(back.orientationTimeline).toBeUndefined();
  });
});

describe("session mappers", () => {
  it("round-trips", () => {
    const session: Session = {
      id: "11111111-2222-3333-4444-555555555555",
      name: "Main 3×3",
      createdAt: 1700000000000,
      updatedAt: 1700000005000,
    };
    const back = cloudRowToSession(sessionToCloudRow(session, UID));
    expect(back).toEqual(session);
  });
});

describe("profile mappers", () => {
  it("round-trips declared methods JSON", () => {
    const profile: Profile = {
      userId: UID,
      displayName: "Ada",
      handle: "ada",
      bio: "Speedcuber",
      avatarKind: "photo",
      avatarData: "data:image/png;base64,AAAA",
      mainPuzzle: "333",
      declaredMethods: ["CFOP", "Roux"],
      country: "ES",
      createdAt: 1,
      updatedAt: 2,
    };
    const back = cloudRowToProfile(profileToCloudRow(profile, UID));
    expect(back).toEqual(profile);
  });
});

describe("training task mappers", () => {
  it("round-trips days_of_week", () => {
    const task = {
      id: "task-1",
      title: "Cross drills",
      description: "",
      startDate: "2026-08-21",
      repeat: "weekly" as const,
      daysOfWeek: [1, 3, 5],
      color: "emerald" as const,
      createdAt: new Date(1700000000000).toISOString(),
      updatedAt: 1700000001000,
    };
    const back = cloudRowToTask(taskToCloudRow(task, UID));
    expect(back).toEqual(task);
  });
});

describe("training attempt mappers", () => {
  it("round-trips moves and grade", () => {
    const attempt = {
      id: "att-1",
      exerciseId: "drill",
      methodId: "CFOP",
      phaseId: "cross",
      caseId: "case-1",
      scramble: "R",
      timeMs: 2100,
      verdict: "correct" as const,
      playMode: "manual" as const,
      expectedMoves: ["R", "U"],
      executedMoves: [{ face: "R" as const, direction: 1 as const, cubeTimestamp: 1, hostTimestamp: 2 }],
      tps: 3.2,
      moveCount: 6,
      optimalMoves: 5,
      rotationCount: 1,
      inspectionMs: 800,
      reviewGrade: "good",
      sessionId: "ts-1",
      metricKind: "execution" as const,
      timestamp: 1700000000000,
      updatedAt: 1700000000000,
    };
    const back = cloudRowToAttempt(attemptToCloudRow(attempt, UID));
    expect(back).toEqual(attempt);
  });
});
