import type { GlossaryTerm } from './types';
import type { LLMConfig } from './settings';
import { getSettings } from './settings';

export interface DiscoveredTerm {
  word: string;
  likelyTranslation: string;
  reason: string;
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────────

async function callDeepSeek(prompt: string, config: LLMConfig): Promise<string> {
  const url = (config.baseUrl || 'https://api.deepseek.com') + '/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(prompt: string, config: LLMConfig): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── Main discovery function ─────────────────────────────────────────────────

export async function discoverTerms(
  translatedText: string,
  glossary: GlossaryTerm[],
  sourceText?: string
): Promise<DiscoveredTerm[]> {
  const config = getSettings();

  if (!config.apiKey) {
    return []; // No discovery in demo mode
  }

  // Build term list for prompt
  const existingTerms = glossary
    .filter(t => t.source)
    .map(t => t.source.toLowerCase())
    .join(', ');

  const prompt = `You are analyzing a Chinese academic translation. Your task is to identify technical terms or proper nouns that appear to be untranslated or that may be missing from the terminology glossary.

Source text (if available): ${sourceText || 'N/A'}

Translated text: ${translatedText.slice(0, 3000)}

Known glossary terms (DO NOT report these): ${existingTerms || 'None'}

Look for:
1. Terms that remain in English/Latin/German/French in the Chinese translation
2. Technical art history terms that were not consistently translated
3. Proper nouns (artist names, artwork titles, place names) that may need verification
4. Terms that appear to be transliterated inconsistently

Return a JSON array of suspicious terms you found, in this format:
[
  {
    "word": "the term as it appears in the text",
    "likelyTranslation": "your best guess at the correct Chinese translation",
    "reason": "brief explanation of why this seems like a term that needs attention"
  }
]

If no suspicious terms are found, return an empty array [].`;

  let rawResponse: string;

  try {
    switch (config.provider) {
      case 'deepseek':
      case 'openai':
        rawResponse = await callDeepSeek(prompt, config);
        break;
      case 'gemini':
        rawResponse = await callGemini(prompt, config);
        break;
      case 'anthropic':
        // Anthropic uses different prompt format
        rawResponse = await callDeepSeek(prompt, config); // Reuse DeepSeek-style call
        break;
      default:
        return [];
    }
  } catch {
    return [];
  }

  // Parse response
  try {
    let jsonStr = rawResponse;
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
