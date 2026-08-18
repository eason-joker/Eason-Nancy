import type { BookMeta, SegmentRecord } from './storage';
import type { GlossaryTerm, TranslationSegment } from './types';
import { translateBatch, demoTranslate } from './llm';
import { saveBook, saveSegment, getNextPendingSegment, getSegmentsByBook } from './storage';
import { getSettings } from './settings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Chapter {
  index: number;
  title: string;
  segments: SegmentMeta[];
}

export interface SegmentMeta {
  index: number;
  source: string;
}

export interface BookParseResult {
  id: string;
  title: string;
  chapters: Chapter[];
}

// ─── Chapter / Segment Detection ─────────────────────────────────────────────

const CHAPTER_PATTERNS = [
  // Markdown # heading
  /^(#{1,3})\s+(.+)$/m,
  // 第X章 / 第X节
  /^(第[一二三四五六七八九十百千万\d]+[章节节])/,
  // Chapter X / Section X
  /^(Chapter\s+\d+[\.:]\s*.+)/im,
  /^(Section\s+\d+[\.:]\s*.+)/im,
  // 一、二、三、四... (Chinese enumeration)
  /^[一二三四五六七八九十百千万]+[、、.．]/,
  // All caps title (at least 3 chars, surrounded by blank lines)
  /^([A-Z][A-Z\s]{3,})$/m,
];

const SENTENCE_ENDINGS = /([。！？.!?])/;
const MAX_CHUNK_CHARS = 1800;

export function parseBook(text: string, filename: string): BookParseResult {
  const id = `book-${Date.now()}`;
  const title = filename.replace(/\.[^.]+$/, '') || '未命名';

  // Split into lines
  const lines = text.split(/\r?\n/);
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let currentParagraphs: string[] = [];
  let currentChapterTitle = '';
  let globalSegmentIndex = 0;

  function flushChapter(title: string, paragraphs: string[]) {
    if (!paragraphs.length) return;
    const segs: SegmentMeta[] = paragraphs
      .filter(p => p.trim().length > 0)
      .map((p, i) => ({ index: globalSegmentIndex++, source: p.trim() }));
    if (segs.length > 0) {
      chapters.push({
        index: chapters.length,
        title: title || `第${chapters.length + 1}章`,
        segments: segs,
      });
    }
  }

  function tryDetectChapter(line: string): string | null {
    for (const pattern of CHAPTER_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        return match[match.length - 1].trim();
      }
    }
    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if this line is a chapter heading
    const chapterTitle = tryDetectChapter(line);

    if (chapterTitle) {
      // Flush previous chapter
      if (currentChapter) {
        flushChapter(currentChapterTitle, currentParagraphs);
      }
      currentChapterTitle = chapterTitle;
      currentParagraphs = [];
      continue;
    }

    // Check if blank line分隔段落
    if (line === '') {
      if (currentParagraphs.length > 0) {
        currentParagraphs.push(''); // preserve paragraph boundary
      }
      continue;
    }

    // Regular text line
    if (line) {
      currentParagraphs.push(line);
    }
  }

  // Flush last chapter
  if (currentParagraphs.length > 0) {
    flushChapter(currentChapterTitle, currentParagraphs);
  }

  // If no chapters detected, treat entire text as one chapter
  if (chapters.length === 0) {
    const allText = lines.filter(l => l.trim()).join('\n\n');
    const segs: SegmentMeta[] = allText.split(/\n\n+/).map((p, i) => ({
      index: i,
      source: p.trim(),
    }));
    chapters.push({
      index: 0,
      title: '全文',
      segments: segs,
    });
  }

  return { id, title, chapters };
}

// ─── Text Chunking (within a chapter) ────────────────────────────────────────

