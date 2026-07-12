export interface Role {
  id: number;
  name: string;
  permissions: Record<string, 'read' | 'write' | 'none'>;
  createdAt: string;
  updatedAt: string;
}

export interface Admin {
  id: number;
  nama_admin: string;
  nomor_wa: string | null;
  username: string;
  role: string;
  role_id: number;
  is_active: boolean;
  connected?: boolean;
  avgReplyTime?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  nomor_hp: string;
  nama_kontak: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: number;
  kode_lead: string;
  customer_id: number;
  admin_id: number;
  status_lead: 'NEW' | 'PROSPECT' | 'QUALIFIED' | 'HOT' | 'CLOSED WON' | 'CLOSED LOST';
  minat_destinasi: string | null;
  jumlah_peserta: number | null;
  estimasi_waktu: string | null;
  catatan_khusus: string | null;
  catatan_sistem: string | null;
  referral_source: string;
  estimasi_nilai_order: number | null;
  last_activity_at: string | null;
  closed_at: string | null;
  ai_summary: string | null;
  ai_last_analyzed_message_id: number | null;
  ai_last_analyzed_at: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  admin?: Admin;
  _count?: {
    messages: number;
  };
}

export interface ChatMessage {
  id: number;
  lead_id: number;
  pengirim: 'admin' | 'customer';
  pesan: string;
  waktu_pesan: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIJob {
  id: number;
  lead_id: number;
  status: 'WAITING' | 'PROCESSING' | 'DONE' | 'FAILED';
  execute_at: string | null;
  retry_count: number;
  createdAt: string;
  updatedAt: string;
  lead?: {
    kode_lead: string;
    customerName: string;
    customerHp: string;
    adminName: string;
  } | null;
}

export interface CustomerStats {
  id: number;
  nama_kontak: string;
  nomor_hp: string;
  leadsCount: number;
  lastStatus: string;
  totalRevenue: number;
  leads: Lead[];
}

/** Flattened lead row returned by GET /leads (paginated) */
export interface LeadListItem {
  id: number;
  kode_lead: string;
  customer_id: number;
  admin_id: number;
  customerHp: string;
  customerNama: string | null;
  adminNama: string;
  status_lead: Lead['status_lead'];
  minat_destinasi: string | null;
  jumlah_peserta: number | null;
  estimasi_waktu: string | null;
  catatan_khusus: string | null;
  catatan_sistem: string | null;
  referral_source: string;
  estimasi_nilai_order: number | null;
  messagesCount: number;
  ai_summary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadsMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadsParams {
  page: number;
  limit: number;
  search: string;
  status: string;
  admin_id: string;
  referral: string;
  date_from: string;
  date_to: string;
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

export interface DashboardStats {
  totalLeads: number;
  thisMonth: {
    total: number;
    today: number;
    byStatus: Record<string, number>;
    revenue: number;
    byReferral: Record<string, number>;
    byDestination: Record<string, number>;
    byDay: Array<{ date: string; count: number }>;
  };
}

export interface DashboardData {
  admins: Array<Admin & {
    thisMonth: { assigned: number; won: number; revenue: number };
  }>;
  stats: DashboardStats;
  recentLeads: Array<{
    id: number;
    kode_lead: string;
    customerNama: string | null;
    adminNama: string;
    status_lead: Lead['status_lead'];
    minat_destinasi: string | null;
    updatedAt: string;
  }>;
  messages: {
    total: number;
    unprocessedByAi: number;
  };
}
