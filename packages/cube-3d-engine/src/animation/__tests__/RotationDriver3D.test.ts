/**
 * RotationDriver3D — the generic pivot machinery behind every puzzle family.
 *
 * These tests use a FAKE family (a "pyraminx-like" slice: diagonal axis,
 * ±120° turns) to prove the driver is family-agnostic: arbitrary axis
 * vectors, custom slice resolution and custom logical-state hooks. The cube's
 * own behavior is covered by the existing RotationEngine/Cube3DEngine suite.
 */
import { describe, expect, it } from 'vitest';
import { Group, Quaternion, Vector3 } from 'three';
import { RotationDriver3D, type RotationHooks3D, type SliceRef3D } from '../RotationDriver3D';

interface TestSlice extends SliceRef3D {
  id: { name: string };
}

const DIAG_AXIS = new Vector3(1, 1, 0).normalize();

function build() {
  const root = new Group();
  const pieceA = new Group();
  const pieceB = new Group();
  pieceA.position.set(1, 0, 0);
  pieceB.position.set(0, 1, 0);
  root.add(pieceA, pieceB);

  const commits: { name: string; angle: number; pieces: number }[] = [];
  const snaps: number[] = [];

  const hooks: RotationHooks3D<TestSlice> = {
    getSlicePieces: (s) => (s.id.name === 'diag' ? [pieceA, pieceB] : []),
    commitSlice: (s, angle, pieces) => {
      commits.push({ name: s.id.name, angle, pieces: pieces.length });
    },
    snapPieces: (pieces) => {
      snaps.push(pieces.length);
    },
  };

  const driver = new RotationDriver3D<TestSlice>(root, hooks);
  const diag: TestSlice = { id: { name: 'diag' }, axis: DIAG_AXIS };

  return { root, pieceA, pieceB, commits, snaps, driver, diag };
}

describe('RotationDriver3D (generic pivot machinery)', () => {
  it('rotates a slice around an arbitrary diagonal axis and runs commit + snap hooks', async () => {
    const { root, pieceA, pieceB, commits, snaps, driver, diag } = build();

    // ±120° around a vertex-like diagonal axis — a pyraminx-style turn.
    const rot = driver.rotate(diag, 120, 0);
    driver.update(10_000);
    await rot;

    // The pieces were reparented to the root after the turn…
    expect(pieceA.parent).toBe(root);
    expect(pieceB.parent).toBe(root);
    // …rotated (quaternion no longer identity)…
    expect(pieceA.quaternion.length()).toBeCloseTo(1, 5);
    expect(pieceA.quaternion.equals(new Quaternion())).toBe(false);
    // …and the family hooks ran in order: commit (with angle + pieces), then snap.
    expect(commits).toEqual([{ name: 'diag', angle: 120, pieces: 2 }]);
    expect(snaps).toEqual([2]);
  });

  it('live twist: setTwistAngle drives the slice, finishTwist commits the angle', async () => {
    const { pieceA, commits, snaps, driver, diag } = build();

    expect(driver.beginTwist(diag)).toBe(true);
    driver.setTwistAngle(60);
    // Mid-twist: nothing committed yet.
    expect(commits).toEqual([]);

    const done = driver.finishTwist(120, 0);
    driver.update(10_000);
    await done;

    expect(commits).toEqual([{ name: 'diag', angle: 120, pieces: 2 }]);
    expect(snaps).toEqual([2]);
    expect(pieceA.quaternion.equals(new Quaternion())).toBe(false);
  });

  it('finishTwist(0) springs back and commits a zero-angle turn (no state change)', async () => {
    const { commits, driver, diag } = build();

    driver.beginTwist(diag);
    driver.setTwistAngle(-45);
    const done = driver.finishTwist(0, 0);
    driver.update(10_000);
    await done;

    expect(commits).toEqual([{ name: 'diag', angle: 0, pieces: 2 }]);
  });

  it('collision: a second rotate on the same pieces snaps the running one first', async () => {
    const { commits, snaps, driver, diag } = build();

    // Start a slow rotation…
    const first = driver.rotate(diag, 120, 10_000);
    // …and immediately rotate the same slice — the running turn must snap.
    const second = driver.rotate(diag, 120, 0);
    driver.update(10_000);
    await Promise.all([first, second]);

    // Two committed turns, never a double-rotation on a live piece.
    expect(commits.length).toBe(2);
    expect(commits.map((c) => c.angle)).toEqual([120, 120]);
    expect(snaps.length).toBe(2);
  });

  it('rejects a second live twist while one is active', () => {
    const { driver, diag } = build();
    expect(driver.beginTwist(diag)).toBe(true);
    expect(driver.isLiveTwistActive()).toBe(true);
    expect(driver.beginTwist(diag)).toBe(false);
  });

  it('flushAll snaps in-flight turns and clears animation state', async () => {
    const { commits, driver, diag } = build();

    void driver.rotate(diag, 120, 10_000);
    expect(driver.isAnimating()).toBe(true);

    driver.flushAll();
    expect(driver.isAnimating()).toBe(false);
    expect(commits).toEqual([{ name: 'diag', angle: 120, pieces: 2 }]);
  });

  it('NaN angles are rejected as no-ops (never corrupt the scene)', async () => {
    const { commits, driver, diag } = build();
    await driver.rotate(diag, Number.NaN, 0);
    expect(commits).toEqual([]);
    expect(driver.isAnimating()).toBe(false);
  });
});
