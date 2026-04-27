/** @vitest-environment happy-dom */
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SettingsProvider,
  SETTINGS_STORAGE_KEY,
  useSettings,
} from "../context";
import { DEFAULT_TRANSCRIPTION_SETTINGS } from "../types";

function Consumer() {
  const { settings, updateSettings } = useSettings();
  return (
    <div>
      <span data-testid="mode">{settings.mode}</span>
      <span data-testid="engine">{settings.realtimeEngine}</span>
      <button type="button" onClick={() => updateSettings({ mode: "batch" })}>
        batch
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("SettingsProvider + useSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Provider 없이 useSettings면 에러", () => {
    expect(() => render(<Consumer />)).toThrow(
      /useSettings must be used within SettingsProvider/,
    );
  });

  it("마운트 후 기본값과 동일(저장소 비어 있을 때)", async () => {
    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("mode").textContent).toBe(
        DEFAULT_TRANSCRIPTION_SETTINGS.mode,
      );
    });
  });

  it("localStorage 유효 JSON이면 병합된 값 표시", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: "batch", realtimeEngine: "assemblyai" }),
    );

    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("mode").textContent).toBe("batch");
      expect(screen.getByTestId("engine").textContent).toBe("assemblyai");
    });
  });

  it("updateSettings 후 반영 및 localStorage 직렬화", async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ mode: "realtime", realtimeEngine: "openai" }),
    );

    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("mode").textContent).toBe("realtime");
    });

    await act(async () => {
      screen.getByRole("button", { name: "batch" }).click();
    });

    expect(screen.getByTestId("mode").textContent).toBe("batch");
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toMatchObject({ mode: "batch" });
  });

  it("손상된 JSON은 기본값으로 폴백", async () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, "{not-json");

    render(
      <SettingsProvider>
        <Consumer />
      </SettingsProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId("mode").textContent).toBe(
        DEFAULT_TRANSCRIPTION_SETTINGS.mode,
      );
    });
  });
});
