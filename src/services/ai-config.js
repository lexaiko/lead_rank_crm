import { prisma } from '../config/prisma.js';

// Default initial model fallback list if table is empty
const DEFAULT_MODELS = [
  { model_name: 'gemini-2.5-flash-lite', priority: 1, is_active: true, description: 'Model Utama — Cepat, Hemat Token & Akurat' },
  { model_name: 'gemini-3.1-flash-lite', priority: 2, is_active: true, description: 'Cadangan Pertama — High Throughput' },
  { model_name: 'gemini-3.5-flash', priority: 3, is_active: true, description: 'Cadangan Kedua — Advanced Multimodal' },
  { model_name: 'gemini-1.5-flash', priority: 4, is_active: false, description: 'Cadangan Ketiga — Legacy Reliable' }
];

/**
 * Seed initial API Key into GeminiApiKey table if empty
 */
export async function seedDefaultApiKeys() {
  try {
    const count = await prisma.geminiApiKey.count();
    if (count === 0) {
      // Check legacy AISetting table or process.env
      const legacySetting = await prisma.aISetting.findUnique({ where: { key: 'gemini_api_key' } });
      const keyVal = (legacySetting && legacySetting.value) ? legacySetting.value.trim() : (process.env.GEMINI_API_KEY || '');
      if (keyVal) {
        await prisma.geminiApiKey.create({
          data: {
            label: 'Key Utama 1',
            api_key: keyVal,
            is_active: true
          }
        });
        console.log('[AI Multi-Key Config] Migrated primary API key into GeminiApiKey table.');
      }
    }
  } catch (err) {
    console.error('[AI Config] Error seeding default API keys:', err.message);
  }
}

/**
 * Get active Gemini API Key (backwards compatibility)
 */
export async function getGeminiApiKey() {
  const keys = await getRotatedApiKeys();
  if (keys.length > 0 && keys[0].api_key) return keys[0].api_key;
  return process.env.GEMINI_API_KEY || '';
}

/**
 * Save / Update primary Gemini API Key (backwards compatibility)
 */
export async function setGeminiApiKey(apiKey) {
  const cleanKey = String(apiKey || '').trim();
  const first = await prisma.geminiApiKey.findFirst();
  if (first) {
    return prisma.geminiApiKey.update({
      where: { id: first.id },
      data: { api_key: cleanKey, is_active: true }
    });
  } else {
    return prisma.geminiApiKey.create({
      data: { label: 'Key Utama 1', api_key: cleanKey, is_active: true }
    });
  }
}

/**
 * Get all configured Gemini API Keys
 */
export async function getAllApiKeys() {
  await seedDefaultApiKeys();
  const keys = await prisma.geminiApiKey.findMany({
    orderBy: { id: 'asc' }
  });
  return keys.map(k => ({
    id: k.id,
    label: k.label,
    api_key_masked: k.api_key ? (k.api_key.length > 8 ? `${k.api_key.slice(0, 4)}...${k.api_key.slice(-4)}` : '••••••••') : '',
    is_active: k.is_active,
    total_calls: k.total_calls,
    rate_limit_hits: k.rate_limit_hits,
    rate_limited_until: k.rate_limited_until,
    is_cooling_down: Boolean(k.rate_limited_until && new Date(k.rate_limited_until) > new Date()),
    last_used_at: k.last_used_at,
    createdAt: k.createdAt
  }));
}

/**
 * Get active API Keys ordered by Round-Robin rotation (least recently used first)
 */
export async function getRotatedApiKeys() {
  await seedDefaultApiKeys();
  const now = new Date();

  // Active keys not currently under rate limit cooldown
  const availableKeys = await prisma.geminiApiKey.findMany({
    where: {
      is_active: true,
      OR: [
        { rate_limited_until: null },
        { rate_limited_until: { lte: now } }
      ]
    },
    orderBy: [
      { last_used_at: 'asc' }, // Round Robin: least recently used key first
      { id: 'asc' }
    ]
  });

  if (availableKeys.length > 0) {
    return availableKeys;
  }

  // Fallback 1: If all active keys are in cooldown, try all active keys anyway
  const allActive = await prisma.geminiApiKey.findMany({
    where: { is_active: true },
    orderBy: { id: 'asc' }
  });
  if (allActive.length > 0) return allActive;

  // Fallback 2: Environment variable key
  if (process.env.GEMINI_API_KEY) {
    return [{ id: 0, label: 'ENV Fallback Key', api_key: process.env.GEMINI_API_KEY }];
  }
  return [];
}

/**
 * Mark API Key as used (increment counter & timestamp)
 */
