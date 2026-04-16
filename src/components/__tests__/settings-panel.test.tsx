/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "../settings-panel";
import { SettingsProvider, SETTINGS_STORAGE_KEY } from "@/lib/settings/context";

function renderPanel(isRecording = false) {
  return render(
    <SettingsProvider>
      <SettingsPanel open onClose={() => {}} isRecording={isRecording} />
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

  it("realtime일 때 실시간 엔진 필드가 보인다", async () => {
    renderPanel();

    await vi.waitFor(() => {
      expect(screen.getByTestId("engine-openai")).toBeTruthy();
    });
    expect(screen.getByTestId("engine-assemblyai")).toBeTruthy();
    expect(screen.getByTestId("meeting-minutes-model-select")).toBeTruthy();
  });

  it("회의록 모델 기본값이 gpt-5.4-nano이고 변경 시 저장된다", async () => {
    renderPanel();
    await vi.waitFor(() => {
      expect(screen.getByTestId("meeting-minutes-model-select")).toBeTruthy();
    });
    const sel = screen.getByTestId(
      "meeting-minutes-model-select",
    ) as HTMLSelectElement;
    expect(sel.value).toBe("gpt-5.4-nano");
    fireEvent.change(sel, { target: { value: "gpt-4o" } });
    await vi.waitFor(() => {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as { meetingMinutesModel?: string };
      expect(parsed.meetingMinutesModel).toBe("gpt-4o");
    });
  });

  it("batch일 때 일괄 모델 선택이 보이고 실시간 엔진은 없다", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: "batch" }),
    );
    renderPanel();

    await vi.waitFor(() => {
      expect(screen.getByTestId("batch-model-select")).toBeTruthy();
    });
    expect(screen.queryByTestId("engine-openai")).toBeNull();
  });

  it("webSpeechApi일 때 실시간 엔진 필드가 없다", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: "webSpeechApi" }),
    );
    renderPanel();

    await vi.waitFor(() => {
      expect(screen.getByTestId("mode-webSpeechApi")).toBeTruthy();
    });
    expect(screen.queryByTestId("engine-openai")).toBeNull();
  });

  it("isRecording이면 라디오가 비활성화된다", async () => {
    renderPanel(true);

    await vi.waitFor(() => {
      expect(screen.getByTestId("mode-realtime")).toBeTruthy();
    });
    const realtimeRadio = screen.getByTestId(
      "mode-realtime",
    ) as HTMLInputElement;
    const modeFieldset = realtimeRadio.closest(
      "fieldset",
    ) as HTMLFieldSetElement;
    expect(modeFieldset.disabled).toBe(true);
  });
});
