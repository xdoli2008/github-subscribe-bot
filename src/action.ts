import 'dotenv/config';
import { loadConfig, loadSubscriptions } from './config.js';
import { loadState, saveState, checkRepo } from './github.js';
import { createAIClient, categorizeRelease } from './ai.js';
import { splitMessages } from './formatter.js';
import { sendMessage } from './telegram.js';
import { setupLogging } from './logger.js';
import type { AppState, CategorizedRelease } from './types.js';

// Single-run entry point for GitHub Actions (no cron loop)
setupLogging();

const config = loadConfig();
const model = createAIClient(config);

if (!config.githubToken) {
  console.info(
    '[Tip] GITHUB_TOKEN not set. Using unauthenticated GitHub API (60 req/hr).',
  );
}

async function processRepo(
  repo: string,
  state: AppState,
): Promise<void> {
  const result = await checkRepo(repo, config.githubToken, state);
  const now = new Date().toISOString();

  if (result.newReleases.length === 0) {
    console.log(`[${repo}] No new releases`);
    if (result.etag && result.etag !== state[repo]?.etag) {
      state[repo] = {
        lastRelease: state[repo]?.lastRelease ?? '',
        etag: result.etag,
        lastCheck: now,
      };
    }
    return;
  }

  console.log(
    `[${repo}] Found ${result.newReleases.length} new release(s)`,
  );

  const categorized: CategorizedRelease[] = [];
  for (const release of result.newReleases) {
    categorized.push(
      await categorizeRelease(model, release, config.timezone, config.targetLang),
    );
  }

  const messages = splitMessages(repo, categorized, config.targetLang);

  for (const msg of messages) {
    const ok = await sendMessage(
      config.telegramBotToken,
      config.telegramChatId,
      msg,
    );
    if (!ok) {
      console.error(`[${repo}] Failed to send Telegram message`);
      return;
    }
  }

  state[repo] = {
    lastRelease: result.newReleases[0].tag_name,
    etag: result.etag,
    lastCheck: now,
  };
  console.log(`[${repo}] Notified, latest: ${state[repo].lastRelease}`);
}

async function run(): Promise<void> {
  const repos = loadSubscriptions();
  console.log(
    `[Check] ${new Date().toISOString()} — ${repos.length} repo(s)`,
  );

  const start = Date.now();
  const state = loadState();
  let failed = 0;

  for (const repo of repos) {
    try {
      await processRepo(repo, state);
    } catch (e) {
      console.error(`[${repo}] Unexpected error:`, e);
      failed++;
    }
  }

  saveState(state);
  console.log(
    `[Check] Done in ${Date.now() - start}ms. Repos: ${repos.length}, failed: ${failed}`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

run();
