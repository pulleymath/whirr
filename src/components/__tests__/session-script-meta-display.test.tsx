/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SessionScriptMetaDisplay } from "@/components/session-script-meta-display";

afterEach(() => {
  cleanup();
});

describe("SessionScriptMetaDisplay", () => {
  it("scriptMeta가 없으면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(
      <SessionScriptMetaDisplay scriptMeta={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("batch 메타를 한 줄로 표시한다", () => {
    render(
      <SessionScriptMetaDisplay
        scriptMeta={{
          mode: "batch",
          batchModel: "whisper-1",
          language: "ko",
          minutesModel: "gpt-4o-mini",
        }}
      />,
    );
    expect(screen.getByTestId("session-script-meta-display")).toHaveTextContent(
      "whisper-1",
    );
    expect(screen.getByTestId("session-script-meta-display")).toHaveTextContent(
      "ko",
    );
  });
});
