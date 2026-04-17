/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlossaryProvider } from "@/lib/glossary/context";
import { SettingsPanel } from "../settings-panel";
import { SettingsProvider } from "@/lib/settings/context";

function renderPanel(isRecording = false) {
  return render(
    <SettingsProvider>
      <GlossaryProvider>
        <SettingsPanel open onClose={() => {}} isRecording={isRecording} />
      </GlossaryProvider>
    </SettingsProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("SettingsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("설정 패널에는 전역 용어 사전만 보인다", async () => {
    renderPanel();

    await vi.waitFor(() => {
      expect(screen.getByTestId("global-glossary-textarea")).toBeTruthy();
    });
    expect(screen.queryByTestId("mode-realtime")).toBeNull();
    expect(screen.queryByTestId("engine-openai")).toBeNull();
    expect(screen.queryByTestId("batch-model-select")).toBeNull();
    expect(screen.queryByTestId("meeting-minutes-model-select")).toBeNull();
    expect(screen.queryByTestId("lang-ko")).toBeNull();
  });

  it("textarea에 입력하면 updateGlossary가 반영된다", async () => {
    renderPanel();
    await vi.waitFor(() => {
      expect(screen.getByTestId("global-glossary-textarea")).toBeTruthy();
    });
    const ta = screen.getByTestId(
      "global-glossary-textarea",
    ) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "Alpha\nBeta" } });
    await vi.waitFor(() => {
      const raw = localStorage.getItem("whirr:global-glossary");
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!)).toEqual({ terms: ["Alpha", "Beta"] });
    });
  });

  it("녹음 중이면 전역 용어 사전 textarea가 disabled이다", async () => {
    renderPanel(true);
    await vi.waitFor(() => {
      expect(screen.getByTestId("global-glossary-textarea")).toBeTruthy();
    });
    expect(
      (screen.getByTestId("global-glossary-textarea") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText("녹음 중에는 설정을 바꿀 수 없습니다."),
    ).toBeTruthy();
  });

  it("open=false면 패널이 렌더링되지 않는다", () => {
    render(
      <SettingsProvider>
        <GlossaryProvider>
          <SettingsPanel open={false} onClose={() => {}} isRecording={false} />
        </GlossaryProvider>
      </SettingsProvider>,
    );
    expect(screen.queryByRole("dialog", { name: "설정" })).toBeNull();
  });
});
