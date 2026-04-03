import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("프로젝트 메타데이터", () => {
  it("package.json에 test 스크립트가 있다", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts?: { test?: string } };
    expect(pkg.scripts?.test).toBeDefined();
  });

  it("package.json에 vitest가 devDependencies에 있다", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { devDependencies?: Record<string, string> };
    expect(pkg.devDependencies?.vitest).toBeDefined();
  });

  it("tsconfig.json paths가 src/를 가리킨다", () => {
    const ts = JSON.parse(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
    ) as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    expect(ts.compilerOptions?.paths?.["@/*"]).toEqual(["./src/*"]);
  });
});
