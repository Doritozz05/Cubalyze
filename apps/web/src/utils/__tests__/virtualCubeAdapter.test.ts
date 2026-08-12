import { describe, it, expect } from "vitest";
import { createVirtualCubeAdapter } from "@/utils/virtualCubeAdapter";

describe("createVirtualCubeAdapter", () => {
  it("is always connected (the virtual cube needs no pairing)", () => {
    expect(createVirtualCubeAdapter().isConnected).toBe(true);
  });

  it("requestFacelets is a harmless no-op", async () => {
    await expect(createVirtualCubeAdapter().requestFacelets?.()).resolves.toBeUndefined();
  });

  it("pushMove emits a CubeMoveEvent on moves$", () => {
    const adapter = createVirtualCubeAdapter();
    const seen: { face: string; direction: number }[] = [];
    const sub = adapter.moves$.subscribe((ev) => {
      seen.push({ face: ev.face, direction: ev.direction });
    });

    adapter.pushMove("R", 1);
    adapter.pushMove("U", -1);

    expect(seen).toEqual([
      { face: "R", direction: 1 },
      { face: "U", direction: -1 },
    ]);
    sub.unsubscribe();
  });

  it("pushFacelets emits the snapshot on facelets$", () => {
    const adapter = createVirtualCubeAdapter();
    const seen: string[] = [];
    const sub = adapter.facelets$?.subscribe((f) => seen.push(f));

    adapter.pushFacelets("UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB");

    expect(seen).toHaveLength(1);
    expect(seen[0].startsWith("UUUUUUUUU")).toBe(true);
    sub?.unsubscribe();
  });

  it("pushToken emits the full-notation token on tokens$", () => {
    const adapter = createVirtualCubeAdapter();
    const seen: string[] = [];
    const sub = adapter.tokens$?.subscribe((notation) => seen.push(notation));

    adapter.pushToken("r");
    adapter.pushToken("u'");

    expect(seen).toEqual(["r", "u'"]);
    sub?.unsubscribe();
  });

  it("pushMove and pushToken feed different streams (face events vs wide tokens)", () => {
    const adapter = createVirtualCubeAdapter();
    const moves: { face: string; direction: number }[] = [];
    const tokens: string[] = [];
    const m = adapter.moves$.subscribe((ev) => moves.push({ face: ev.face, direction: ev.direction }));
    const t = adapter.tokens$?.subscribe((notation) => tokens.push(notation));

    adapter.pushMove("R", 1);
    adapter.pushToken("r");

    expect(moves).toEqual([{ face: "R", direction: 1 }]);
    expect(tokens).toEqual(["r"]);
    m.unsubscribe();
    t?.unsubscribe();
  });

  it("pushReset emits the re-seed signal on reset$", () => {
    const adapter = createVirtualCubeAdapter();
    let resets = 0;
    const sub = adapter.reset$?.subscribe(() => {
      resets++;
    });

    adapter.pushReset();
    adapter.pushReset();

    expect(resets).toBe(2);
    sub?.unsubscribe();
  });

  it("unsubscribing stops further emissions", () => {
    const adapter = createVirtualCubeAdapter();
    let count = 0;
    const sub = adapter.reset$?.subscribe(() => {
      count++;
    });

    adapter.pushReset();
    sub?.unsubscribe();
    adapter.pushReset();

    expect(count).toBe(1);
  });
});
