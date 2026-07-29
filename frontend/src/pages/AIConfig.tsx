import React, { useEffect, useState } from 'react';
import { api } from '../store/services/api';
import {
  Sparkles, Key, CheckCircle2, AlertCircle, Loader2, Save, Eye, EyeOff,
  Plus, Trash2, ArrowUp, ArrowDown, Power, Edit3, ShieldAlert, Cpu, RefreshCw, Zap,
  RotateCcw, Activity, Layers, Clock, X
} from 'lucide-react';

interface GeminiKeyItem {
  id: number;
  label: string;
  api_key_masked: string;
  is_active: boolean;
  total_calls: number;
  rate_limit_hits: number;
  rate_limited_until?: string;
  is_cooling_down: boolean;
  last_used_at?: string;
}

interface AIModelItem {
  id: number;
  model_name: string;
  priority: number;
  is_active: boolean;
  description?: string;
}

export const AIConfig: React.FC = () => {
  // API Keys State
  const [keys, setKeys] = useState<GeminiKeyItem[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string; snippet?: string } | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Key Modal Form State
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<GeminiKeyItem | null>(null);
  const [formKeyLabel, setFormKeyLabel] = useState('');
  const [formKeyValue, setFormKeyValue] = useState('');
  const [formKeyActive, setFormKeyActive] = useState(true);
  const [showFormKey, setShowFormKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  // Models State
  const [models, setModels] = useState<AIModelItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Model Modal Form State
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModelItem | null>(null);
  const [formModelName, setFormModelName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [savingModel, setSavingModel] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await api.getAIConfig();
      if (res.success && res.data) {
        setKeys(res.data.keys || []);
        setHasApiKey(res.data.hasApiKey);
        setModels(res.data.models || []);
      }
    } catch (err) {
      console.error('Failed to fetch AI Config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Open Key Modal
  const handleOpenKeyModal = (keyItem?: GeminiKeyItem) => {
    if (keyItem) {
      setEditingKey(keyItem);
      setFormKeyLabel(keyItem.label);
      setFormKeyValue('');
      setFormKeyActive(keyItem.is_active);
    } else {
      setEditingKey(null);
      setFormKeyLabel(`Key ${keys.length + 1}`);
      setFormKeyValue('');
      setFormKeyActive(true);
    }
    setShowFormKey(false);
    setIsKeyModalOpen(true);
  };

  // Save Key (Create or Update)
  const handleSaveKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey(true);
    setTestResult(null);
    setNotice(null);
    try {
      let res;
      if (editingKey) {
        res = await api.updateGeminiApiKey(editingKey.id, {
          label: formKeyLabel.trim(),
          ...(formKeyValue.trim() ? { api_key: formKeyValue.trim() } : {}),
          is_active: formKeyActive
        });
      } else {
        if (!formKeyValue.trim()) {
          setNotice({ type: 'error', message: 'String API Key wajib diisi.' });
          setSavingKey(false);
          return;
        }
        res = await api.createGeminiApiKey({
          label: formKeyLabel.trim(),
          api_key: formKeyValue.trim(),
          is_active: formKeyActive
        });
      }
      if (res && res.success) {
        setIsKeyModalOpen(false);
        setNotice({ type: 'success', message: res.message || 'API Key berhasil disimpan!' });
        fetchConfig();
      } else {
        setNotice({ type: 'error', message: res?.error || res?.message || 'Gagal menyimpan API Key.' });
      }
    } catch (err: any) {
      console.error(err);
      setNotice({ type: 'error', message: err.message || 'Gagal menyimpan API Key.' });
    } finally {
      setSavingKey(false);
    }
  };

  // Toggle Key Active Status
  const handleToggleKeyActive = async (keyItem: GeminiKeyItem) => {
    setNotice(null);
    try {
      const res = await api.updateGeminiApiKey(keyItem.id, { is_active: !keyItem.is_active });
      if (res && res.success) {
        setNotice({ type: 'success', message: `Status API Key "${keyItem.label}" berhasil diperbarui.` });
        fetchConfig();
      } else {
        setNotice({ type: 'error', message: res?.error || 'Gagal mengubah status API Key.' });
      }
    } catch (err: any) {
      console.error(err);
      setNotice({ type: 'error', message: err.message || 'Gagal mengubah status API Key.' });
    }
  };

  // Delete Key
  const handleDeleteKey = async (id: number, label: string) => {
    setNotice(null);
    if (!window.confirm(`Apakah Anda yakin ingin menghapus API Key "${label}"?`)) return;
    try {
      const res = await api.deleteGeminiApiKey(id);
      if (res && res.success) {
        setNotice({ type: 'success', message: res.message || `API Key "${label}" berhasil dihapus.` });
        fetchConfig();
      } else {
        setNotice({ type: 'error', message: res?.error || 'Gagal menghapus API Key.' });
      }
    } catch (err: any) {
      console.error(err);
      setNotice({ type: 'error', message: err.message || 'Gagal menghapus API Key.' });
    }
  };

  // Test Specific API Key Connection
  const handleTestApiKey = async (keyId: number) => {
    setTestingKeyId(keyId);
    setTestResult(null);
    try {
      const res = await api.testGeminiApiKey(keyId);
      if (res.success) {
        setTestResult({
          type: 'success',
          message: res.message || 'Koneksi Gemini API Key berhasil!',
          snippet: res.responseSnippet
        });
      } else {
        setTestResult({
          type: 'error',
          message: res.error || 'Uji coba koneksi Gemini API Key gagal.'
        });
      }
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: err.message || 'Gagal menghubungi server Gemini.'
      });
    } finally {
      setTestingKeyId(null);
    }
  };

  // Open Model Modal for Add or Edit
  const handleOpenModelModal = (model?: AIModelItem) => {
    if (model) {
      setEditingModel(model);
      setFormModelName(model.model_name);
      setFormDescription(model.description || '');
      setFormIsActive(model.is_active);
    } else {
      setEditingModel(null);
      setFormModelName('');
      setFormDescription('');
      setFormIsActive(true);
    }
    setIsModelModalOpen(true);
  };

  // Save Model
  const handleSaveModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formModelName.trim()) return;
    setSavingModel(true);
    setNotice(null);
    try {
      let res;
      if (editingModel) {
        res = await api.updateAIModelConfig(editingModel.id, {
          model_name: formModelName.trim(),
          description: formDescription.trim(),
          is_active: formIsActive
        });
      } else {
        res = await api.createAIModelConfig({
          model_name: formModelName.trim(),
          description: formDescription.trim(),
          is_active: formIsActive
        });
      }
      if (res && res.success) {
        setIsModelModalOpen(false);
        setNotice({ type: 'success', message: (res as any)?.message || 'Model AI berhasil disimpan!' });
        fetchConfig();
      } else {
        setNotice({ type: 'error', message: res?.error || (res as any)?.message || 'Gagal menyimpan konfigurasi model AI.' });
      }
    } catch (err: any) {
      console.error(err);
      setNotice({ type: 'error', message: err.message || 'Gagal menyimpan konfigurasi model AI.' });
    } finally {
      setSavingModel(false);
    }
  };

  // Toggle Model Active/Inactive
  const handleToggleModelActive = async (model: AIModelItem) => {
    setNotice(null);
    try {
      const res = await api.updateAIModelConfig(model.id, { is_active: !model.is_active });
      if (res && res.success) {
        setNotice({ type: 'success', message: `Status Model ${model.model_name} berhasil diperbarui.` });
        fetchConfig();
      } else {
        setNotice({ type: 'error', message: (res as any)?.error || 'Gagal mengubah status Model AI.' });
      }
    } catch (err: any) {
      console.error(err);
      setNotice({ type: 'error', message: err.message || 'Gagal mengubah status Model AI.' });
    }
  };

  // Delete Model
  const handleDeleteModel = async (id: number, name: string) => {
    setNotice(null);
    if (!window.confirm(`Apakah Anda yakin ingin menghapus model "${name}"?`)) return;
    try {
      const res = await api.deleteAIModelConfig(id);
      if (res && res.success) {
        setNotice({ type: 'success', message: res.message || `Model "${name}" berhasil dihapus.` });
        fetchConfig();
      } else {
        setNotice({ type: 'error', message: res?.error || 'Gagal menghapus Model AI.' });
      }
    } catch (err: any) {
      console.error(err);
      setNotice({ type: 'error', message: err.message || 'Gagal menghapus Model AI.' });
    }
  };

  // Move Model Up/Down Priority
  const handleMovePriority = async (index: number, direction: 'up' | 'down') => {
    const newModels = [...models];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModels.length) return;

    const temp = newModels[index];
    newModels[index] = newModels[targetIndex];
    newModels[targetIndex] = temp;

    const orderedIds = newModels.map(m => m.id);
    try {
      await api.reorderAIModels(orderedIds);
      fetchConfig();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
              Multi API Key &amp; AI Models Engine
            </h1>
            <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Layers size={11} /> Smart Key Rotation Pool
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-semibold">
            Kelola banyak Google Gemini API Key secara sekaligus dengan fitur Rotasi Otomatis (Round-Robin) &amp; Failover Cooldown.
          </p>
        </div>

        <button
          onClick={fetchConfig}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-border bg-card text-foreground font-semibold text-xs rounded-xl hover:bg-muted/50 transition-all cursor-pointer shadow-xs self-start md:self-auto"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          <span>Refresh Config</span>
        </button>
      </div>

      {/* Custom Notification Alert Banner */}
      {notice && (
        <div className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between animate-fade-in ${
          notice.type === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-500'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="p-1 hover:opacity-80 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* SECTION 1: Multi Gemini API Keys Pool */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
              <Key size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-foreground">Multi API Key Rotation Pool</span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                Sistem akan bergantian memakai API Key aktif. Jika satu Key terkena limit 429, otomatis dialihkan ke Key berikutnya.
              </span>
            </div>
          </div>

          <button
            onClick={() => handleOpenKeyModal()}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-xs hover:opacity-90 transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus size={15} /> Tambah API Key
          </button>
        </div>

        {/* Test Result Message Box */}
        {testResult && (
          <div className={`p-3.5 rounded-xl border text-xs flex flex-col gap-1.5 animate-fade-in ${
            testResult.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold'
          }`}>
            <div className="flex items-center gap-2">
              {testResult.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
              <span>{testResult.message}</span>
            </div>
            {testResult.snippet && (
              <div className="p-2.5 bg-emerald-500/10 dark:bg-black/30 border border-emerald-500/20 dark:border-transparent rounded-lg font-mono text-[11px] text-emerald-800 dark:text-emerald-300 mt-1">
                Respon Test Gemini: "{testResult.snippet}"
              </div>
            )}
          </div>
        )}

        {/* API Keys Table */}
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-extrabold uppercase text-[10px] tracking-wider border-b border-border/60">
              <tr>
                <th className="py-3 px-4">Label Key</th>
                <th className="py-3 px-4">API Key String</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Total Dipanggil</th>
                <th className="py-3 px-4 text-center">Hit Limit 429</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {loading && keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground font-semibold">
                    <Loader2 size={18} className="animate-spin mx-auto mb-1 text-primary" />
                    <span>Memuat daftar API Key...</span>
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground font-semibold">
                    Belum ada API Key terdaftar. Silakan klik "Tambah API Key".
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-muted/30 transition-colors">
                    
                    {/* Label */}
                    <td className="py-3 px-4 font-bold text-foreground">
                      {k.label}
                    </td>

                    {/* Masked String */}
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {k.api_key_masked}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleKeyActive(k)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border transition-all cursor-pointer ${
                          k.is_active
                            ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {k.is_active ? 'AKTIF' : 'NON-AKTIF'}
                      </button>
                    </td>

                    {/* Total Calls */}
                    <td className="py-3 px-4 text-center font-bold text-foreground">
                      {k.total_calls}
                    </td>

                    {/* Rate Limit Hits */}
                    <td className="py-3 px-4 text-center font-bold text-rose-500">
                      {k.rate_limit_hits}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleTestApiKey(k.id)}
                          disabled={testingKeyId === k.id || !k.is_active}
                          className="px-2.5 py-1 rounded-lg bg-card border border-border text-foreground hover:bg-muted text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                          title="Uji coba koneksi API Key ini"
                        >
                          {testingKeyId === k.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} className="text-amber-500" />}
                          <span>Test</span>
                        </button>

                        <button
                          onClick={() => handleOpenKeyModal(k)}
                          className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-primary cursor-pointer"
                          title="Edit Key"
                        >
                          <Edit3 size={13} />
                        </button>

                        <button
                          onClick={() => handleDeleteKey(k.id, k.label)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 cursor-pointer"
                          title="Hapus Key"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: AI Models CRUD Table & Fallback Chain */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-foreground">Rantai Fallback Model AI (Priority Chain)</span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                Setiap request akan mencoba rantai API Key di atas. Jika semua Key pada model ini limit, otomatis berganti ke model berikutnya.
              </span>
            </div>
          </div>

          <button
            onClick={() => handleOpenModelModal()}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-xs hover:opacity-90 transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus size={15} /> Tambah Model AI
          </button>
        </div>

        {/* Models Table */}
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-extrabold uppercase text-[10px] tracking-wider border-b border-border/60">
              <tr>
                <th className="py-3 px-4 w-16 text-center">Urutan</th>
                <th className="py-3 px-4">Nama Model Gemini</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Deskripsi</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {loading && models.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground font-semibold">
                    <Loader2 size={18} className="animate-spin mx-auto mb-1 text-primary" />
                    <span>Memuat daftar model AI...</span>
                  </td>
                </tr>
              ) : models.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground font-semibold">
                    Belum ada model AI terdaftar.
                  </td>
                </tr>
              ) : (
                models.map((model, index) => (
                  <tr key={model.id} className="hover:bg-muted/30 transition-colors">
                    
                    {/* Priority Badge */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-black text-[11px] ${
                        index === 0
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        #{model.priority}
                      </span>
                    </td>

                    {/* Model Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{model.model_name}</span>
                        {index === 0 && (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                            Model Utama
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Active Status */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleModelActive(model)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                          model.is_active
                            ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {model.is_active ? 'Aktif' : 'Non-Aktif'}
                      </button>
                    </td>

                    {/* Description */}
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {model.description || '-'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleMovePriority(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp size={13} />
                        </button>

                        <button
                          onClick={() => handleMovePriority(index, 'down')}
                          disabled={index === models.length - 1}
                          className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown size={13} />
                        </button>

                        <button
                          onClick={() => handleOpenModelModal(model)}
                          className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-primary cursor-pointer"
                        >
                          <Edit3 size={13} />
                        </button>

                        <button
                          onClick={() => handleDeleteModel(model.id, model.model_name)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT KEY MODAL */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground">
                {editingKey ? `Edit API Key "${editingKey.label}"` : 'Tambah Gemini API Key Baru'}
              </h3>
              <button onClick={() => setIsKeyModalOpen(false)} className="text-muted-foreground hover:text-foreground font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveKeySubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-foreground">Label / Alias Key</label>
                <input
                  type="text"
                  placeholder="Contoh: Key 1 (Akun Pro A)"
                  value={formKeyLabel}
                  onChange={(e) => setFormKeyLabel(e.target.value)}
                  className="px-3.5 py-2 text-xs bg-muted/40 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-foreground">
                  String Gemini API Key {editingKey && <span className="text-[10px] font-normal text-muted-foreground">(Biarkan kosong jika tidak ingin mengubah)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showFormKey ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={formKeyValue}
                    onChange={(e) => setFormKeyValue(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2 text-xs bg-muted/40 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:border-primary"
                    required={!editingKey}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormKey(!showFormKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    {showFormKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <span className="text-xs font-bold text-foreground">Status Aktif Dalam Pool Rotasi</span>
                <button
                  type="button"
                  onClick={() => setFormKeyActive(!formKeyActive)}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
                    formKeyActive
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {formKeyActive ? 'AKTIF' : 'NON-AKTIF'}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={savingKey || (!editingKey && !formKeyValue.trim())}
                  className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {savingKey ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{editingKey ? 'Simpan Perubahan' : 'Tambah Key'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODEL MODAL */}
      {isModelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground">
                {editingModel ? 'Edit Model AI' : 'Tambah Model AI Baru'}
              </h3>
              <button onClick={() => setIsModelModalOpen(false)} className="text-muted-foreground hover:text-foreground font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModelSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-foreground">Nama Model Gemini</label>
                <input
                  type="text"
                  placeholder="gemini-2.5-flash-lite"
                  value={formModelName}
                  onChange={(e) => setFormModelName(e.target.value)}
                  className="px-3.5 py-2 text-xs bg-muted/40 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-foreground">Deskripsi / Catatan Performa</label>
                <input
                  type="text"
                  placeholder="Model Utama — Cepat dan Hemat Token"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="px-3.5 py-2 text-xs bg-muted/40 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <span className="text-xs font-bold text-foreground">Status Aktif Dalam Rantai Fallback</span>
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
                    formIsActive
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {formIsActive ? 'AKTIF' : 'NON-AKTIF'}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModelModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={savingModel || !formModelName.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {savingModel ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{editingModel ? 'Simpan Perubahan' : 'Tambah Model'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AIConfig;
