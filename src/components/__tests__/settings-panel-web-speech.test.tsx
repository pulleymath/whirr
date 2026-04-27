/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { SettingsPanel } from "@/components/settings-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("개발 환경에서 스크립트 모드 라디오가 렌더링된다", () => {
    render(
      <MainAppProviders>
        <SettingsPanel open isRecording={false} onClose={() => {}} />
      </MainAppProviders>,
    );

    expect(screen.getByTestId("settings-mode-webSpeechApi")).toBeTruthy();
    expect(screen.getByTestId("settings-mode-realtime")).toBeTruthy();
    expect(screen.getByTestId("settings-mode-batch")).toBeTruthy();
  });

  it("production에서는 스크립트 모드 라디오가 렌더링되지 않는다", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <MainAppProviders>
        <SettingsPanel open isRecording={false} onClose={() => {}} />
      </MainAppProviders>,
    );

    expect(screen.queryByTestId("settings-mode-batch")).toBeNull();
    expect(screen.getByTestId("settings-batch-model-select")).toBeTruthy();
  });

  it("전역 용어 사전 textarea는 계속 렌더링된다", () => {
    render(
      <MainAppProviders>
        <SettingsPanel open isRecording={false} onClose={() => {}} />
      </MainAppProviders>,
    );

    expect(screen.getByTestId("global-glossary-textarea")).toBeTruthy();
  });
});
