import { describe, expect, it } from "vitest";
import {
  getWatermark,
  pullWatermarkKey,
  pushWatermarkKey,
  setWatermark,
  type KeyValueStore,
} from "../watermarks";

class MemoryKV implements KeyValueStore {
  map = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
}

describe("watermarks", () => {
  it("falls back to 0 when absent", async () => {
    const kv = new MemoryKV();
    expect(await getWatermark(kv, "missing")).toBe(0);
    expect(await getWatermark(kv, "missing", 42)).toBe(42);
  });

  it("persists and reads back", async () => {
    const kv = new MemoryKV();
    await setWatermark(kv, "k", 123456789);
    expect(await getWatermark(kv, "k")).toBe(123456789);
  });

  it("ignores corrupt values", async () => {
    const kv = new MemoryKV();
    await kv.set("bad", "not-a-number");
    expect(await getWatermark(kv, "bad")).toBe(0);
  });

  it("namespaces push/pull cursors per table and account", () => {
    expect(pushWatermarkKey("solves", "uid-a")).toBe("sync_watermark_push_solves_uid-a");
    expect(pushWatermarkKey("solves", "uid-b")).not.toBe(pushWatermarkKey("solves", "uid-a"));
    expect(pushWatermarkKey("solves", "uid-a")).not.toBe(pullWatermarkKey("solves", "uid-a"));
    expect(pullWatermarkKey("sessions", "uid-a")).not.toBe(pullWatermarkKey("solves", "uid-a"));
  });
});
