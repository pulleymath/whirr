import type { TranscriptionProvider } from "./types";
import {
  createWebSpeechNoSpeechDebouncer,
  formatWebSpeechProviderError,
} from "./user-facing-error";

const NO_SPEECH_DEBOUNCE_MS = 3000;

/** 설정 언어 코드 → Web Speech `lang` (BCP 47) */
export function mapSettingsLanguageToWebSpeechLang(lang: string): string {
  if (lang === "en") {
    return "en-US";
  }
  return "ko-KR";
}

export function isWebSpeechApiSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

function defaultSpeechRecognitionFactory(): SpeechRecognition {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) {
    throw new Error("Web Speech API unavailable");
  }
  return new Ctor();
}

export class WebSpeechProvider implements TranscriptionProvider {
  private recognition: SpeechRecognition | null = null;
  /** 사용자가 stop()하지 않은 상태에서 onend 재시작 허용 */
  private active = false;
  /** disconnect 이후 재시작 금지 */
  private closed = false;
  private readonly noSpeechDebouncer = createWebSpeechNoSpeechDebouncer(
    NO_SPEECH_DEBOUNCE_MS,
  );

  constructor(
    private readonly language = "ko-KR",
    private readonly recognitionFactory: () => SpeechRecognition = defaultSpeechRecognitionFactory,
  ) {}

  private releaseRecognitionResources(recognition: SpeechRecognition): void {
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
    }
  }

  async connect(
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    this.disconnect();
    this.closed = false;
    this.active = true;
    this.noSpeechDebouncer.reset();

    let recognition: SpeechRecognition;
    try {
      recognition = this.recognitionFactory();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onError(new Error(msg));
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.language;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          onFinal(transcript);
        } else {
          onPartial(transcript);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error;
      if (code === "aborted") {
        return;
      }
      if (code === "no-speech") {
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        if (!this.noSpeechDebouncer.shouldReport(now)) {
          return;
        }
      }
      onError(new Error(formatWebSpeechProviderError(code)));
    };

    recognition.onend = () => {
      if (this.closed || !this.active) {
        return;
      }
      const r = recognition;
      queueMicrotask(() => {
        if (this.closed || !this.active || this.recognition !== r) {
          return;
        }
        try {
          r.start();
        } catch {
          /* 이미 시작됨 등 — 무시 */
        }
      });
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch (e) {
      this.releaseRecognitionResources(recognition);
      this.recognition = null;
      this.active = false;
      const msg = e instanceof Error ? e.message : String(e);
      onError(new Error(msg));
    }
  }

  sendAudio(pcmData: ArrayBuffer): void {
    void pcmData;
    /* Web Speech는 브라우저 마이크를 직접 사용 — PCM 파이프라인과 무관 */
  }

  async stop(): Promise<void> {
    this.active = false;
    const r = this.recognition;
    if (r) {
      try {
        r.stop();
      } catch {
        /* noop */
      }
    }
  }

  disconnect(): void {
    this.closed = true;
    this.active = false;
    const r = this.recognition;
    this.recognition = null;
    if (r) {
      this.releaseRecognitionResources(r);
    }
  }
}

export function createWebSpeechProvider(
  language?: string,
): TranscriptionProvider {
  const lang = language
    ? mapSettingsLanguageToWebSpeechLang(language)
    : "ko-KR";
  return new WebSpeechProvider(lang);
}
