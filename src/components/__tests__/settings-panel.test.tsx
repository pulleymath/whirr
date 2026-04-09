/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
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
