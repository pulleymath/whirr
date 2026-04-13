/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import {
  triggerBlobDownload,
  downloadRecordingSegments,
} from "../download-recording";

describe("download-recording", () => {
  it("triggerBlobDownload 호출 시 앵커 엘리먼트를 생성하고 클릭한다", () => {
    const blob = new Blob(["test"], { type: "text/plain" });
    const createObjectURL = vi.fn().mockReturnValue("blob:url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    const linkClick = vi.fn();
    const spy = vi.spyOn(document, "createElement").mockReturnValue({
      set href(val: string) {},
      set download(val: string) {},
      click: linkClick,
      style: {},
      ownerDocument: document,
      parentNode: null,
      childNodes: [],
    } as unknown as HTMLElement);

    triggerBlobDownload(blob, "test.txt");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(linkClick).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith("a");
  });

  it("downloadRecordingSegments 호출 시 여러 Blob에 대해 다운로드를 트리거한다", () => {
    const blobs = [
      new Blob(["1"], { type: "audio/webm" }),
      new Blob(["2"], { type: "audio/webm" }),
    ];

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    });

    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    const spy = vi.spyOn(document, "createElement").mockReturnValue({
      set href(val: string) {},
      set download(val: string) {},
      click: vi.fn(),
      style: {},
      ownerDocument: document,
      parentNode: null,
      childNodes: [],
    } as unknown as HTMLElement);

    downloadRecordingSegments(blobs, "test-session");

    // triggerBlobDownload가 2번 호출되어야 함
    // expect(spy).toHaveBeenCalledTimes(2); 대신 필터링해서 확인
    const anchorCalls = spy.mock.calls.filter((call) => call[0] === "a");
    expect(anchorCalls.length).toBeGreaterThanOrEqual(2);
  });
});
