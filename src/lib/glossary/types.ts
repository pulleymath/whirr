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
};
