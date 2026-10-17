import { describe, it, expect } from "vitest";
import { formatIST, outcomeTone, presetLabel } from "./format";

describe("format", () => {
  it("formats IST", () => expect(formatIST("2026-10-17T02:38:12.123456Z")).toBe("17 Oct 2026, 08:08 IST"));
  it("asr colours", () => { expect(outcomeTone("asr", 0)).toBe("sealed"); expect(outcomeTone("asr", 6)).toBe("hostile"); });
  it("fp colours", () => { expect(outcomeTone("fp", 0)).toBe("sealed"); expect(outcomeTone("fp", 5)).toBe("warning"); });
  it("detection colours", () => { expect(outcomeTone("det", 100)).toBe("sealed"); expect(outcomeTone("det", 90)).toBe("warning"); });
  it("preset labels", () => { expect(presetLabel("A-B64-1", "base64-encoded", "attack")).toBe("Base64 #1"); expect(presetLabel("B-07", "odd", "benign")).toBe("Benign #7"); });
});
