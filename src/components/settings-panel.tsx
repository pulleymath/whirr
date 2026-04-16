"use client";

import { useSettings } from "@/lib/settings/context";
import {
  MEETING_MINUTES_MODEL_IDS,
  type RealtimeEngine,
  type TranscriptionMode,
} from "@/lib/settings/types";
import { isWebSpeechApiSupported } from "@/lib/stt";
import { useSyncExternalStore } from "react";

export type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  isRecording: boolean;
};

const MODE_OPTIONS: {
  value: TranscriptionMode;
  label: string;
  hint: string;
}[] = [
  {
    value: "realtime",
    label: "실시간 전사",
    hint: "녹음하면서 실시간으로 텍스트가 표시됩니다.",
  },
  {
    value: "batch",
    label: "녹음 후 전사",
    hint: "녹음이 끝난 뒤 한 번에 전사합니다.",
  },
  {
    value: "webSpeechApi",
    label: "Web Speech API",
    hint: "브라우저 내장 음성 인식을 사용합니다. 일부 환경(예: Chrome)에서는 음성이 클라우드로 전송될 수 있으며, 입력 레벨 미터용으로 별도 마이크 캡처가 함께 동작할 수 있습니다.",
  },
];

const ENGINE_OPTIONS: {
  value: RealtimeEngine;
  label: string;
  hint: string;
}[] = [
  {
    value: "openai",
    label: "OpenAI Realtime",
    hint: "OpenAI Realtime 전사(기본).",
  },
  {
    value: "assemblyai",
    label: "AssemblyAI",
    hint: "AssemblyAI Universal Streaming.",
  },
];

const BATCH_MODEL_OPTIONS = [
  { value: "whisper-1", label: "whisper-1" },
  { value: "gpt-4o-transcribe", label: "gpt-4o-transcribe" },
] as const;

const MEETING_MINUTES_MODEL_OPTIONS = MEETING_MINUTES_MODEL_IDS.map((id) => ({
  value: id,
  label: id,
}));

export function SettingsPanel({
  open,
  onClose,
  isRecording,
}: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();
  const webSpeechSupported = useSyncExternalStore(
    () => () => {},
    () => isWebSpeechApiSupported(),
    () => true,
  );

  if (!open) {
    return null;
  }

  const disabled = isRecording;
  const autoLanguageDisabled = settings.mode !== "batch" || disabled;
  const webSpeechOptionDisabled = disabled || !webSpeechSupported;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="설정 닫기"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-panel-title"
        className="relative z-10 flex max-h-[min(90vh,32rem)] w-full max-w-md flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2
            id="settings-panel-title"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            설정
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            aria-label="닫기"
          >
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isRecording ? (
            <p
              className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              녹음 중에는 설정을 바꿀 수 없습니다.
            </p>
          ) : null}

          <fieldset className="mb-6 space-y-3" disabled={disabled}>
            <legend className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              전사 모드
            </legend>
            {MODE_OPTIONS.map((opt) => {
              const isWebSpeech = opt.value === "webSpeechApi";
              const optionDisabled =
                opt.value === "webSpeechApi"
                  ? webSpeechOptionDisabled
                  : disabled;
              return (
                <label
                  key={opt.value}
                  className={`flex gap-3 rounded-lg border border-transparent p-2 ${
                    optionDisabled
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="transcription-mode"
                    value={opt.value}
                    checked={settings.mode === opt.value}
                    disabled={optionDisabled}
                    aria-disabled={optionDisabled}
                    onChange={() => {
                      const nextMode = opt.value;
                      updateSettings({
                        mode: nextMode,
                        ...(settings.language === "auto" && nextMode !== "batch"
                          ? { language: "ko" }
                          : {}),
                      });
                    }}
                    className="mt-1"
                    data-testid={`mode-${opt.value}`}
                  />
                  <span>
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {opt.label}
                      {isWebSpeech && !webSpeechSupported ? (
                        <span
                          className="ml-1.5 font-normal text-zinc-500 dark:text-zinc-400"
                          data-testid="web-speech-unsupported-hint"
                        >
                          (이 브라우저에서 지원되지 않습니다)
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {settings.mode === "realtime" ? (
            <fieldset className="mb-6 space-y-3" disabled={disabled}>
              <legend className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                실시간 전사 엔진
              </legend>
              {ENGINE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <input
                    type="radio"
                    name="realtime-engine"
                    value={opt.value}
                    checked={settings.realtimeEngine === opt.value}
                    onChange={() =>
                      updateSettings({ realtimeEngine: opt.value })
                    }
                    className="mt-1"
                    data-testid={`engine-${opt.value}`}
                  />
                  <span>
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {settings.mode === "batch" ? (
            <div className="mb-6">
              <label
                htmlFor="batch-model-select"
                className="mb-2 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                일괄 전사 모델
              </label>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                녹음 후 전사에 사용할 모델입니다.
              </p>
              <select
                id="batch-model-select"
                disabled={disabled}
                value={settings.batchModel}
                onChange={(e) => updateSettings({ batchModel: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                data-testid="batch-model-select"
              >
                {BATCH_MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mb-6">
            <label
              htmlFor="meeting-minutes-model-select"
              className="mb-2 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              회의록 작성 모델
            </label>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              녹음이 끝난 뒤 전사를 바탕으로 회의록을 작성할 때 사용할
              모델입니다.
            </p>
            <select
              id="meeting-minutes-model-select"
              disabled={disabled}
              value={settings.meetingMinutesModel}
              onChange={(e) =>
                updateSettings({ meetingMinutesModel: e.target.value })
              }
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              data-testid="meeting-minutes-model-select"
            >
              {MEETING_MINUTES_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-3" disabled={disabled}>
            <legend className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              언어
            </legend>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
              <input
                type="radio"
                name="language"
                value="ko"
                checked={settings.language === "ko"}
                onChange={() => updateSettings({ language: "ko" })}
                className="mt-1"
                data-testid="lang-ko"
              />
              <span className="text-sm text-zinc-900 dark:text-zinc-50">
                한국어 (ko)
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
              <input
                type="radio"
                name="language"
                value="en"
                checked={settings.language === "en"}
                onChange={() => updateSettings({ language: "en" })}
                className="mt-1"
                data-testid="lang-en"
              />
              <span className="text-sm text-zinc-900 dark:text-zinc-50">
                English (en)
              </span>
            </label>
            <label
              className={`flex gap-3 rounded-lg border border-transparent p-2 ${autoLanguageDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60"}`}
            >
              <input
                type="radio"
                name="language"
                value="auto"
                checked={settings.language === "auto"}
                disabled={autoLanguageDisabled}
                onChange={() => updateSettings({ language: "auto" })}
                className="mt-1"
                data-testid="lang-auto"
              />
              <span>
                <span className="block text-sm text-zinc-900 dark:text-zinc-50">
                  자동 감지 (auto)
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                  녹음 후 전사 모드에서만 사용할 수 있습니다.
                </span>
              </span>
            </label>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
