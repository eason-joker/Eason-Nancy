export type TermCategory = 'term' | 'proper' | 'style';

export interface GlossaryTerm {
  id: string;
  source: string;
  lang: string;
  category: TermCategory;
  translations: string[];
  note: string;
  provenance: string;
  updatedAt: number;
}

export interface TranslationToken {
  id: string;
  glossaryId: string | null;
  sourceWord: string;
  category: TermCategory;
  currentTranslation: string;
  suggestions: string[];
  note: string;
  provenance: string;
  verified: boolean;
  isDiscovered: boolean;
}

export interface TranslationSegment {
  id: string;
  source: string;
  translationStructure: Array<{ type: 'text' | 'token'; value: string }>;
  tokens: TranslationToken[];
  rawTranslation: string;
  isCustomEdited: boolean;
  customText: string;
  editMode: 'interactive' | 'text';
}
