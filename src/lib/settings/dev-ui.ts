/**
 * `next dev` 등 개발 빌드인지 — 프로덕션 번들에서는 항상 false로 정적 치환된다.
 */
export function isDevelopmentBuild(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * 설정 패널에서 스크립트 모드(실시간 / 녹음 후 / Web Speech) UI를 노출할지.
 * 프로덕션에서는 사용자가 모드를 바꿀 수 없도록 숨긴다.
 */
export function isScriptModeSettingsVisible(): boolean {
  return isDevelopmentBuild();
}

/**
 * 사이드바·모바일 drawer의 설정 버튼과 설정 패널 마운트 여부.
 * `next build` 프로덕션 번들(`next start`, Vercel 등)에서는 숨기고,
 * `next dev`·테스트(`NODE_ENV=test`) 등 비프로덕션에서는 둔다.
 */
export function isSettingsEntryVisible(): boolean {
  return process.env.NODE_ENV !== "production";
}
