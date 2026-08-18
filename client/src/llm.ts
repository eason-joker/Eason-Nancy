import type { LLMConfig, LLMProvider } from './settings';
import type { GlossaryTerm, TranslationSegment, TranslationToken } from './types';

// ─── Request/Response types ───────────────────────────────────────────────────

export interface TranslateResult {
  mode: string;
  segments: TranslationSegment[];
}

export interface LLMResponse {
  success: boolean;
  error?: string;
}

// ─── TermContext building ─────────────────────────────────────────────────────

const MAX_TERMS_IN_CONTEXT = 500;

function buildTermContext(terms: GlossaryTerm[]): string {
  if (terms.length === 0) return '';

  const sorted = terms
    .filter(t => t.translations && t.translations.length > 0)
    .slice(0, MAX_TERMS_IN_CONTEXT);

  return sorted
    .map(t => `- ${t.source}${t.lang !== 'en' ? ` (${t.lang})` : ''} → ${t.translations.join(' / ')}${t.note ? ` (${t.note})` : ''}`)
    .join('\n');
}

// ─── Prompt building ──────────────────────────────────────────────────────────

function buildSystemPrompt(termContext: string, sourceLang: string): string {
  return `You are a professional academic translator specializing in art history, humanities, and social sciences.

Translate the following ${sourceLang === 'en' ? 'English' : sourceLang === 'de' ? 'German' : 'French'} text to Chinese with high fidelity to academic conventions.

${termContext ? `Use the following terminology consistently:\n${termContext}` : ''}

Important rules:
- Preserve the structure: each paragraph should be translated separately
- Use formal academic Chinese register
- Keep proper nouns in the original language when appropriate
- Mark technical terms with 【term】 notation only if they appear in the terminology list above
- Return valid JSON in the format specified below`;

  // NOTE: The prompt structure above is simplified. The actual LLM calls will use structured
  // output formatting per provider to ensure reliable JSON parsing.
}

function buildUserPrompt(segments: { source: string }[], includeContext: boolean, prevEnding?: string): string {
  let prompt = '';

  if (includeContext && prevEnding) {
    prompt += `[Previous paragraph ending - for context, do not translate]:\n${prevEnding}\n\n`;
  }

  prompt += `[Translate the following ${segments.length} paragraph(s)]:\n\n`;

  segments.forEach((seg, i) => {
    prompt += `[Paragraph ${i + 1}]\n${seg.source}\n\n`;
  });

  prompt += `\nReturn JSON with an array of translated paragraphs, each containing:
{
  "index": 0,
  "translation": "the Chinese translation",
  "tokens": [
    {
      "sourceWord": "original term",
      "currentTranslation": "chosen translation",
      "category": "term|proper|style",
      "verified": false
    }
  ]
}`;

  return prompt;
}

// ─── Provider-specific API calls ─────────────────────────────────────────────

