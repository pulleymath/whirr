import { describe, expect, it } from "vitest";
import {
  isSttReconnectRecoverableMessage,
  OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE,
  SESSION_EXPIRED_OR_DISCONNECTED,
  SESSION_PROACTIVE_RENEW,
  SESSION_RECONNECT_EXHAUSTED,
  userFacingSttReconnectToast,
  userFacingSttError,
} from "../user-facing-error";

describe("user-facing STT session / reconnect messages", () => {
  it("OpenAI 60분 세션 만료 문구를 한국어로 매핑한다", () => {
    expect(
      userFacingSttError(OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE),
    ).toBe("세션 시간(60분)이 만료되었습니다. 자동으로 재연결합니다.");
  });

  it("비정상 WebSocket 종료 코드를 한국어로 매핑한다", () => {
    expect(userFacingSttError(SESSION_EXPIRED_OR_DISCONNECTED)).toBe(
      "음성 인식 연결이 끊어졌습니다. 자동으로 재연결합니다.",
    );
  });

  it("재연결 한도 초과 시 수동 재시작을 안내한다", () => {
    expect(userFacingSttError(SESSION_RECONNECT_EXHAUSTED)).toBe(
      "음성 인식 연결이 끊어졌습니다. 녹음을 다시 시작해 주세요.",
    );
  });

  it("선제 세션 갱신용 토스트 문구를 반환한다", () => {
    expect(userFacingSttReconnectToast(SESSION_PROACTIVE_RENEW)).toBe(
      "세션을 곧 갱신합니다.",
    );
    expect(
      userFacingSttReconnectToast(OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE),
    ).toBe("세션을 갱신하는 중입니다.");
    expect(userFacingSttReconnectToast(SESSION_EXPIRED_OR_DISCONNECTED)).toBe(
      "연결을 복구하는 중입니다.",
    );
    expect(userFacingSttReconnectToast("unknown")).toBeNull();
  });

  it("isSttReconnectRecoverableMessage가 복구 가능 메시지만 true로 분류한다", () => {
    expect(
      isSttReconnectRecoverableMessage(
        OPENAI_REALTIME_SESSION_MAX_DURATION_MESSAGE,
      ),
    ).toBe(true);
    expect(
      isSttReconnectRecoverableMessage(SESSION_EXPIRED_OR_DISCONNECTED),
    ).toBe(true);
    expect(isSttReconnectRecoverableMessage(SESSION_PROACTIVE_RENEW)).toBe(
      true,
    );
    expect(
      isSttReconnectRecoverableMessage("WebSocket connection failed"),
    ).toBe(true);
    expect(isSttReconnectRecoverableMessage("STT_PROVIDER_ERROR")).toBe(false);
    expect(isSttReconnectRecoverableMessage("Failed to obtain STT token")).toBe(
      false,
    );
  });
});