export function splitIntoChunks(segments: SegmentMeta[], maxChars: number = MAX_CHUNK_CHARS): SegmentMeta[][] {
  const chunks: SegmentMeta[][] = [];
  let currentChunk: SegmentMeta[] = [];
  let currentCharCount = 0;

  for (const seg of segments) {
    if (currentCharCount + seg.source.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentCharCount = 0;
    }
    currentChunk.push(seg);
    currentCharCount += seg.source.length;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// ─── Translation ──────────────────────────────────────────────────────────────

export async function translateNextBatch(
  bookId: string,
  glossary: GlossaryTerm[],
  batchSize: number,
  onProgress: (done: number, total: number, currentChapter: string) => void
): Promise<{ done: boolean; translatedCount: number; error?: string }> {
  const settings = getSettings();

  // Get next pending segment
  const nextPending = await getNextPendingSegment(bookId);
  if (!nextPending) {
    return { done: true, translatedCount: 0 };
  }

  // Get all segments for this book
  const allSegments = await getSegmentsByBook(bookId);
  const pendingSegments = allSegments.filter(s => s.status === 'pending');

  if (pendingSegments.length === 0) {
    return { done: true, translatedCount: 0 };
  }

  // Get batch from current chapter
  const currentChapterIndex = nextPending.chapterIndex;
  const chapterSegments = pendingSegments.filter(s => s.chapterIndex === currentChapterIndex);
  const batch = chapterSegments.slice(0, batchSize);

  if (batch.length === 0) {
    return { done: true, translatedCount: 0 };
  }

  // Get previous segment's ending for context
  const allSorted = allSegments.sort((a, b) =>
    a.chapterIndex !== b.chapterIndex ? a.chapterIndex - b.chapterIndex : a.segmentIndex - b.segmentIndex
  );
  const currentIdx = allSorted.findIndex(s => s.id === batch[0].id);
  const prevEnding = currentIdx > 0 ? allSorted[currentIdx - 1].source.slice(-200) : undefined;

  // Call LLM
  const config = getSettings();
  let result;

  try {
    if (!config.apiKey) {
      // Demo mode
      result = demoTranslate(batch.map(s => ({ source: s.source })));
    } else {
      result = await translateBatch(
        batch.map(s => ({ source: s.source })),
        glossary,
        config,
        true,
        prevEnding
      );
    }
  } catch (error) {
    return {
      done: false,
      translatedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Save results
  for (let i = 0; i < batch.length; i++) {
    const seg = batch[i];
    const translated = result.segments[i];

    if (translated) {
      const updated: SegmentRecord = {
        ...seg,
        translation: buildCompiledText(translated),
        status: 'translated',
        tokens: translated.tokens,
        isCustomEdited: false,
        customText: buildCompiledText(translated),
        editMode: 'interactive',
        rawTranslation: translated.rawTranslation,
        translationStructure: translated.translationStructure,
      };
      await saveSegment(updated);
    }
  }

  const total = allSegments.length;
  const translated = allSegments.filter(s => s.status !== 'pending').length;
  const chapterTitle = batch[0].chapterTitle || `第${currentChapterIndex + 1}章`;

  onProgress(translated, total, chapterTitle);

  return { done: false, translatedCount: batch.length };
}

function buildCompiledText(seg: TranslationSegment): string {
  if (seg.isCustomEdited) return seg.customText;
  return seg.translationStructure
    .map(part => {
      if (part.type === 'text') return part.value;
      return seg.tokens.find(t => t.id === part.value)?.currentTranslation || '';
    })
    .join('');
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export async function exportBookAsText(bookId: string): Promise<string> {
  const segments = await getSegmentsByBook(bookId);
  if (segments.length === 0) return '';

  const lines: string[] = [];
  let lastChapter = -1;

  for (const seg of segments) {
    if (seg.chapterIndex !== lastChapter) {
      if (lines.length > 0) lines.push('');
      lines.push(`【${seg.chapterTitle}】`);
      lines.push('');
      lastChapter = seg.chapterIndex;
    }

    const translation = seg.isCustomEdited ? seg.customText : buildCompiledTextFromSeg(seg);
    lines.push(seg.source);
    lines.push(translation);
    lines.push('');
  }

  return lines.join('\n');
}

function buildCompiledTextFromSeg(seg: SegmentRecord): string {
  if (seg.isCustomEdited) return seg.customText;
  return seg.translationStructure
    .map(part => {
      if (part.type === 'text') return part.value;
      return seg.tokens.find(t => t.id === part.value)?.currentTranslation || '';
    })
    .join('');
}

export async function exportBookAsZip(bookId: string): Promise<Blob> {
  const segments = await getSegmentsByBook(bookId);

  // Group by chapter
  const chapterMap = new Map<number, SegmentRecord[]>();
  for (const seg of segments) {
    if (!chapterMap.has(seg.chapterIndex)) {
      chapterMap.set(seg.chapterIndex, []);
    }
    chapterMap.get(seg.chapterIndex)!.push(seg);
  }

  const files: Record<string, string> = {};
  const sortedChapters = Array.from(chapterMap.entries()).sort((a, b) => a[0] - b[0]);

  for (const [chapterIdx, segs] of sortedChapters) {
    const chapterTitle = segs[0]?.chapterTitle || `第${chapterIdx + 1}章`;
    const lines: string[] = [`【${chapterTitle}】`, ''];

    for (const seg of segs.sort((a, b) => a.segmentIndex - b.segmentIndex)) {
      const translation = seg.isCustomEdited ? seg.customText : buildCompiledTextFromSeg(seg);
      lines.push(seg.source);
      lines.push(translation);
      lines.push('');
    }

    const filename = `${String(chapterIdx).padStart(2, '0')}_${chapterTitle}.txt`;
    files[filename] = lines.join('\n');
  }

  // Add metadata
  const totalSegments = segments.length;
  const translated = segments.filter(s => s.status !== 'pending').length;
  const reviewed = segments.filter(s => s.status === 'reviewed').length;
  files['metadata.json'] = JSON.stringify({
    totalSegments,
    translated,
    reviewed,
    exportedAt: new Date().toISOString(),
  }, null, 2);

  // Create ZIP (simple implementation without external library)
  // Using JSZip would be cleaner, but let's create a simple workaround
  // For now, return a text bundle - can be replaced with JSZip later
  const allContent = Object.entries(files)
    .map(([name, content]) => `=== ${name} ===\n${content}`)
    .join('\n\n');

  return new Blob([allContent], { type: 'text/plain' });
}
