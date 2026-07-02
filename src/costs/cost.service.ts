import { query } from '../db';
import { env } from '../config/env';

export type CostProvider = 'openai' | 'deepseek';
export type CostOperation = 'transcription' | 'translation';

export interface CostEntry {
  id: string;
  provider: CostProvider;
  operation: CostOperation;
  message_id: string | null;
  audio_seconds: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number;
  created_at: string;
}

export interface ProviderCostSummary {
  provider: CostProvider;
  calls: number;
  cost_usd: number;
}

export interface DailyCost {
  day: string;
  provider: CostProvider;
  cost_usd: number;
}

/**
 * Owns all `api_costs` SQL. Pricing is derived from the OpenAI and DeepSeek
 * cost-per-unit env vars (see config/env.ts) — these are estimates the user
 * must verify against current provider pricing; a rate change only affects
 * calls recorded after the change, past rows keep their original cost_usd.
 */
class CostService {
  /** Record one OpenAI transcription call. */
  async recordTranscription(opts: { messageId: string | number; audioSeconds: number }): Promise<void> {
    const costUsd = (opts.audioSeconds / 60) * env.OPENAI_TRANSCRIBE_COST_PER_MINUTE;
    await query(
      `INSERT INTO api_costs (provider, operation, message_id, audio_seconds, cost_usd)
       VALUES ('openai', 'transcription', $1, $2, $3)`,
      [opts.messageId, opts.audioSeconds, costUsd],
    );
  }

  /** Record one DeepSeek translation call (one row per API call, not per message). */
  async recordTranslation(opts: {
    messageId: string | number;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    const costUsd =
      (opts.inputTokens / 1_000_000) * env.DEEPSEEK_INPUT_COST_PER_1M_TOKENS +
      (opts.outputTokens / 1_000_000) * env.DEEPSEEK_OUTPUT_COST_PER_1M_TOKENS;
    await query(
      `INSERT INTO api_costs (provider, operation, message_id, input_tokens, output_tokens, cost_usd)
       VALUES ('deepseek', 'translation', $1, $2, $3, $4)`,
      [opts.messageId, opts.inputTokens, opts.outputTokens, costUsd],
    );
  }

  /** Per-provider totals within an optional date range (defaults to all time). */
  async summary(opts: { from?: Date; to?: Date } = {}): Promise<ProviderCostSummary[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (opts.from) {
      params.push(opts.from);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (opts.to) {
      params.push(opts.to);
      conditions.push(`created_at < $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query<{ provider: CostProvider; calls: string; cost_usd: string }>(
      `SELECT provider, COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS cost_usd
         FROM api_costs
         ${where}
        GROUP BY provider
        ORDER BY provider`,
      params,
    );
    return rows.map((r) => ({ provider: r.provider, calls: Number(r.calls), cost_usd: Number(r.cost_usd) }));
  }

  /** Total cost across all providers within a date range. */
  async totalCost(opts: { from?: Date; to?: Date } = {}): Promise<number> {
    const rows = await this.summary(opts);
    return rows.reduce((sum, r) => sum + r.cost_usd, 0);
  }

  /** Recent cost entries, newest first. */
  async listRecent(limit = 100): Promise<CostEntry[]> {
    const { rows } = await query<CostEntry>(
      `SELECT id, provider, operation, message_id, audio_seconds, input_tokens, output_tokens, cost_usd, created_at
         FROM api_costs
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit],
    );
    // NUMERIC columns come back as strings from the pg driver — coerce to numbers.
    return rows.map((r) => ({
      ...r,
      audio_seconds: r.audio_seconds != null ? Number(r.audio_seconds) : null,
      cost_usd: Number(r.cost_usd),
    }));
  }

  /** Daily cost totals per provider within a range — for a simple trend table. */
  async dailyBreakdown(opts: { from: Date; to?: Date }): Promise<DailyCost[]> {
    const params: unknown[] = [opts.from];
    let where = `created_at >= $1`;
    if (opts.to) {
      params.push(opts.to);
      where += ` AND created_at < $2`;
    }
    const { rows } = await query<{ day: string; provider: CostProvider; cost_usd: string }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              provider, COALESCE(SUM(cost_usd), 0) AS cost_usd
         FROM api_costs
        WHERE ${where}
        GROUP BY day, provider
        ORDER BY day ASC`,
      params,
    );
    return rows.map((r) => ({ day: r.day, provider: r.provider, cost_usd: Number(r.cost_usd) }));
  }
}

export const costService = new CostService();
