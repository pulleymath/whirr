import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("프로젝트 구조 (ARCHITECTURE)", () => {
  it("src/app/layout.tsx가 존재한다", () => {
    expect(fs.existsSync(path.join(root, "src/app/layout.tsx"))).toBe(true);
  });

  it("src/app/page.tsx가 존재한다", () => {
    expect(fs.existsSync(path.join(root, "src/app/page.tsx"))).toBe(true);
  });

  it("필수 디렉토리가 존재한다", () => {
    for (const dir of [
      "src/components",
      "src/hooks",
      "src/lib",
      "src/types",
      "src/lib/stt",
    ]) {
      expect(fs.existsSync(path.join(root, dir))).toBe(true);
    }
  });

  it("루트 app/ 디렉토리가 존재하지 않는다", () => {
    expect(fs.existsSync(path.join(root, "app"))).toBe(false);
  });
});
