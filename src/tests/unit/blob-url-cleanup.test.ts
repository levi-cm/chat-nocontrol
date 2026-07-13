import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRevocableObjectUrl,
  downloadBlob,
} from "../../components/media/blob-url";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("blob URL lifecycle", () => {
  it("revokes preview URLs exactly once", () => {
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:preview");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const blob = new Blob(["preview"]);

    const objectUrl = createRevocableObjectUrl(blob);
    expect(objectUrl.url).toBe("blob:preview");
    expect(create).toHaveBeenCalledWith(blob);

    objectUrl.revoke();
    objectUrl.revoke();
    expect(revoke).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:preview");
  });

  it("revokes download URLs after the browser consumes the click", () => {
    vi.useFakeTimers();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:download");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadBlob(new Blob(["download"]), "local.ppxfile");

    expect(click).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:download");
  });
});
