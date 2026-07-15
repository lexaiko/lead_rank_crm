import { create } from 'zustand';
import { api } from '../services/api';
import { DashboardData, CustomerStats, AIJob, ChatMessage, Lead, Admin, Role, LeadListItem, LeadsMeta, LeadsParams } from '../types';

const DEFAULT_LEADS_PARAMS: LeadsParams = {
  page: 1,
  limit: 20,
  search: '',
  status: '',
  admin_id: '',
  referral: '',
  date_from: '',
  date_to: '',
  sort_by: 'last_activity_at',
  sort_order: 'desc',
};

interface StoreState {
  dashboardData: DashboardData | null;
  admins: Admin[];
  customers: CustomerStats[];
  ignoredCustomers: CustomerStats[];
  aiQueue: AIJob[];
  activeChatMessages: ChatMessage[];
  selectedLeadId: number | null;
  activeTab: 'dashboard' | 'leads' | 'customers' | 'ai-queue' | 'reports' | 'settings' | 'users' | 'roles';
  theme: 'light' | 'dark';
  isLoading: boolean;
  isLoadingMessages: boolean;

  // Leads (server-side paginated)
  leads: LeadListItem[];
  leadsMeta: LeadsMeta | null;
  leadsLoading: boolean;
  leadsParams: LeadsParams;

  // Auth State
  user: (Admin & { permissions: Record<string, 'read' | 'write' | 'none'> }) | null;
  checkingAuth: boolean;
  roles: Role[];

  // Actions
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  fetchRoles: () => Promise<void>;
  updateRolePermissions: (roleId: number, permissions: any) => Promise<boolean>;
  createRole: (name: string) => Promise<boolean>;

  fetchDashboard: () => Promise<void>;
  fetchAdmins: () => Promise<void>;
  fetchLeads: (params?: Partial<LeadsParams>) => Promise<void>;
  setLeadsParams: (params: Partial<LeadsParams>) => void;
  resetLeadsParams: () => void;
  fetchCustomers: () => Promise<void>;
  fetchIgnoredCustomers: () => Promise<void>;
  createCustomer: (data: { nama_kontak: string; nomor_hp: string }) => Promise<boolean>;
  updateCustomer: (id: number, data: Partial<{ nama_kontak: string; nomor_hp: string; is_ignored: boolean }>) => Promise<boolean>;
  deleteCustomer: (id: number) => Promise<boolean>;
  fetchAIQueue: () => Promise<void>;
  deleteAIJob: (id: number) => Promise<boolean>;
  fetchMessages: (leadId: number) => Promise<void>;
  updateLead: (leadId: number, data: Partial<Lead>) => Promise<void>;
  createAdmin: (payload: { nama_admin: string; nomor_wa?: string; username: string; password: string; role_id: number }) => Promise<boolean>;
  updateAdmin: (id: number, payload: Partial<{ nama_admin: string; nomor_wa: string | null; username: string; password?: string; role_id: number; is_active: boolean }>) => Promise<boolean>;
  deleteAdmin: (id: number) => Promise<{ success: boolean; message?: string }>;
  toggleAdmin: (id: number) => Promise<void>;
  logoutAdmin: (id: number) => Promise<boolean>;
  triggerSweeper: () => Promise<string>;
  triggerAIWorker: () => Promise<string>;
  setTab: (tab: StoreState['activeTab']) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setSelectedLeadId: (id: number | null) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  dashboardData: null,
  admins: [],
  customers: [],
  ignoredCustomers: [],
  aiQueue: [],
  activeChatMessages: [],
  selectedLeadId: null,
  activeTab: (localStorage.getItem('activeTab') as StoreState['activeTab']) || 'dashboard',
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'dark',
  isLoading: false,
  isLoadingMessages: false,

  // Leads state
  leads: [],
  leadsMeta: null,
  leadsLoading: false,
  leadsParams: { ...DEFAULT_LEADS_PARAMS },

  // Auth State
  user: null,
  checkingAuth: true,
  roles: [],

