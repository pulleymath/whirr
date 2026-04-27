"use client";

import { SessionMinutesModelSelect } from "@/components/session-minutes-model-select";
import { useGlossary } from "@/lib/glossary/context";
import { usePostRecordingPipeline } from "@/lib/post-recording-pipeline/context";
import {
  BATCH_MODEL_OPTIONS,
  ENGINE_OPTIONS,
  MODE_OPTIONS,
} from "@/lib/settings/options";
import { useSettings } from "@/lib/settings/context";
import { isScriptModeSettingsVisible } from "@/lib/settings/dev-ui";
import type { RealtimeEngine } from "@/lib/settings/types";
import { isWebSpeechApiSupported } from "@/lib/stt";
import { useSyncExternalStore } from "react";

export type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  isRecording: boolean;
};

export function SettingsPanel({
  open,
  onClose,
  isRecording,
}: SettingsPanelProps) {
  const { glossary, updateGlossary } = useGlossary();
  const { settings, updateSettings } = useSettings();
  const { isBusy: pipelineBusy } = usePostRecordingPipeline();
  const webSpeechSupported = useSyncExternalStore(
    () => () => {},
    () => isWebSpeechApiSupported(),
    () => true,
  );
  const showScriptModeSettings = isScriptModeSettingsVisible();

  if (!open) {
    return null;
  }

  const disabled = isRecording;
  const transcriptionControlsDisabled = isRecording || pipelineBusy;
  const webSpeechOptionDisabled =
    transcriptionControlsDisabled || !webSpeechSupported;

  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/40"
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
            className="cursor-pointer rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
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

          {pipelineBusy && !isRecording ? (
            <p
              className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              이전 녹음 처리 중에는 스크립트·회의록 모델을 바꿀 수 없습니다.
            </p>
          ) : null}

          <div className="mb-6">
            <label
              htmlFor="global-glossary-textarea"
              className="mb-2 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              전역 용어 사전
            </label>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              회의록 작성 시 STT 오인식 교정에 참고할 용어입니다. 한 줄에 하나씩
              입력하세요.
            </p>
            <textarea
              id="global-glossary-textarea"
              disabled={disabled}
              data-testid="global-glossary-textarea"
              rows={5}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder={"Kubernetes\n김지호\nOKR\nVercel"}
              value={glossary.terms.join("\n")}
              onChange={(e) => {
                const lines = e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                updateGlossary(lines);
              }}
            />
          </div>

          <section
            className="mb-6"
            aria-label="스크립트 설정"
            data-testid="settings-script-settings"
          >
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              스크립트 설정
            </h3>

            {showScriptModeSettings ? (
              <>
                <fieldset
                  className="mb-4 space-y-2"
                  disabled={transcriptionControlsDisabled}
                >
                  <legend className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    스크립트 모드
                  </legend>
                  {MODE_OPTIONS.map((opt) => {
                    const isWebSpeech = opt.value === "webSpeechApi";
                    const optionDisabled =
                      opt.value === "webSpeechApi"
                        ? webSpeechOptionDisabled
                        : transcriptionControlsDisabled;
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
                          name="settings-transcription-mode"
                          value={opt.value}
                          data-testid={`settings-mode-${opt.value}`}
                          checked={settings.mode === opt.value}
                          disabled={optionDisabled}
                          onChange={() => {
                            const nextMode = opt.value;
                            updateSettings({
                              mode: nextMode,
                              ...(settings.language === "auto" &&
                              nextMode !== "batch"
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
                      htmlFor="settings-realtime-engine"
                      className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      실시간 엔진
                    </label>
                    <select
                      id="settings-realtime-engine"
                      data-testid="settings-realtime-engine-select"
                      disabled={transcriptionControlsDisabled}
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
              </>
            ) : null}

            <div>
              <label
                htmlFor="settings-batch-model"
                className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                스크립트 모델
              </label>
              <select
                id="settings-batch-model"
                data-testid="settings-batch-model-select"
                disabled={transcriptionControlsDisabled}
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
          </section>

          <SessionMinutesModelSelect
            value={settings.meetingMinutesModel}
            onChange={(modelId) =>
              updateSettings({ meetingMinutesModel: modelId })
            }
            disabled={transcriptionControlsDisabled}
          />
        </div>
      </div>
    </div>
  );
}
