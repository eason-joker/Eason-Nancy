export type LLMProvider = 'deepseek' | 'gemini' | 'openai' | 'anthropic' | 'minimax';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string;   // DeepSeek / 硅基流动用
  model: string;
  batchSize: number;  // 每批翻译段数，默认 10
}

const SETTINGS_KEY = 'arttrans_settings';

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'deepseek',
  apiKey: '',
  baseUrl: '',
  model: 'deepseek-chat',
  batchSize: 10,
};

export function getSettings(): LLMConfig {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export function saveSettings(config: LLMConfig): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
}

export function getProviderDisplayName(provider: LLMProvider): string {
  switch (provider) {
    case 'deepseek': return 'DeepSeek';
    case 'gemini': return 'Google Gemini';
    case 'openai': return 'OpenAI / ChatGPT';
    case 'anthropic': return 'Anthropic / Claude';
    case 'minimax': return 'MiniMax';
  }
}

export function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'deepseek': return 'deepseek-chat';
    case 'gemini': return 'gemini-1.5-flash';
    case 'openai': return 'gpt-4o-mini';
    case 'anthropic': return 'claude-3-haiku-20240307';
    case 'minimax': return 'MiniMax-Text-01';
  }
}
