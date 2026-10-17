import { describe, it, expect } from "vitest";
import { alertAirlockStatus } from "./alert-status";

describe("alert Airlock status precedence", () => {
  it("any injection wins", () => expect(alertAirlockStatus(["clean", "unverified", "suspicious", "injection"])).toBe("quarantined"));
  it("unverified beats suspicious and clean", () => expect(alertAirlockStatus(["clean", "suspicious", "unverified"])).toBe("unverified"));
  it("suspicious beats clean", () => expect(alertAirlockStatus(["clean", "suspicious"])).toBe("suspicious"));
  it("clean only when every field is verified clean", () => expect(alertAirlockStatus(["clean", "clean"])).toBe("clean"));
  it("unverified is never saved as clean", () => {
    expect(alertAirlockStatus(["unverified"])).toBe("unverified");
    expect(alertAirlockStatus(["clean", "unverified"])).not.toBe("clean");
  });
  it("no scanned fields is not clean", () => expect(alertAirlockStatus([])).toBe("unverified"));
});