async function callDeepSeek(
  prompt: string,
  model: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const url = (baseUrl || 'https://api.deepseek.com') + '/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callMiniMax(
  prompt: string,
  model: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const url = (baseUrl || 'https://api.minimax.chat') + '/v1/text/chatcompletion_v2';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`MiniMax API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function parseLLMResponse(content: string): Array<{
  index: number;
  translation: string;
  tokens: Array<{
    sourceWord: string;
    currentTranslation: string;
    category: 'term' | 'proper' | 'style';
    verified: boolean;
  }>;
}> {
  // Try to extract JSON from the response
  let jsonStr = content;

  // Handle markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Try to find JSON array
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  const parsed = JSON.parse(jsonStr);
  return Array.isArray(parsed) ? parsed : [];
}

// ─── Main translate function ──────────────────────────────────────────────────

export async function translateBatch(
  segments: { source: string }[],
  glossary: GlossaryTerm[],
  config: LLMConfig,
  includeContext: boolean = true,
  prevEnding?: string
): Promise<TranslateResult> {
  const termContext = buildTermContext(glossary);
  const systemPrompt = buildSystemPrompt(termContext, 'en'); // TODO: make dynamic
  const userPrompt = buildUserPrompt(segments, includeContext, prevEnding);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  let rawResponse: string;

  try {
    switch (config.provider) {
      case 'deepseek':
        rawResponse = await callDeepSeek(fullPrompt, config.model, config.apiKey, config.baseUrl || '');
        break;
      case 'gemini':
        rawResponse = await callGemini(fullPrompt, config.model, config.apiKey);
        break;
      case 'openai':
        rawResponse = await callOpenAI(fullPrompt, config.model, config.apiKey);
        break;
      case 'anthropic':
        rawResponse = await callAnthropic(fullPrompt, config.model, config.apiKey);
        break;
      case 'minimax':
        rawResponse = await callMiniMax(fullPrompt, config.model, config.apiKey, config.baseUrl || '');
        break;
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  } catch (error) {
    throw new Error(`Translation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Parse and convert to TranslationSegment format
  const parsed = parseLLMResponse(rawResponse);

  const translationSegments: TranslationSegment[] = parsed.map((item, idx) => {
    const sourceSeg = segments[item.index ?? idx];

    const tokens: TranslationToken[] = (item.tokens || []).map((t, tokenIdx) => ({
      id: `token-${Date.now()}-${idx}-${tokenIdx}`,
      glossaryId: null,
      sourceWord: t.sourceWord,
      category: t.category || 'term',
      currentTranslation: t.currentTranslation,
      suggestions: [t.currentTranslation],
      note: '',
      provenance: '',
      verified: t.verified || false,
      isDiscovered: false,
    }));

    // Build translation structure (interleave text and tokens)
    let translationStructure: Array<{ type: 'text' | 'token'; value: string }> = [];
    let remaining = item.translation;

    for (const token of tokens) {
      const idx2 = remaining.indexOf(token.currentTranslation);
      if (idx2 >= 0) {
        if (idx2 > 0) {
          translationStructure.push({ type: 'text', value: remaining.slice(0, idx2) });
        }
        translationStructure.push({ type: 'token', value: token.id });
        remaining = remaining.slice(idx2 + token.currentTranslation.length);
      }
    }
    if (remaining) {
      translationStructure.push({ type: 'text', value: remaining });
    }

    return {
      id: `seg-${Date.now()}-${idx}`,
      source: sourceSeg?.source || '',
      translationStructure,
      tokens,
      rawTranslation: item.translation,
      isCustomEdited: false,
      customText: item.translation,
      editMode: 'interactive',
    };
  });

  return {
    mode: config.provider,
    segments: translationSegments,
  };
}

// ─── Fallback demo translation (when no API key configured) ──────────────────

export function demoTranslate(segments: { source: string }[]): TranslateResult {
  // Simple demo: wrap each paragraph in a basic translation structure
  const translated: TranslationSegment[] = segments.map((seg, idx) => {
    const tokens: TranslationToken[] = [];

    // Find terms that appear in the source text
    const termMatches = seg.source.match(/\b(Sfumato|Contrapposto|Mona Lisa|Renaissance|Baroque)\b/gi) || [];
    const uniqueMatches = [...new Set(termMatches.map(m => m.toLowerCase()))];

    uniqueMatches.forEach((match, tokenIdx) => {
      tokens.push({
        id: `demo-token-${idx}-${tokenIdx}`,
        glossaryId: null,
        sourceWord: match,
        category: 'term',
        currentTranslation: `[${match}]`,
        suggestions: [`[${match}]`],
        note: 'Demo mode - configure API key for real translation',
        provenance: '',
        verified: false,
        isDiscovered: false,
      });
    });

    return {
      id: `demo-seg-${Date.now()}-${idx}`,
      source: seg.source,
      translationStructure: [{ type: 'text', value: `[Demo translation of: ${seg.source.slice(0, 50)}...]` }],
      tokens,
      rawTranslation: `[Demo translation of: ${seg.source}]`,
      isCustomEdited: false,
      customText: `[Demo translation of: ${seg.source}]`,
      editMode: 'interactive',
    };
  });

  return { mode: 'demo', segments: translated };
}
