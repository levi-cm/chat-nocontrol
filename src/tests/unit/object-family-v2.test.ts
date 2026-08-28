import { describe, expect, it } from "vitest";
import { ObjectFamilyV2, isObjectFamilyV2 } from "../../protocol/types-v2";

describe("Cat-5 object-family discriminator", () => {
  it("is runtime frozen and names 0x03 CompactText", () => {
    expect(Object.isFrozen(ObjectFamilyV2)).toBe(true);
    expect(ObjectFamilyV2.CompactText).toBe(0x03);
    expect("QrText" in ObjectFamilyV2).toBe(false);
    expect(Reflect.set(ObjectFamilyV2, "CompactText", 0x7f)).toBe(false);
    expect(ObjectFamilyV2.CompactText).toBe(0x03);
  });

  it("accepts only the six fixed numeric values", () => {
    expect(Object.values(ObjectFamilyV2)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const value of Object.values(ObjectFamilyV2)) {
      expect(isObjectFamilyV2(value)).toBe(true);
    }
    for (const value of [-1, 0, 7, 255, 1.5, Number.NaN]) {
      expect(isObjectFamilyV2(value)).toBe(false);
    }
  });
});
