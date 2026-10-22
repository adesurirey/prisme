// The manual merge CLI (free, no API): when the Grouping model split a
// Story the human judges should be one, merge them by hand. The Base Story
// survives whole — its slug, id, title, Summaries, Topic and
// summarizedArticleCount stay — and the absorbed Story's Articles move in
// as the unseen prefix, so the next `pnpm edition` run re-summarizes the
// whole set. The absorbed Story's file is deleted, edition.json is
// rewritten, and a redirect entry lands in data/redirects.json for the
// dead URL when the absorbed Story ever entered the Edition.
//
//   pnpm merge-stories <base-slug> <absorbed-slug> [--dry-run] [--yes] [--force]
//
// The argument order is the decision: base first, absorbed second. Never
// commits — it prints the git command to review and paste.

import { readFile, unlink, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { Edition, RedirectRegistry, Story } from '@prisme/domain';
import { rankStories } from '@prisme/domain';
import { mergeRedirectRegistry, mergeStories } from './merge.ts';
import { DATA_DIR, readStories, STORIES_DIR } from './paths.ts';

interface Flags {
  dryRun: boolean;
  yes: boolean;
  force: boolean;
}

function parseArgs(argv: readonly string[]): {
  baseSlug: string;
  absorbedSlug: string;
  flags: Flags;
} | null {
  const positional: string[] = [];
  const flags: Flags = { dryRun: false, yes: false, force: false };
  for (const arg of argv) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--yes') flags.yes = true;
    else if (arg === '--force') flags.force = true;
    else positional.push(arg);
  }
  if (positional.length !== 2) return null;
  return { baseSlug: positional[0], absorbedSlug: positional[1], flags };
}

function findBySlug(stories: Story[], slug: string): Story | undefined {
  return stories.find((s) => s.slug === slug);
}

async function readEdition(): Promise<Edition> {
  return JSON.parse(
    await readFile(new URL('edition.json', DATA_DIR), 'utf8'),
  ) as Edition;
}

async function readRedirects(): Promise<RedirectRegistry> {
  try {
    return JSON.parse(
      await readFile(new URL('redirects.json', DATA_DIR), 'utf8'),
    ) as RedirectRegistry;
  } catch (error) {
    // Absent before the first redirect (like topics.json, run.ts): an
    // empty registry. Any other read or parse failure fails the merge.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { redirects: [] };
  }
}

async function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${prompt} `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed == null) {
    console.error(
      'Usage: pnpm merge-stories <base-slug> <absorbed-slug> ' +
        '[--dry-run] [--yes] [--force]',
    );
    console.error(
      'The Base Story survives (slug, id, title, Summaries, Topic); the ' +
        'absorbed Story gives it its Articles and dies.',
    );
    return 1;
  }
  const { baseSlug, absorbedSlug, flags } = parsed;

  const stories = await readStories();
  const base = findBySlug(stories, baseSlug);
  const absorbed = findBySlug(stories, absorbedSlug);
  if (base == null) console.error(`No Story file for base slug: ${baseSlug}`);
  if (absorbed == null)
    console.error(`No Story file for absorbed slug: ${absorbedSlug}`);
  if (base == null || absorbed == null) return 1;

  const result = mergeStories(base, absorbed, {
    now: new Date(),
    allowCrossDay: flags.force,
    allowFrozenBase: flags.force,
  });
  if (!result.ok) {
    console.error(`Merge refused: ${result.refusal}`);
    return 1;
  }
  const { merged, redirect, warnings } = result;

  const edition = await readEdition();
  const inEdition = new Set(edition.stories.map((s) => s.id));

  console.log(
    `Merge: ${absorbed.slug} (${absorbed.articles.length} article(s)) ` +
      `into ${base.slug} (${base.articles.length} article(s)).`,
  );
  console.log(
    `Survivor: ${merged.slug} — ${merged.articles.length} article(s), ` +
      `summaries untouched (summarizedArticleCount ` +
      `${merged.summarizedArticleCount ?? 0}); the next edition run ` +
      're-summarizes the merged set.',
  );
  console.log(
    `Edition: ${base.slug} ${inEdition.has(base.id) ? 'ranks in the current edition — its entry is replaced in place' : 'is not in the current edition'}; ${absorbed.slug} ${inEdition.has(absorbed.id) ? 'is removed from it' : 'is not in it'}.`,
  );
  if (redirect != null) {
    console.log(
      `Redirect: /${redirect.from.day}/${redirect.from.slug}/ -> ` +
        `/${redirect.to.day}/${redirect.to.slug}/ (registry + stub page ` +
        'at the next web build).',
    );
  }
  for (const warning of warnings) console.warn(`⚠ ${warning}`);

  const commitCommand = `git add data && git commit -m "data: merge ${absorbed.slug} into ${base.slug}"`;
  console.log(`\nCommit afterwards:\n  ${commitCommand}\n`);

  if (flags.dryRun) {
    console.log('Dry run: nothing written.');
    return 0;
  }
  if (!flags.yes && !(await confirm('Write the merge? [y/N]'))) {
    console.log('Aborted — nothing written.');
    return 0;
  }

  await writeFile(
    new URL(`${merged.slug}.json`, STORIES_DIR),
    `${JSON.stringify(merged, null, 2)}\n`,
  );
  await unlink(new URL(`${absorbed.slug}.json`, STORIES_DIR));

  // The Edition is rebuilt from the Story files each run: replace the
  // Base's entry in place, drop the absorbed one — then re-rank with the
  // whole-life Coverage key (rankStories; the build's assembleEdition
  // ranks inside rolling windows, ADR-0027 — this immediate re-rank is
  // the merge's best guess, and the next build re-derives both windows),
  // so a Story that grew through the merge sits at its deserved rank
  // immediately instead of waiting for the next build.
  edition.stories = rankStories(
    edition.stories
      .filter((s) => s.id !== absorbed.id)
      .map((s) => (s.id === merged.id ? merged : s)),
  );
  await writeFile(
    new URL('edition.json', DATA_DIR),
    `${JSON.stringify(edition, null, 2)}\n`,
  );

  if (redirect != null) {
    const { registry, repointed } = mergeRedirectRegistry(
      await readRedirects(),
      redirect,
    );
    if (repointed > 0)
      console.log(
        `Repointed ${repointed} existing redirect(s) to the survivor.`,
      );
    await writeFile(
      new URL('redirects.json', DATA_DIR),
      `${JSON.stringify(registry, null, 2)}\n`,
    );
  }

  console.log(
    `Written: data/stories/${merged.slug}.json, data/stories/${absorbed.slug}.json deleted, data/edition.json` +
      `${redirect != null ? ', data/redirects.json' : ''}.`,
  );
  return 0;
}

main().then((code) => {
  process.exitCode = code;
});
