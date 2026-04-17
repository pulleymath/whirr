/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { SettingsPanel } from "@/components/settings-panel";

afterEach(() => {
  cleanup();
});

describe("SettingsPanel (간소화)", () => {
  it("스크립트 모드 관련 필드가 렌더링되지 않는다", () => {
    render(
      <MainAppProviders>
        <SettingsPanel open isRecording={false} onClose={() => {}} />
      </MainAppProviders>,
    );

    expect(screen.queryByTestId("mode-webSpeechApi")).toBeNull();
    expect(screen.queryByTestId("mode-realtime")).toBeNull();
    expect(screen.queryByTestId("engine-openai")).toBeNull();
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
