import { describe, expect, it } from "vitest";
import { assertOwnedRun, canOperate, usageFits, USAGE_LIMITS, validateBundle } from "./operation-policy";

describe("Operation access", () => {
  it("rejects accounts without an assigned operator role", () => { expect(canOperate([])).toBe(false); expect(canOperate(["user"])).toBe(false); });
  it("permits explicitly assigned operators and admins", () => { expect(canOperate(["operator"])).toBe(true); expect(canOperate(["admin"])).toBe(true); });
  it("rejects another account's benchmark", () => { expect(() => assertOwnedRun({ owner_id: "owner", status: "running" }, "other")).toThrow(); });
  it("rejects completed benchmark changes", () => { expect(() => assertOwnedRun({ owner_id: "owner", status: "complete" }, "owner")).toThrow(); });
  it("allows the owner of an active run", () => { expect(() => assertOwnedRun({ owner_id: "owner", status: "running" }, "owner")).not.toThrow(); });
});
describe("Custom usage safeguards", () => {
  it("admits exactly 120 reserved calls in a minute and rejects the next", () => { expect(usageFits(119, 1, USAGE_LIMITS.minute)).toBe(true); expect(usageFits(120, 1, USAGE_LIMITS.minute)).toBe(false); });
  it("admits exactly 1200 reserved calls in a day and rejects the next", () => { expect(usageFits(1199, 1, USAGE_LIMITS.day)).toBe(true); expect(usageFits(1200, 1, USAGE_LIMITS.day)).toBe(false); });
  it("rejects negative and oversized reservations", () => { expect(usageFits(0, -1, 1200)).toBe(false); expect(usageFits(0, 121, 1200)).toBe(false); });
  it("bounds evidence fields, individual size, and total size", () => {
    expect(validateBundle({ event: "ok", user_agent: "test" })).toBe(4);
    expect(() => validateBundle({ event: "a".repeat(8001) })).toThrow();
    expect(() => validateBundle(Object.fromEntries(Array.from({ length: 17 }, (_, i) => [String(i), "a"])))).toThrow();
    expect(() => validateBundle(Object.fromEntries(Array.from({ length: 5 }, (_, i) => [String(i), "a".repeat(8000)])))).toThrow();
  });
});