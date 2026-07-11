import { create } from 'zustand';
import { api } from '../services/api';
import { DashboardData, CustomerStats, AIJob, ChatMessage, Lead, Admin, Role } from '../types';

interface StoreState {
  dashboardData: DashboardData | null;
  customers: CustomerStats[];
  aiQueue: AIJob[];
  activeChatMessages: ChatMessage[];
  selectedLeadId: number | null;
  activeTab: 'dashboard' | 'leads' | 'customers' | 'ai-queue' | 'reports' | 'settings';
  theme: 'light' | 'dark';
  searchKeyword: string;
  filterStatus: string;
  filterReferral: string;
  filterAdmin: string;
  isLoading: boolean;
  isLoadingMessages: boolean;
  
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
  
  fetchDashboard: () => Promise<void>;
  fetchCustomers: () => Promise<void>;
  fetchAIQueue: () => Promise<void>;
  fetchMessages: (leadId: number) => Promise<void>;
  updateLead: (leadId: number, data: Partial<Lead>) => Promise<void>;
  createAdmin: (payload: { nama_admin: string; nomor_wa?: string; username: string; password: string; role_id: number }) => Promise<boolean>;
  toggleAdmin: (id: number) => Promise<void>;
  triggerSweeper: () => Promise<string>;
  triggerAIWorker: () => Promise<string>;
  setTab: (tab: StoreState['activeTab']) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setSearchKeyword: (keyword: string) => void;
  setFilterStatus: (status: string) => void;
  setFilterReferral: (referral: string) => void;
  setFilterAdmin: (admin: string) => void;
  setSelectedLeadId: (id: number | null) => void;
  resetFilters: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  dashboardData: null,
  customers: [],
  aiQueue: [],
  activeChatMessages: [],
  selectedLeadId: null,
  activeTab: 'dashboard',
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'dark',
  searchKeyword: '',
  filterStatus: 'ALL',
  filterReferral: 'ALL',
  filterAdmin: 'ALL',
  isLoading: false,
  isLoadingMessages: false,

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
          set({
            user: {
              ...currentUser,
              permissions
            }
          });
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
        await get().fetchDashboard();
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
        await get().fetchDashboard();
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

  toggleAdmin: async (id: number) => {
    try {
      const res = await api.toggleAdmin(id);
      if (res.success) {
        await get().fetchDashboard();
      }
    } catch (e) {
      console.error('Error toggling admin', e);
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

  setTab: (tab) => set({ activeTab: tab }),
  
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

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setFilterReferral: (referral) => set({ filterReferral: referral }),
  setFilterAdmin: (admin) => set({ filterAdmin: admin }),
  setSelectedLeadId: (id) => set({ selectedLeadId: id }),
  
  resetFilters: () => set({
    searchKeyword: '',
    filterStatus: 'ALL',
    filterReferral: 'ALL',
    filterAdmin: 'ALL'
  }),
}));
