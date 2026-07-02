import crypto from 'node:crypto';
import { env } from '../config/env';
import { resolveEzyPortalKey } from '../credentials/credentials.service';

const BP_BASE = '/api/business-partners';

export interface EzyBusinessPartner {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  status: string;
  roles: string[];
}

export interface EzyContact {
  id: string;
  bpId: string;
  firstName: string;
  lastName: string;
  role: string;
  isPrimary: boolean;
  email?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  jobTitle?: string | null;
}

export interface CreateEzyContactInput {
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  mobile?: string;
  whatsapp?: string;
  jobTitle?: string;
}

interface PagedResponse<T> {
  data: T[];
}

/**
 * Thin client for the EZY Portal tenant API (business partners + contacts),
 * mirroring the same endpoints the `ezy-portal` MCP server's bp/contact tools
 * hit. Auth is the tenant API key from the encrypted credentials store
 * (name "ezy_portal") — no env-var fallback, unlike OpenAI/DeepSeek.
 */
class EzyPortalService {
  available(): boolean {
    return Boolean(resolveEzyPortalKey());
  }

  private headers(): Record<string, string> {
    const key = resolveEzyPortalKey();
    if (!key) throw new Error('No EZY Portal API key configured');
    return {
      'X-API-Key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${env.EZY_PORTAL_BASE_URL}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), { headers: this.headers() });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`EZY Portal GET ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    // Tenant API key (X-Api-Key) callers must supply Idempotency-Key on creates —
    // one fresh key per call, since we don't retry with the same body here.
    const res = await fetch(`${env.EZY_PORTAL_BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`EZY Portal POST ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  async listBusinessPartners(query?: string): Promise<EzyBusinessPartner[]> {
    const result = await this.get<PagedResponse<EzyBusinessPartner>>(`${BP_BASE}/bp`, {
      query: query ?? '',
      page: '1',
      perPage: '50',
    });
    return result.data;
  }

  async listContacts(bpId: string): Promise<EzyContact[]> {
    const result = await this.get<PagedResponse<EzyContact>>(`${BP_BASE}/contacts`, {
      bpId,
      page: '1',
      perPage: '100',
    });
    return result.data;
  }

  async createContact(bpId: string, input: CreateEzyContactInput): Promise<EzyContact> {
    return this.post<EzyContact>(`${BP_BASE}/contacts`, { bpId, ...input });
  }
}

export const ezyPortalService = new EzyPortalService();
