import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  GlossaryEntry,
  GlobalGlossary,
  MeetingContext,
  SessionContext,
} from "../types";

describe("glossary types", () => {
  it("GlossaryEntry는 string 타입이다", () => {
    expectTypeOf<GlossaryEntry>().toEqualTypeOf<string>();
  });

  it("GlobalGlossary는 terms 배열을 가진다", () => {
    const g: GlobalGlossary = { terms: ["a", "b"] };
    expect(g.terms).toEqual(["a", "b"]);
  });

  it("SessionContext는 participants, topic, keywords 필드를 가진다", () => {
    const sc: SessionContext = {
      participants: "p",
      topic: "t",
      keywords: "k",
    };
    expect(sc).toMatchObject({ participants: "p", topic: "t", keywords: "k" });
  });

  it("MeetingContext는 glossary 배열과 sessionContext를 가진다", () => {
    const mc: MeetingContext = {
      glossary: ["x"],
      sessionContext: { participants: "", topic: "", keywords: "" },
    };
    expect(mc.glossary).toEqual(["x"]);
    expect(mc.sessionContext).not.toBeNull();
  });

  it("MeetingContext.sessionContext는 null을 허용한다", () => {
    const mc: MeetingContext = { glossary: [], sessionContext: null };
    expect(mc.sessionContext).toBeNull();
  });
});
