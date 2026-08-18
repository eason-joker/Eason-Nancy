import * as XLSX from 'xlsx';
import type { GlossaryTerm, TermCategory } from './types';

// ─── Column name mapping ──────────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, keyof GlossaryTerm> = {
  '原文': 'source',
  'source': 'source',
  'source term': 'source',
  'sourceterm': 'source',
  '术语': 'source',
  'term': 'source',
  '语种': 'lang',
  'lang': 'lang',
  'language': 'lang',
  '语言': 'lang',
  '专词类型': 'category',
  'category': 'category',
  'type': 'category',
  '类型': 'category',
  '建议候选中文译名': 'translations',
  '中文译名': 'translations',
  'translations': 'translations',
  '译名': 'translations',
  '学术释义': 'note',
  '释义': 'note',
  'note': 'note',
  '学术出处': 'provenance',
  '出处': 'provenance',
  'provenance': 'provenance',
};

function normalizeColumnName(col: string): keyof GlossaryTerm | null {
  const trimmed = col.trim().toLowerCase().replace(/\s+/g, '');
  return COLUMN_ALIASES[trimmed] || null;
}

function mapRowToTerm(row: Record<string, unknown>, lang: string): Partial<GlossaryTerm> {
  const term: Partial<GlossaryTerm> = {
    lang: lang || 'en',
    category: 'term',
    translations: [],
  };

  for (const [col, value] of Object.entries(row)) {
    const field = normalizeColumnName(col);
    if (!field || value === undefined || value === null || value === '') continue;

    const strVal = String(value).trim();

    if (field === 'source') {
      term.source = strVal;
    } else if (field === 'lang') {
      const langMap: Record<string, string> = {
        'en': 'en', 'english': 'en', '英语': 'en', '英文': 'en',
        'de': 'de', 'deutsch': 'de', 'german': 'de', '德语': 'de', '德文': 'de',
        'it': 'it', 'italian': 'it', '意语': 'it', '意文': 'it',
        'fr': 'fr', 'french': 'fr', '法语': 'fr', '法文': 'fr',
        'auto': 'auto',
      };
      term.lang = langMap[strVal.toLowerCase()] || strVal;
    } else if (field === 'category') {
      const catMap: Record<string, TermCategory> = {
        'term': 'term', '术语': 'term',
        'proper': 'proper', '专名': 'proper', 'proper noun': 'proper',
        'style': 'style', '风格': 'style', '流派': 'style',
      };
      term.category = catMap[strVal.toLowerCase()] || 'term';
    } else if (field === 'translations') {
      term.translations = strVal.split(/[,，/、;|；\n]+/).map(s => s.trim()).filter(Boolean);
    } else if (field === 'note') {
      term.note = strVal;
    } else if (field === 'provenance') {
      term.provenance = strVal;
    }
  }

  return term;
}

// ─── CSV Parser (streaming via FileReader chunking) ───────────────────────────

export async function parseCSVInStream(
  file: File,
  onRow: (term: GlossaryTerm) => void,
  onProgress: (percent: number) => void
): Promise<{ imported: number; errors: string[] }> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    return { imported: 0, errors: ['CSV 文件至少需要标题行和数据行'] };
  }

  // Parse header
  const headerLine = lines[0].replace(/^﻿/, ''); // Remove BOM
  const headers = parseCSVLine(headerLine);

  // Guess language from filename or default
  const lang = guessLangFromFilename(file.name);

  let imported = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0 || values.every(v => !v.trim())) continue;

      const row: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      const partial = mapRowToTerm(row, lang);
      if (!partial.source) {
        errors.push(`行 ${i + 1}: 缺少原文`);
        continue;
      }

      const term: GlossaryTerm = {
        id: `${partial.source}-${partial.lang}-${Date.now()}-${i}`,
        source: partial.source!,
        lang: partial.lang || 'en',
        category: partial.category || 'term',
        translations: partial.translations || [],
        note: partial.note || '',
        provenance: partial.provenance || '',
        updatedAt: Date.now(),
      };

      onRow(term);
      imported++;
      onProgress(Math.round((i / (lines.length - 1)) * 100));
    } catch (e) {
      errors.push(`行 ${i + 1}: ${e}`);
    }
  }

  return { imported, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ─── XLSX Parser ──────────────────────────────────────────────────────────────

export async function parseXLSXInStream(
  file: File,
  onRow: (term: GlossaryTerm) => void,
  onProgress: (percent: number) => void
): Promise<{ imported: number; errors: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (data.length < 2) {
    return { imported: 0, errors: ['XLSX 文件至少需要标题行和数据行'] };
  }

  const headers = Object.keys(data[0]);
  const lang = guessLangFromFilename(file.name);

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i];
      const partial = mapRowToTerm(row, lang);

      if (!partial.source) {
        errors.push(`行 ${i + 2}: 缺少原文`);
        continue;
      }

      const term: GlossaryTerm = {
        id: `${partial.source}-${partial.lang}-${Date.now()}-${i}`,
        source: partial.source!,
        lang: partial.lang || 'en',
        category: partial.category || 'term',
        translations: partial.translations || [],
        note: partial.note || '',
        provenance: partial.provenance || '',
        updatedAt: Date.now(),
      };

      onRow(term);
      imported++;
      onProgress(Math.round((i / (data.length - 1)) * 100));
    } catch (e) {
      errors.push(`行 ${i + 2}: ${e}`);
    }
  }

  return { imported, errors };
}

// ─── Unified entry point ──────────────────────────────────────────────────────

export async function parseGlossaryFile(
  file: File,
  onRow: (term: GlossaryTerm) => void,
  onProgress: (percent: number) => void
): Promise<{ imported: number; errors: string[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return parseCSVInStream(file, onRow, onProgress);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseXLSXInStream(file, onRow, onProgress);
  } else {
    return { imported: 0, errors: [`不支持的文件格式: .${ext}，仅支持 CSV/XLSX`] };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function guessLangFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('en') || lower.includes('english')) return 'en';
  if (lower.includes('de') || lower.includes('german') || lower.includes('deutsch')) return 'de';
  if (lower.includes('fr') || lower.includes('french')) return 'fr';
  if (lower.includes('it') || lower.includes('italian')) return 'it';
  return 'en'; // default
}

export function downloadCsvTemplate() {
  const csv = '﻿原文,语种,专词类型,建议候选中文译名,学术释义,学术出处\nSfumato,it,term,"晕涂法;渐隐法",达芬奇标志性技法,《艺术的故事》';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ArtTrans_术语表模板.csv';
  a.click();
  URL.revokeObjectURL(url);
}
