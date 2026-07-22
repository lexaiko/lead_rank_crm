import { prisma } from '../config/prisma.js';

// Fallback used only when the GreetingRule table/client is unavailable (e.g. client not regenerated yet)
const DEFAULT_RULES = [
  { keyword: 'hola', source: 'tiktok' },
  { keyword: 'hi', source: 'website' },
  { keyword: 'halo', source: 'instagram' }
];

// In-memory cache. Loaded lazily on first use and refreshed ONLY when rules are
// mutated via invalidateGreetingRulesCache() — no TTL/polling.
let cache = null;

/**
 * Returns the greeting rules, from cache when available.
 */
export async function getGreetingRules() {
  if (cache !== null) return cache;
  try {
    if (prisma.greetingRule) {
      cache = await prisma.greetingRule.findMany({ orderBy: { keyword: 'asc' } });
    } else {
      const rows = await prisma.$queryRawUnsafe('SELECT * FROM GreetingRule ORDER BY keyword ASC');
      cache = rows;
    }
  } catch (err) {
    console.error('[Greeting Rules] Failed to load rules from database, using defaults:', err.message);
    return DEFAULT_RULES; // do not poison the cache so a later read can retry the DB
  }
  return cache;
}

/**
 * Clears the cache. Call after any create/update/delete of greeting rules.
 */
export function invalidateGreetingRulesCache() {
  cache = null;
  console.log('[Greeting Rules] Cache invalidated — rules will be reloaded on next use.');
}

/**
 * CRUD helpers with raw-SQL fallback for when the Prisma Client has not been
 * regenerated yet (locked engine file on Windows while the server runs).
 */
export async function createGreetingRule(keyword, source) {
  let rule;
  if (prisma.greetingRule) {
    rule = await prisma.greetingRule.create({ data: { keyword, source } });
  } else {
    await prisma.$executeRawUnsafe(
      'INSERT INTO GreetingRule (keyword, source, createdAt, updatedAt) VALUES (?, ?, NOW(3), NOW(3))',
      keyword,
      source
    );
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM GreetingRule WHERE keyword = ?', keyword);
    rule = rows[0];
  }
  invalidateGreetingRulesCache();
  return rule;
}

export async function updateGreetingRule(id, data) {
  let rule;
  if (prisma.greetingRule) {
    rule = await prisma.greetingRule.update({ where: { id }, data });
  } else {
    if (data.keyword !== undefined) {
      await prisma.$executeRawUnsafe('UPDATE GreetingRule SET keyword = ?, updatedAt = NOW(3) WHERE id = ?', data.keyword, id);
    }
    if (data.source !== undefined) {
      await prisma.$executeRawUnsafe('UPDATE GreetingRule SET source = ?, updatedAt = NOW(3) WHERE id = ?', data.source, id);
    }
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM GreetingRule WHERE id = ?', id);
    rule = rows[0];
  }
  invalidateGreetingRulesCache();
  return rule;
}

export async function deleteGreetingRule(id) {
  if (prisma.greetingRule) {
    await prisma.greetingRule.delete({ where: { id } });
  } else {
    await prisma.$executeRawUnsafe('DELETE FROM GreetingRule WHERE id = ?', id);
  }
  invalidateGreetingRulesCache();
}

/**
 * True when the error means the greeting keyword already exists (Prisma P2002 or raw MySQL 1062).
 */
export function isDuplicateKeywordError(err) {
  return err?.code === 'P2002' || /duplicate entry/i.test(err?.message || '');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detects the lead's referral source from the customer's opening greeting keyword.
 * The greeting must be the FIRST word of the message; repeated trailing letters are
 * tolerated ("haloo", "hii"). Returns the mapped source, or null when nothing matches.
 */
export async function detectReferralSourceFromGreeting(text) {
  if (!text) return null;
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return null;

  const rules = await getGreetingRules();
  // Longest keyword first so more specific greetings win
  const sorted = [...rules].sort((a, b) => b.keyword.length - a.keyword.length);

  for (const rule of sorted) {
    const keyword = String(rule.keyword || '').trim().toLowerCase();
    if (!keyword) continue;
    const escaped = escapeRegex(keyword);
    const lastChar = escapeRegex(keyword.slice(-1));
    const pattern = new RegExp(`^${escaped}${lastChar}*(?![\\p{L}\\p{N}_])`, 'u');
    if (pattern.test(cleaned)) {
      return rule.source;
    }
  }
  return null;
}
