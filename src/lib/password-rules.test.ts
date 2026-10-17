import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  passwordRuleChecks,
  passwordRules,
  passwordRulesMet,
} from "./password-rules";

describe("password rules (issue #60)", () => {
  it("customer rules: length, letter, digit; admin: length only", () => {
    expect(passwordRules("customer").map((r) => r.key)).toEqual([
      "longEnough",
      "hasLetter",
      "hasDigit",
    ]);
    expect(passwordRules("admin").map((r) => r.key)).toEqual(["longEnough"]);
  });

  it("checks report each rule separately", () => {
    const short = passwordRuleChecks("customer", "abc1");
    expect(short).toEqual({ longEnough: false, hasLetter: true, hasDigit: true });
    const noDigit = passwordRuleChecks("customer", "abcdefghij");
    expect(noDigit.longEnough).toBe(true);
    expect(noDigit.hasDigit).toBe(false);
    const noLetter = passwordRuleChecks("customer", "1234567890");
    expect(noLetter.hasLetter).toBe(false);
  });

  it("met only when every rule of the scope passes", () => {
    expect(passwordRulesMet("customer", "abcdefghi1")).toBe(true);
    expect(passwordRulesMet("customer", "abcdefghij")).toBe(false);
    expect(passwordRulesMet("admin", "abcdefghij")).toBe(true);
    expect(passwordRulesMet("admin", "abc")).toBe(false);
    expect(MIN_PASSWORD_LENGTH).toBe(10);
  });
});
