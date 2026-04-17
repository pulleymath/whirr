"use client";

import {
  BATCH_MODEL_OPTIONS,
  ENGINE_OPTIONS,
  MEETING_MINUTES_MODEL_OPTIONS,
  MODE_OPTIONS,
} from "@/lib/settings/options";
import { useRecordingActivity } from "@/lib/recording-activity/context";
import { useSettings } from "@/lib/settings/context";
import type { RealtimeEngine } from "@/lib/settings/types";
import { isWebSpeechApiSupported } from "@/lib/stt";
import { useSyncExternalStore } from "react";

export type ModelQuickPanelProps = {
  /** true이면 녹음 여부와 무관하게 비활성화 */
  disabled?: boolean;
};

export function ModelQuickPanel({ disabled = false }: ModelQuickPanelProps) {
  const { isRecording } = useRecordingActivity();
  const { settings, updateSettings } = useSettings();
  const controlsDisabled = disabled || isRecording;
  const webSpeechSupported = useSyncExternalStore(
    () => () => {},
    () => isWebSpeechApiSupported(),
    () => true,
  );

  const autoLanguageDisabled = settings.mode !== "batch" || controlsDisabled;
  const webSpeechOptionDisabled = controlsDisabled || !webSpeechSupported;

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      data-testid="home-model-panel"
      aria-label="스크립트·회의록 모델"
    >
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        모델
      </h2>

      <fieldset className="mb-4 space-y-2" disabled={controlsDisabled}>
        <legend className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          스크립트 모드
        </legend>
        {MODE_OPTIONS.map((opt) => {
          const isWebSpeech = opt.value === "webSpeechApi";
          const optionDisabled =
            opt.value === "webSpeechApi"
              ? webSpeechOptionDisabled
              : controlsDisabled;
          return (
            <label
              key={opt.value}
              className={`flex gap-2 rounded-lg border border-transparent p-1.5 text-sm ${
                optionDisabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
              }`}
            >
              <input
                type="radio"
                name="home-transcription-mode"
                value={opt.value}
                checked={settings.mode === opt.value}
                disabled={optionDisabled}
                onChange={() => {
                  const nextMode = opt.value;
                  updateSettings({
                    mode: nextMode,
                    ...(settings.language === "auto" && nextMode !== "batch"
                      ? { language: "ko" }
                      : {}),
                  });
                }}
                className="mt-0.5"
              />
              <span className="text-zinc-800 dark:text-zinc-200">
                {opt.label}
                {isWebSpeech && !webSpeechSupported ? (
                  <span className="ml-1 text-xs font-normal text-zinc-500">
                    (미지원)
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      {settings.mode === "realtime" ? (
        <div className="mb-4">
          <label
            htmlFor="home-realtime-engine"
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            실시간 엔진
          </label>
          <select
            id="home-realtime-engine"
            disabled={controlsDisabled}
            value={settings.realtimeEngine}
            onChange={(e) =>
              updateSettings({
                realtimeEngine: e.target.value as RealtimeEngine,
              })
            }
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {ENGINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {settings.mode === "batch" ? (
        <div className="mb-4">
          <label
            htmlFor="home-batch-model"
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            일괄 스크립트 모델
          </label>
          <select
            id="home-batch-model"
            disabled={controlsDisabled}
            value={settings.batchModel}
            onChange={(e) => updateSettings({ batchModel: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {BATCH_MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mb-4">
        <label
          htmlFor="home-meeting-minutes-model"
          className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          회의록 작성 모델
        </label>
        <select
          id="home-meeting-minutes-model"
          disabled={controlsDisabled}
          value={settings.meetingMinutesModel}
          onChange={(e) =>
            updateSettings({ meetingMinutesModel: e.target.value })
          }
          className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {MEETING_MINUTES_MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-2" disabled={controlsDisabled}>
        <legend className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          언어
        </legend>
        <label className="flex cursor-pointer gap-2 rounded-lg p-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
          <input
            type="radio"
            name="home-language"
            value="ko"
            checked={settings.language === "ko"}
            onChange={() => updateSettings({ language: "ko" })}
          />
          <span className="text-zinc-800 dark:text-zinc-200">한국어 (ko)</span>
        </label>
        <label className="flex cursor-pointer gap-2 rounded-lg p-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
          <input
            type="radio"
            name="home-language"
            value="en"
            checked={settings.language === "en"}
            onChange={() => updateSettings({ language: "en" })}
          />
          <span className="text-zinc-800 dark:text-zinc-200">English (en)</span>
        </label>
        <label
          className={`flex gap-2 rounded-lg p-1.5 text-sm ${autoLanguageDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60"}`}
        >
          <input
            type="radio"
            name="home-language"
            value="auto"
            checked={settings.language === "auto"}
            disabled={autoLanguageDisabled}
            onChange={() => updateSettings({ language: "auto" })}
          />
          <span className="text-zinc-800 dark:text-zinc-200">
            자동 감지 (auto)
          </span>
        </label>
      </fieldset>
    </section>
  );
}
