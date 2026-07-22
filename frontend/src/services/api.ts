import { DashboardData, DashboardParams, Admin, ChatMessage, AIJob, CustomerStats, Lead, LeadListItem, LeadsMeta, LeadsParams, GreetingRule } from '../types';

const API_BASE = '/api';

export const api = {
  async getDashboard(params: DashboardParams = {}): Promise<{ success: boolean; data: DashboardData }> {
    const query = new URLSearchParams();
    if (params.admin_id)  query.set('admin_id',  params.admin_id);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to)   query.set('date_to',   params.date_to);
    const qs = query.toString();
    const res = await fetch(`${API_BASE}/dashboard${qs ? `?${qs}` : ''}`);
    return res.json();
  },

  async getAdmins(): Promise<{ success: boolean; data: Admin[] }> {
    const res = await fetch(`${API_BASE}/admins`);
    return res.json();
  },

  async createAdmin(payload: { nama_admin: string; nomor_wa?: string; username: string; password: string; role_id: number }): Promise<{ success: boolean; data: Admin }> {
    const res = await fetch(`${API_BASE}/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async toggleAdmin(id: number): Promise<{ success: boolean; data: Admin }> {
    // Deprecated: use activateAdmin or deactivateAdmin explicitly
    const res = await fetch(`${API_BASE}/admins/${id}/activate`, {
      method: 'POST',
    });
    return res.json();
  },

  async activateAdmin(id: number): Promise<{ success: boolean; data: Admin }> {
    const res = await fetch(`${API_BASE}/admins/${id}/activate`, {
      method: 'POST',
    });
    return res.json();
  },

  async deactivateAdmin(id: number): Promise<{ success: boolean; data: Admin }> {
    const res = await fetch(`${API_BASE}/admins/${id}/deactivate`, {
      method: 'POST',
    });
    return res.json();
  },

  async updateAdmin(id: number, payload: Partial<{ nama_admin: string; nomor_wa: string | null; username: string; password?: string; role_id: number; is_active: boolean }>): Promise<{ success: boolean; data: Admin }> {
    const res = await fetch(`${API_BASE}/admins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async deleteAdmin(id: number): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/admins/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async getAdminStatus(id: number): Promise<{ success: boolean; connected: boolean }> {
    const res = await fetch(`${API_BASE}/admins/${id}/status`);
    return res.json();
  },

  async logoutAdmin(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admins/${id}/logout`, {
      method: 'POST',
    });
    return res.json();
  },

  async getLeads(params: Partial<LeadsParams> = {}): Promise<{ success: boolean; data: LeadListItem[]; meta: LeadsMeta }> {
    const query = new URLSearchParams();
    if (params.page)      query.set('page',       String(params.page));
    if (params.limit)     query.set('limit',      String(params.limit));
    if (params.search)    query.set('search',     params.search);
    if (params.status)    query.set('status',     params.status);
    if (params.admin_id)  query.set('admin_id',   params.admin_id);
    if (params.referral)  query.set('referral',   params.referral);
    if (params.date_from) query.set('date_from',  params.date_from);
    if (params.date_to)   query.set('date_to',    params.date_to);
    if (params.sort_by)   query.set('sort_by',    params.sort_by);
    if (params.sort_order)query.set('sort_order', params.sort_order);
    if (params.deep_analysis) query.set('deep_analysis', params.deep_analysis);
    const res = await fetch(`${API_BASE}/leads?${query.toString()}`);
    return res.json();
  },

  async getLeadMessages(id: number): Promise<{ success: boolean; data: ChatMessage[] }> {
    const res = await fetch(`${API_BASE}/leads/${id}/messages`);
    return res.json();
  },

  async updateLead(id: number, data: Partial<Lead>): Promise<{ success: boolean; data: Lead }> {
    const res = await fetch(`${API_BASE}/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getGreetingRules(): Promise<{ success: boolean; data: GreetingRule[] }> {
    const res = await fetch(`${API_BASE}/greeting-rules`);
    return res.json();
  },

  async createGreetingRule(data: { keyword: string; source: string }): Promise<{ success: boolean; data?: GreetingRule; error?: string }> {
    const res = await fetch(`${API_BASE}/greeting-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateGreetingRule(id: number, data: Partial<{ keyword: string; source: string }>): Promise<{ success: boolean; data?: GreetingRule; error?: string }> {
    const res = await fetch(`${API_BASE}/greeting-rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteGreetingRule(id: number): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/greeting-rules/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async getAIQueue(): Promise<{ success: boolean; data: AIJob[] }> {
    const res = await fetch(`${API_BASE}/ai-queue`);
    return res.json();
  },

  async getCustomers(): Promise<{ success: boolean; data: CustomerStats[] }> {
    const res = await fetch(`${API_BASE}/customers`);
    return res.json();
  },

  async getIgnoredCustomers(): Promise<{ success: boolean; data: CustomerStats[] }> {
    const res = await fetch(`${API_BASE}/customers?ignored=true`);
    return res.json();
  },

  async createCustomer(data: { nama_kontak: string; nomor_hp: string }): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateCustomer(id: number, data: Partial<{ nama_kontak: string; nomor_hp: string; is_ignored: boolean }>): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteCustomer(id: number): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },



  async deleteAIJob(id: number): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${API_BASE}/ai-queue/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async runSweeper(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/jobs/ghosting-sweep`, {
      method: 'POST',
    });
    return res.json();
  },

  async runAIWorker(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/jobs/ai-extract`, {
      method: 'POST',
    });
    return res.json();
  },

  async login(username: string, password: string): Promise<{ success: boolean; data: any; error?: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  async logout(): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
    });
    return res.json();
  },

  async getMe(): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_BASE}/auth/me`);
    return res.json();
  },

  async getRoles(): Promise<{ success: boolean; data: any[] }> {
    const res = await fetch(`${API_BASE}/roles`);
    return res.json();
  },

  async updateRolePermissions(id: number, permissions: any): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_BASE}/roles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions }),
    });
    return res.json();
  },

  async updateRoleDataScope(id: number, data_scope: 'all' | 'own'): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_BASE}/roles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_scope }),
    });
    return res.json();
  },

  async createRole(name: string): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  },

  async getDeepAnalysis(id: number): Promise<{ success: boolean; data: any; error?: string }> {
    const res = await fetch(`${API_BASE}/leads/${id}/deep-analysis`);
    return res.json();
  },

  async deepAnalyzeLead(id: number): Promise<{ success: boolean; data: any; error?: string }> {
    const res = await fetch(`${API_BASE}/leads/${id}/deep-analysis`, {
      method: 'POST',
    });
    return res.json();
  },

  async addManualMessage(leadId: number, data: { pengirim: 'admin' | 'customer'; pesan: string; waktu_pesan: string }): Promise<{ success: boolean; data?: any; error?: string }> {
    const res = await fetch(`${API_BASE}/leads/${leadId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },
};
