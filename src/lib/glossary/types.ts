import type { MeetingMinutesTemplate } from "@/lib/meeting-minutes/templates";

export type GlossaryEntry = string;

export type GlobalGlossary = {
  terms: GlossaryEntry[];
};

export type SessionContext = {
  participants: string;
  topic: string;
  keywords: string;
};

export type MeetingContext = {
  glossary: GlossaryEntry[];
  sessionContext: SessionContext | null;
  /** 회의록 출력 형식. 생략 시 기본회의로 해석 */
  template?: MeetingMinutesTemplate;
};
