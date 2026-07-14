import { describe, expect, it } from "vitest";
import { priorityQrCropForImage } from "../../components/qr/image-recovery";

describe("QR image recovery priority crop", () => {
  it("targets the QR square on the generated 4:5 private recovery card", () => {
    expect(priorityQrCropForImage(1024, 1280)).toEqual({
      x: 128,
      y: 256,
      size: 768,
    });
  });

  it("does not assume unrelated image shapes are recovery cards", () => {
    expect(priorityQrCropForImage(1280, 1024)).toBeNull();
    expect(priorityQrCropForImage(1200, 1600)).toBeNull();
  });
});
