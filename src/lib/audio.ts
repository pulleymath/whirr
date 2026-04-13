export type OnPcmChunk = (pcm: ArrayBuffer) => void;

/**
 * AudioWorklet → main `postMessage` 페이로드는 환경에 따라 `ArrayBuffer`가 아니거나
 * `instanceof ArrayBuffer`가 실패할 수 있어, 뷰 타입까지 허용한다.
 */
function arrayBufferFromWorkletMessage(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    const v = data;
    const copy = new Uint8Array(v.byteLength);
    copy.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    return copy.buffer;
  }
  /* AudioWorklet 다른 글로벌에서 온 ArrayBuffer는 instanceof 실패할 수 있음 */
  if (
    data != null &&
    typeof data === "object" &&
    Object.prototype.toString.call(data) === "[object ArrayBuffer]" &&
    typeof (data as ArrayBuffer).byteLength === "number"
  ) {
    const raw = data as ArrayBuffer;
    return raw.byteLength > 0 ? raw.slice(0) : raw;
  }
  return new ArrayBuffer(0);
}

export function mapMediaErrorToMessage(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: string }).name);
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "마이크를 찾을 수 없습니다.";
    }
  }
  return "마이크를 시작할 수 없습니다.";
}

export interface PcmRecordingSession {
  stop: () => Promise<void>;
  analyser: AnalyserNode;
}

/**
 * 마이크 스트림을 AudioWorklet으로 PCM 16kHz mono 청크로 변환합니다.
 * `public/audio-processor.js`의 프로세서 이름은 `pcm-capture`입니다.
 */
export async function startPcmRecording(
  onPcmChunk: OnPcmChunk,
): Promise<PcmRecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const ctx = new AudioContext();

  try {
    await ctx.audioWorklet.addModule("/audio-processor.js");
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    await ctx.close().catch(() => {});
    throw err;
  }

  const source = ctx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(ctx, "pcm-capture");

  worklet.port.onmessage = (ev: MessageEvent<unknown>) => {
    const buf = arrayBufferFromWorkletMessage(ev.data);
    if (buf.byteLength > 0) {
      onPcmChunk(buf);
    }
  };

  const monitorGain = ctx.createGain();
  monitorGain.gain.value = 0;
  worklet.connect(monitorGain);
  monitorGain.connect(ctx.destination);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.4;
  source.connect(analyser);
  source.connect(worklet);

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const stop = async () => {
    worklet.port.onmessage = null;
    worklet.disconnect();
    source.disconnect();
    analyser.disconnect();
    monitorGain.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    await ctx.close().catch(() => {});
  };

  return { stop, analyser };
}

const PREFERRED_WEBM_MIME = "audio/webm;codecs=opus";
const FALLBACK_WEBM_MIME = "audio/webm";

export function pickWebmRecordingMimeType(): string {
  if (
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported(PREFERRED_WEBM_MIME)
  ) {
    return PREFERRED_WEBM_MIME;
  }
  return FALLBACK_WEBM_MIME;
}

export interface BlobRecordingSession {
  stop: () => Promise<Blob>;
  analyser: AnalyserNode;
}

export interface SegmentedRecordingSession {
  rotateSegment: () => Promise<Blob>;
  stopFinalSegment: () => Promise<Blob>;
  getFullAudioBlob: () => Promise<Blob>;
  close: () => Promise<void>;
  analyser: AnalyserNode;
}

/**
 * MediaRecorder로 압축 오디오(webm/opus 우선)를 녹음합니다.
 * PCM 경로 `startPcmRecording`과 별도로 동작합니다.
 */
export async function startBlobRecording(): Promise<BlobRecordingSession> {
  const { stopFinalSegment, close, analyser } = await startSegmentedRecording();

  const stop = async (): Promise<Blob> => {
    const blob = await stopFinalSegment();
    await close();
    return blob;
  };

  return { stop, analyser };
}

/**
 * 5분 단위 세그먼트 녹음을 지원하는 MediaRecorder 세션을 시작합니다.
 */
export async function startSegmentedRecording(): Promise<SegmentedRecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = pickWebmRecordingMimeType();
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.4;
  source.connect(analyser);

  const currentChunks: BlobPart[] = [];
  let recorder: MediaRecorder | null = null;

  const onDataAvailable = (ev: BlobEvent) => {
    if (ev.data && ev.data.size > 0) {
      currentChunks.push(ev.data);
    }
  };

  recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = onDataAvailable;
  recorder.start();

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const rotateSegment = async (): Promise<Blob> => {
    if (!recorder || recorder.state !== "recording") {
      return new Blob([], { type: mimeType });
    }
    return new Promise<Blob>((resolve) => {
      const onData = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          recorder!.removeEventListener("dataavailable", onData);
          resolve(new Blob([ev.data], { type: mimeType }));
        }
      };
      recorder!.addEventListener("dataavailable", onData);
      try {
        recorder!.requestData();
      } catch {
        recorder!.removeEventListener("dataavailable", onData);
        resolve(new Blob([], { type: mimeType }));
      }
    });
  };

  const stopFinalSegment = async (): Promise<Blob> => {
    if (!recorder || recorder.state === "inactive") {
      return new Blob([], { type: mimeType });
    }
    return new Promise<Blob>((resolve, reject) => {
      let finalChunk: Blob | null = null;
      const onData = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          finalChunk = ev.data;
        }
      };
      recorder!.addEventListener("dataavailable", onData);
      recorder!.addEventListener(
        "stop",
        () => {
          recorder!.removeEventListener("dataavailable", onData);
          resolve(new Blob(finalChunk ? [finalChunk] : [], { type: mimeType }));
        },
        { once: true },
      );
      recorder!.addEventListener(
        "error",
        () => {
          recorder!.removeEventListener("dataavailable", onData);
          reject(new Error("MediaRecorder error"));
        },
        { once: true },
      );
      try {
        recorder!.stop();
      } catch {
        recorder!.removeEventListener("dataavailable", onData);
        reject(new Error("Failed to stop recorder"));
      }
    });
  };

  const close = async () => {
    stream.getTracks().forEach((t) => t.stop());
    source.disconnect();
    analyser.disconnect();
    await ctx.close().catch(() => {});
  };

  const getFullAudioBlob = async (): Promise<Blob> => {
    return new Blob(currentChunks, { type: mimeType });
  };

  return {
    rotateSegment,
    stopFinalSegment,
    close,
    analyser,
    getFullAudioBlob,
  } as SegmentedRecordingSession & { getFullAudioBlob: () => Promise<Blob> };
}
