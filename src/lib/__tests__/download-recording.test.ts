/** @vitest-environment happy-dom */
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRecordingZipBlob,
  downloadRecordingAudio,
  downloadRecordingZip,
  triggerBlobDownload,
} from "../download-recording";

describe("download-recording", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("triggerBlobDownload 호출 시 앵커 엘리먼트를 생성하고 클릭한다", () => {
    const blob = new Blob(["test"], { type: "text/plain" });
    const createObjectURL = vi.fn().mockReturnValue("blob:url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    const linkClick = vi.fn();
    const spy = vi.spyOn(document, "createElement").mockReturnValue({
      set href(_val: string) {},
      set download(_val: string) {},
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

  describe("downloadRecordingAudio", () => {
    it("단일 WebM Blob을 지정 파일명으로 다운로드한다", () => {
      const createObjectURL = vi.fn().mockReturnValue("blob:url");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
      const linkClick = vi.fn();
      const anchor = {
        set href(_val: string) {},
        set download(val: string) {
          expect(val).toBe("my-session-audio.webm");
        },
        click: linkClick,
        style: {},
        ownerDocument: document,
        parentNode: null,
        childNodes: [],
      };
      vi.spyOn(document, "createElement").mockReturnValue(
        anchor as unknown as HTMLElement,
      );

      const blob = new Blob(["audio"], { type: "audio/webm" });
      downloadRecordingAudio(blob, "my-session");

      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(linkClick).toHaveBeenCalled();
    });

    it("빈 Blob이면 다운로드를 트리거하지 않는다", () => {
      const createObjectURL = vi.fn();
      vi.stubGlobal("URL", {
        createObjectURL,
        revokeObjectURL: vi.fn(),
      });
      downloadRecordingAudio(new Blob([], { type: "audio/webm" }), "x");
      expect(createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe("buildRecordingZipBlob", () => {
    it("단일 세그먼트 zip과 파일명을 반환한다", async () => {
      const blobs = [new Blob(["only"], { type: "audio/webm" })];
      const { zipBlob, filename } = await buildRecordingZipBlob(
        blobs,
        "my-session",
      );

      expect(filename).toBe("my-session-audio.zip");
      expect(zipBlob.type).toBe("application/zip");

      const u8 = new Uint8Array(await zipBlob.arrayBuffer());
      const out = unzipSync(u8);
      const names = Object.keys(out).sort();
      expect(names).toEqual(["my-session-segment-001.webm"]);
      expect(new TextDecoder().decode(out[names[0]!]!)).toBe("only");
    });

    it("여러 세그먼트를 순서대로 zip에 넣는다", async () => {
      const blobs = [
        new Blob(["a"], { type: "audio/webm" }),
        new Blob(["b"], { type: "audio/webm" }),
      ];
      const { zipBlob, filename } = await buildRecordingZipBlob(blobs, "sess");

      expect(filename).toBe("sess-audio.zip");

      const u8 = new Uint8Array(await zipBlob.arrayBuffer());
      const out = unzipSync(u8);
      const names = Object.keys(out).sort();
      expect(names).toEqual(["sess-segment-001.webm", "sess-segment-002.webm"]);
      expect(new TextDecoder().decode(out["sess-segment-001.webm"]!)).toBe("a");
      expect(new TextDecoder().decode(out["sess-segment-002.webm"]!)).toBe("b");
    });

    it("prefix에 :, /, \\ 및 제어 문자가 있으면 파일명에 안전하게 치환한다", async () => {
      const blobs = [new Blob(["x"], { type: "audio/webm" })];
      const raw = `a:b/c\\d${String.fromCharCode(1)}e`;
      const { zipBlob, filename } = await buildRecordingZipBlob(blobs, raw);

      expect(filename).toBe("a_b_c_d_e-audio.zip");

      const u8 = new Uint8Array(await zipBlob.arrayBuffer());
      const out = unzipSync(u8);
      expect(Object.keys(out).sort()).toEqual(["a_b_c_d_e-segment-001.webm"]);
    });

    it("sanitize 후 빈 문자열이면 recording 폴백을 쓴다", async () => {
      const blobs = [new Blob(["z"], { type: "audio/webm" })];
      const { filename } = await buildRecordingZipBlob(blobs, "  \t  ");
      expect(filename).toBe("recording-audio.zip");
    });

    it("빈 blobs면 오류를 던진다", async () => {
      await expect(buildRecordingZipBlob([])).rejects.toThrow(
        "buildRecordingZipBlob: blobs must be non-empty",
      );
    });
  });

  describe("downloadRecordingZip", () => {
    it("빈 배열이면 다운로드를 트리거하지 않는다", async () => {
      const createObjectURL = vi.fn();
      vi.stubGlobal("URL", {
        createObjectURL,
        revokeObjectURL: vi.fn(),
      });
      await downloadRecordingZip([], "x");
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it("비어 있지 않으면 triggerBlobDownload를 한 번 호출한다", async () => {
      const createObjectURL = vi.fn().mockReturnValue("blob:url");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
      vi.spyOn(document, "createElement").mockReturnValue({
        set href(_val: string) {},
        set download(_val: string) {},
        click: vi.fn(),
        style: {},
        ownerDocument: document,
        parentNode: null,
        childNodes: [],
      } as unknown as HTMLElement);

      const blobs = [new Blob(["z"], { type: "audio/webm" })];
      await downloadRecordingZip(blobs, "one");

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const passedBlob = createObjectURL.mock.calls[0]![0] as Blob;
      expect(passedBlob.type).toBe("application/zip");
      const u8 = new Uint8Array(await passedBlob.arrayBuffer());
      const out = unzipSync(u8);
      expect(Object.keys(out).sort()).toEqual(["one-segment-001.webm"]);
    });
  });
});
