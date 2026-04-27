/**
 * 설정 패널에서 스크립트 모드(실시간 / 녹음 후 / Web Speech) UI를 노출할지.
 * 프로덕션에서는 사용자가 모드를 바꿀 수 없도록 숨긴다.
 */
export function isScriptModeSettingsVisible(): boolean {
  return process.env.NODE_ENV === "development";
}
