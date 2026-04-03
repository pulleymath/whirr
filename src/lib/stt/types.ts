/**
 * STT(음성-텍스트) 제공자 추상화. UI는 구현체가 아닌 이 인터페이스만 참조한다.
 * 일반 호출 순서: connect → sendAudio(반복) → stop → disconnect
 */
export interface TranscriptionProvider {
  connect(
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (error: Error) => void,
  ): Promise<void>;
  sendAudio(pcmData: ArrayBuffer): void;
  stop(): Promise<void>;
  disconnect(): void;
}
