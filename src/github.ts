import type { GitHubRelease, AppState, CheckResult } from './types.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
 
const STATE_PATH = resolve(import.meta.dirname, '..', 'data', 'state.json');
const API_BASE = 'https://api.github.com';
 
export function loadState(): AppState {
  try {
    const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    console.log(`[State] Loaded ${Object.keys(state).length} repo(s)`);
    return state;
  } catch {
    console.log('[State] No existing state, starting fresh');
    return {};
  }
}
 
export function saveState(state: AppState): void {
  mkdirSync(resolve(STATE_PATH, '..'), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  console.log(`[State] Saved ${Object.keys(state).length} repo(s)`);
}
 
export async function checkRepo(
  repo: string,
  token: string | undefined,
  state: AppState,
): Promise<CheckResult> {
  const repoState = state[repo];
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
 
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
 
  if (repoState?.etag) {
    headers['If-None-Match'] = repoState.etag;
  }
 
  const res = await fetch(
    `${API_BASE}/repos/${repo}/releases?per_page=30`,
    { headers },
  );
 
  if (res.status === 304) {
    return { repo, newReleases: [], etag: repoState?.etag ?? null };
  }
 
  if (res.status === 403) {
    const resetAt = res.headers.get('x-ratelimit-reset');
    if (resetAt) {
      const waitMs = Number(resetAt) * 1000 - Date.now();
      if (waitMs > 0) {
        console.warn(
          `[${repo}] Rate limited, reset in ${Math.ceil(waitMs / 1000)}s`,
        );
      }
    }
    return { repo, newReleases: [], etag: repoState?.etag ?? null };
  }
 
  if (!res.ok) {
    console.error(`[${repo}] GitHub API error: ${res.status}`);
    return { repo, newReleases: [], etag: repoState?.etag ?? null };
  }
 
  const etag = res.headers.get('etag');
  const releases = (await res.json()) as GitHubRelease[];
 
  const published = releases.filter((r) => !r.draft);
 
  if (!repoState?.lastRelease) {
    const latest = published[0];
    return {
      repo,
      newReleases: latest ? [latest] : [],
      etag,
    };
  }
 
  const newReleases: GitHubRelease[] = [];
  let matched = false;
 
  for (const r of published) {
    if (r.tag_name === repoState.lastRelease) {
      matched = true;
      break;
    }
    newReleases.push(r);
  }
 
  // 如果遍历完都没匹配到，说明 tag 格式变了或项目改名了
  if (!matched && newReleases.length > 0) {
    console.warn(
      `[${repo}] Last release '${repoState.lastRelease}' not found. ` +
      `Possible tag format change or rename. Only notifying the latest one.`,
    );
    return {
      repo,
      newReleases: [published[0]],
      etag,
    };
  }
 
  return { repo, newReleases, etag };
}