export async function markApiKeyUsed(keyId) {
  if (!keyId || keyId === 0) return;
  try {
    await prisma.geminiApiKey.update({
      where: { id: keyId },
      data: {
        total_calls: { increment: 1 },
        last_used_at: new Date()
      }
    });
  } catch (_) {}
}

/**
 * Mark API Key as rate limited (429) for cooldownMinutes
 */
export async function markApiKeyRateLimited(keyId, cooldownMinutes = 10) {
  if (!keyId || keyId === 0) return;
  try {
    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);
    await prisma.geminiApiKey.update({
      where: { id: keyId },
      data: {
        rate_limit_hits: { increment: 1 },
        rate_limited_until: cooldownUntil
      }
    });
    console.warn(`[AI Multi-Key Engine] Key ID #${keyId} entered cooldown until ${cooldownUntil.toLocaleTimeString()}`);
  } catch (_) {}
}

/**
 * Add a new Gemini API Key
 */
export async function createApiKey(data) {
  const api_key = String(data.api_key || '').trim();
  if (!api_key) throw new Error('API Key wajib diisi.');
  const label = String(data.label || 'API Key Baru').trim();

  return prisma.geminiApiKey.create({
    data: {
      label,
      api_key,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true
    }
  });
}

/**
 * Update existing Gemini API Key
 */
export async function updateApiKey(id, data) {
  const updateData = {};
  if (data.label !== undefined) updateData.label = String(data.label).trim();
  if (data.api_key !== undefined) updateData.api_key = String(data.api_key).trim();
  if (data.is_active !== undefined) updateData.is_active = Boolean(data.is_active);
  if (data.reset_cooldown) updateData.rate_limited_until = null;

  return prisma.geminiApiKey.update({
    where: { id: parseInt(id) },
    data: updateData
  });
}

/**
 * Delete Gemini API Key
 */
export async function deleteApiKey(id) {
  return prisma.geminiApiKey.delete({
    where: { id: parseInt(id) }
  });
}

/**
 * Seed default models if database table is empty
 */
export async function seedDefaultAIModels() {
  const count = await prisma.aIModelConfig.count();
  if (count === 0) {
    for (const m of DEFAULT_MODELS) {
      await prisma.aIModelConfig.create({ data: m });
    }
    console.log('[AI Config] Seeded default Gemini models into database.');
  }
}

/**
 * Get all configured AI models (ordered by priority ASC)
 */
export async function getAllAIModels() {
  await seedDefaultAIModels();
  return prisma.aIModelConfig.findMany({
    orderBy: { priority: 'asc' }
  });
}

/**
 * Get active fallback model names array
 */
export async function getActiveFallbackModels() {
  try {
    await seedDefaultAIModels();
    const activeModels = await prisma.aIModelConfig.findMany({
      where: { is_active: true },
      orderBy: { priority: 'asc' }
    });
    if (activeModels.length > 0) {
      return activeModels.map(m => m.model_name);
    }
  } catch (err) {
    console.error('[AI Config] Error fetching active fallback models:', err.message);
  }
  return ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];
}

/**
 * Create a new AI Model Config
 */
export async function createAIModel(data) {
  const model_name = String(data.model_name || '').trim();
  if (!model_name) throw new Error('Nama model AI wajib diisi.');

  const existingCount = await prisma.aIModelConfig.count();
  const priority = data.priority || (existingCount + 1);

  return prisma.aIModelConfig.create({
    data: {
      model_name,
      priority,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      description: data.description ? String(data.description).trim() : null
    }
  });
}

/**
 * Update an existing AI Model Config
 */
export async function updateAIModel(id, data) {
  const updateData = {};
  if (data.model_name !== undefined) updateData.model_name = String(data.model_name).trim();
  if (data.priority !== undefined) updateData.priority = parseInt(data.priority);
  if (data.is_active !== undefined) updateData.is_active = Boolean(data.is_active);
  if (data.description !== undefined) updateData.description = String(data.description).trim();

  return prisma.aIModelConfig.update({
    where: { id: parseInt(id) },
    data: updateData
  });
}

/**
 * Delete an AI Model Config
 */
export async function deleteAIModel(id) {
  return prisma.aIModelConfig.delete({
    where: { id: parseInt(id) }
  });
}

/**
 * Reorder AI Model priorities based on array of IDs
 */
export async function reorderAIModels(orderedIds) {
  for (let index = 0; index < orderedIds.length; index++) {
    const id = parseInt(orderedIds[index]);
    await prisma.aIModelConfig.update({
      where: { id },
      data: { priority: index + 1 }
    });
  }
  return getAllAIModels();
}
