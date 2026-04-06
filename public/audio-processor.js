/**
 * PCM 16-bit, 16kHz, mono — 마이크 Float32 입력을 STT용 Int16 청크로 변환합니다.
 * 다운믹스(mono) 후 선형 보간으로 입력 샘플레이트 → 16000Hz 리샘플링합니다.
 */
const TARGET_SAMPLE_RATE = 16000;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    /** @type {Float32Array} */
    this._carry = new Float32Array(0);
    /** merged 버퍼 기준 다음 출력에 사용할 소스 위치(소수 샘플 인덱스) */
    this._inPos = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const outCh = outputs[0];
    if (outCh && outCh[0]) {
      outCh[0].fill(0);
    }

    if (!input || !input[0]) {
      return true;
    }

    const channelCount = input.length;
    const frameLength = input[0].length;
    const mono = new Float32Array(frameLength);
    for (let i = 0; i < frameLength; i++) {
      let sum = 0;
      for (let c = 0; c < channelCount; c++) {
        sum += input[c][i];
      }
      mono[i] = sum / channelCount;
    }

    const merged = new Float32Array(this._carry.length + mono.length);
    merged.set(this._carry);
    merged.set(mono, this._carry.length);

    const inSr = sampleRate;
    const outSr = TARGET_SAMPLE_RATE;
    const step = inSr / outSr;

    let pos = this._inPos;
    const floats = [];

    while (pos + 1 < merged.length) {
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      const s0 = merged[i0];
      const s1 = merged[i0 + 1];
      const sample = s0 * (1 - frac) + s1 * frac;
      floats.push(sample);
      pos += step;
    }

    let keepFrom = 0;
    if (merged.length >= 2) {
      keepFrom = Math.min(Math.floor(pos), merged.length - 2);
      keepFrom = Math.max(keepFrom, 0);
    }
    this._carry = merged.subarray(keepFrom);
    this._inPos = pos - keepFrom;

    if (floats.length > 0) {
      const pcm = new Int16Array(floats.length);
      for (let i = 0; i < floats.length; i++) {
        let x = floats[i];
        x = Math.max(-1, Math.min(1, x));
        pcm[i] = x < 0 ? x * 0x8000 : x * 0x7fff;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
