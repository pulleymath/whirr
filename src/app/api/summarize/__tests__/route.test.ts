import { SUMMARIZE_MAX_TEXT_LENGTH } from "@/lib/api/summarize-constants";
import { describe, expect, it } from "vitest";
import { POST } from "../route";

function req(json: unknown) {
  return new Request("http://localhost/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
}

describe("POST /api/summarize", () => {
  it("정상 텍스트면 200과 summary를 반환한다", async () => {
    const res = await POST(req({ text: "hello world" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toContain("hello world");
  });

  it("body가 없으면 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/summarize", { method: "POST" }),
    );
    expect(res.status).toBe(400);
  });

  it("빈 문자열이면 400", async () => {
    const res = await POST(req({ text: "   " }));
    expect(res.status).toBe(400);
  });

  it("비 JSON이면 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("text가 상한을 넘기면 413", async () => {
    const res = await POST(
      req({ text: "a".repeat(SUMMARIZE_MAX_TEXT_LENGTH + 1) }),
    );
    expect(res.status).toBe(413);
  });
});
