/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainAppProviders } from "@/components/providers/main-app-providers";
import { SettingsPanel } from "@/components/settings-panel";

const isWebSpeechApiSupported = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/stt", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/stt")>();
  return { ...mod, isWebSpeechApiSupported };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  isWebSpeechApiSupported.mockReturnValue(true);
});

describe("SettingsPanel Web Speech", () => {
  it("지원하지 않으면 Web Speech 라디오 비활성화 및 안내", async () => {
    isWebSpeechApiSupported.mockReturnValue(false);

    render(
      <MainAppProviders>
        <SettingsPanel open isRecording={false} onClose={() => {}} />
      </MainAppProviders>,
    );

    await waitFor(() => {
      expect(
        (screen.getByTestId("mode-webSpeechApi") as HTMLInputElement).disabled,
      ).toBe(true);
    });
    expect(
      screen.getByTestId("web-speech-unsupported-hint").textContent,
    ).toContain("이 브라우저에서 지원되지 않습니다");
  });

  it("지원하면 Web Speech 라디오 선택 가능", async () => {
    isWebSpeechApiSupported.mockReturnValue(true);

    render(
      <MainAppProviders>
        <SettingsPanel open isRecording={false} onClose={() => {}} />
      </MainAppProviders>,
    );

    expect(
      (screen.getByTestId("mode-webSpeechApi") as HTMLInputElement).disabled,
    ).toBe(false);
    expect(screen.queryByTestId("web-speech-unsupported-hint")).toBeNull();
  });
});
