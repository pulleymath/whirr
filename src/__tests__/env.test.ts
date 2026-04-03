import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe(".env.example", () => {
  it("파일이 존재한다", () => {
    expect(fs.existsSync(path.join(root, ".env.example"))).toBe(true);
  });

  it("ASSEMBLYAI_API_KEY가 정의되어 있다", () => {
    const raw = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    expect(raw).toMatch(/ASSEMBLYAI_API_KEY=/);
  });

  it("NEXT_PUBLIC_ 접두사를 사용하지 않는다", () => {
    const raw = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    expect(raw).not.toMatch(/NEXT_PUBLIC_/);
  });
});
