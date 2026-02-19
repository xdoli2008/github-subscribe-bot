import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModel } from 'ai';
import type {
  AppConfig,
  GitHubRelease,
  CategorizedRelease,
  CategoryGroup,
  CategoryType,
} from './types.js';

const VALID_TYPES = new Set<CategoryType>([
  'feat', 'fix', 'perf', 'refactor', 'docs', 'other',
]);

const SYSTEM_PROMPT = `You are a GitHub Release Notes translator and categorizer.
Given release notes in any language, you MUST:
1. Translate all content to Chinese (简体中文)
2. Categorize each change into exactly one type: feat, fix, perf, refactor, docs, other
3. Return ONLY valid JSON, no markdown fences, no extra text

Output format:
{"categories":[{"type":"feat","items":["中文描述1"]},{"type":"fix","items":["中文描述2"]}]}

Rules:
- Each item should be a concise one-line description in Chinese
- Merge duplicate or very similar items
- If a change doesn't fit feat/fix/perf/refactor/docs, use "other"
- Skip CI/build/dependency-only changes unless significant
- If input is empty or meaningless, return {"categories":[]}`;

export function createAIClient(config: AppConfig): LanguageModel {
  const opts = {
    ...(config.aiBaseUrl && { baseURL: config.aiBaseUrl }),
    apiKey: config.aiApiKey,
  };

  switch (config.aiProvider) {
    case 'google':
      return createGoogleGenerativeAI(opts)(config.aiModel);
    case 'anthropic':
      return createAnthropic(opts)(config.aiModel);
    case 'openai-responses':
      return createOpenAI(opts).responses(config.aiModel);
    default:
      // .chat() ensures /v1/chat/completions format (compatible with proxies)
      return createOpenAI(opts).chat(config.aiModel);
  }
}

export async function categorizeRelease(
  model: LanguageModel,
  release: GitHubRelease,
): Promise<CategorizedRelease> {
  const base: CategorizedRelease = {
    tag: release.tag_name,
    date: release.published_at.slice(0, 10),
    url: release.html_url,
    categories: [],
  };

  if (!release.body?.trim()) return base;

  try {
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: release.body,
    });

    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned) as { categories: CategoryGroup[] };
    base.categories = parsed.categories.filter(
      (c) => VALID_TYPES.has(c.type) && c.items.length > 0,
    );
  } catch (e) {
    console.error(`[AI] Failed for ${release.tag_name}:`, e);
    base.categories = [
      { type: 'other', items: [release.body.slice(0, 500)] },
    ];
  }

  return base;
}