  // Actions
  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const res = await api.login(username, password);
      if (res.success) {
        set({ user: res.data });
        return { success: true };
      }
      return { success: false, error: res.error || 'Invalid credentials' };
    } catch (e: any) {
      console.error('Error logging in', e);
      return { success: false, error: e.message || 'Error occurred' };
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Error logging out', e);
    } finally {
      set({ user: null, activeTab: 'dashboard' });
    }
  },

  checkAuth: async () => {
    set({ checkingAuth: true });
    try {
      const res = await api.getMe();
      if (res.success) {
        set({ user: res.data });
      } else {
        set({ user: null });
      }
    } catch (e) {
      console.error('Error checking auth', e);
      set({ user: null });
    } finally {
      set({ checkingAuth: false });
    }
  },

  fetchRoles: async () => {
    try {
      const res = await api.getRoles();
      if (res.success) {
        set({ roles: res.data });
      }
    } catch (e) {
      console.error('Error fetching roles', e);
    }
  },

  updateRolePermissions: async (roleId, permissions) => {
    set({ isLoading: true });
    try {
      const res = await api.updateRolePermissions(roleId, permissions);
      if (res.success) {
        await get().fetchRoles();
        const currentUser = get().user;
        if (currentUser && currentUser.role_id === roleId) {
          set({ user: { ...currentUser, permissions } });
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating role permissions', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  createRole: async (name: string) => {
    set({ isLoading: true });
    try {
      const res = await api.createRole(name);
      if (res.success) {
        await get().fetchRoles();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error creating role', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDashboard: async () => {
    try {
      const res = await api.getDashboard();
      if (res.success) {
        set({ dashboardData: res.data });
      }
    } catch (e) {
      console.error('Error fetching dashboard', e);
    }
  },

  fetchAdmins: async () => {
    try {
      const res = await api.getAdmins();
      if (res.success) {
        set({ admins: res.data });
      }
    } catch (e) {
      console.error('Error fetching admins', e);
    }
  },

  fetchLeads: async (params) => {
    const currentParams = get().leadsParams;
    const merged = params ? { ...currentParams, ...params } : currentParams;
    // Persist merged params
    if (params) set({ leadsParams: merged });
    set({ leadsLoading: true });
    try {
      const res = await api.getLeads(merged);
      if (res.success) {
        set({ leads: res.data, leadsMeta: res.meta });
      }
    } catch (e) {
      console.error('Error fetching leads', e);
    } finally {
      set({ leadsLoading: false });
    }
  },

  setLeadsParams: (params) => {
    set(state => ({ leadsParams: { ...state.leadsParams, ...params } }));
  },

  resetLeadsParams: () => {
    set({ leadsParams: { ...DEFAULT_LEADS_PARAMS } });
  },

  fetchCustomers: async () => {
    try {
      const res = await api.getCustomers();
      if (res.success) {
        set({ customers: res.data });
      }
    } catch (e) {
      console.error('Error fetching customers', e);
    }
  },

  fetchIgnoredCustomers: async () => {
    try {
      const res = await api.getIgnoredCustomers();
      if (res.success) {
        set({ ignoredCustomers: res.data });
      }
    } catch (e) {
      console.error('Error fetching ignored customers', e);
    }
  },

  createCustomer: async (data) => {
    set({ isLoading: true });
    try {
      const res = await api.createCustomer(data);
      if (res.success) {
        await get().fetchCustomers();
        await get().fetchIgnoredCustomers();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error creating customer', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  updateCustomer: async (id, data) => {
    set({ isLoading: true });
    try {
      const res = await api.updateCustomer(id, data);
      if (res.success) {
        await get().fetchDashboard();
        await get().fetchCustomers();
        await get().fetchIgnoredCustomers();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating customer', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteCustomer: async (id) => {
    set({ isLoading: true });
    try {
      const res = await api.deleteCustomer(id);
      if (res.success) {
        await get().fetchDashboard();
        await get().fetchCustomers();
        await get().fetchIgnoredCustomers();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error deleting customer', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAIQueue: async () => {
    try {
      const res = await api.getAIQueue();
      if (res.success) {
        set({ aiQueue: res.data });
      }
    } catch (e) {
      console.error('Error fetching AI queue', e);
    }
  },


  deleteAIJob: async (id) => {
    try {
      const res = await api.deleteAIJob(id);
      if (res.success) {
        await get().fetchAIQueue();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error deleting AI job', e);
      return false;
    }
  },

  fetchMessages: async (leadId: number) => {
    set({ isLoadingMessages: true });
    try {
      const res = await api.getLeadMessages(leadId);
      if (res.success) {
        set({ activeChatMessages: res.data });
      }
    } catch (e) {
      console.error('Error fetching messages', e);
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  updateLead: async (leadId: number, data: Partial<Lead>) => {
    set({ isLoading: true });
    try {
      const res = await api.updateLead(leadId, data);
      if (res.success) {
        // Refresh leads list to reflect changes
        await get().fetchLeads();
      }
    } catch (e) {
      console.error('Error updating lead', e);
    } finally {
      set({ isLoading: false });
    }
  },

  createAdmin: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await api.createAdmin(payload);
      if (res.success) {
        await get().fetchAdmins();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error creating admin', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  updateAdmin: async (id, payload) => {
    set({ isLoading: true });
    try {
      const res = await api.updateAdmin(id, payload);
      if (res.success) {
        await get().fetchAdmins();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating admin', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteAdmin: async (id) => {
    set({ isLoading: true });
    try {
      const res = await api.deleteAdmin(id);
      if (res.success) {
        await get().fetchAdmins();
        return { success: true, message: res.message };
      }
      return { success: false, message: res.error || 'Failed to delete account' };
    } catch (e: any) {
      console.error('Error deleting admin', e);
      return { success: false, message: e.message || 'Error occurred' };
    } finally {
      set({ isLoading: false });
    }
  },

  toggleAdmin: async (id: number) => {
    try {
      const { admins } = get();
      const admin = admins?.find((a: any) => a.id === id);
      const isCurrentlyActive = admin?.is_active ?? true;
      const res = isCurrentlyActive
        ? await api.deactivateAdmin(id)
        : await api.activateAdmin(id);
      if (res.success) {
        await get().fetchAdmins();
      }
    } catch (e) {
      console.error('Error toggling admin', e);
    }
  },

  logoutAdmin: async (id: number) => {
    set({ isLoading: true });
    try {
      const res = await api.logoutAdmin(id);
      if (res.success) {
        await get().fetchAdmins();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error logging out WhatsApp session', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  triggerSweeper: async () => {
    set({ isLoading: true });
    try {
      const res = await api.runSweeper();
      await get().fetchDashboard();
      return res.message;
    } catch (e: any) {
      return e.message || 'Error occurred';
    } finally {
      set({ isLoading: false });
    }
  },

  triggerAIWorker: async () => {
    set({ isLoading: true });
    try {
      const res = await api.runAIWorker();
      await get().fetchDashboard();
      await get().fetchAIQueue();
      return res.message;
    } catch (e: any) {
      return e.message || 'Error occurred';
    } finally {
      set({ isLoading: false });
    }
  },

  setTab: (tab) => {
    localStorage.setItem('activeTab', tab);
    set({ activeTab: tab });
  },

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },

  setSelectedLeadId: (id) => set({ selectedLeadId: id }),
}));
