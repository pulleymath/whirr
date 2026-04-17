/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { SettingsPanel } from "@/components/settings-panel";

afterEach(() => {
  cleanup();
});

describe("SettingsPanel", () => {
  it("스크립트 모드 라디오가 렌더링된다", () => {
    render(
      <MainAppProviders>
        <SettingsPanel open isRecording={false} onClose={() => {}} />
      </MainAppProviders>,
    );

    expect(screen.getByTestId("settings-mode-webSpeechApi")).toBeTruthy();
    expect(screen.getByTestId("settings-mode-realtime")).toBeTruthy();
    expect(screen.getByTestId("settings-mode-batch")).toBeTruthy();
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
