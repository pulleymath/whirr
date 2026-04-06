import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("public/audio-processor.js 계약", () => {
  it("PCM 16kHz mono 워클릿 필수 식별자를 포함한다", () => {
    const src = fs.readFileSync(
      path.join(root, "public/audio-processor.js"),
      "utf8",
    );
    expect(src).toMatch(/AudioWorkletProcessor/);
    expect(src).toMatch(/registerProcessor/);
    expect(src).toMatch(/pcm-capture/);
    expect(src).toMatch(/16000/);
    expect(src).toMatch(/Int16Array/);
    expect(src.toLowerCase()).toMatch(/mono|downmix|channel/);
  });
});
