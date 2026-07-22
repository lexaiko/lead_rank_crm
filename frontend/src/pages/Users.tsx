import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { UserPlus, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, Phone, ShieldAlert, Key, UserCheck, X } from 'lucide-react';

export const Users: React.FC = () => {
  const { 
    admins, 
    fetchAdmins, 
    createAdmin, 
    updateAdmin, 
    deleteAdmin, 
    toggleAdmin,
    roles,
    fetchRoles,
    user,
    isLoading 
  } = useStore();

  useEffect(() => {
    fetchRoles();
    fetchAdmins();
  }, [fetchRoles, fetchAdmins]);

  // Local state for forms
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleIdInput, setRoleIdInput] = useState(2); // Fallback to CS (2)
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRoleId, setEditRoleId] = useState(2);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (roles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput || !usernameInput || !passwordInput) return;

    const success = await createAdmin({
      nama_admin: nameInput,
      nomor_wa: phoneInput || undefined,
      username: usernameInput,
      password: passwordInput,
      role_id: roleIdInput
    });

    if (success) {
      setFormMsg({ type: 'success', text: 'User account registered successfully!' });
      setNameInput('');
      setPhoneInput('');
      setUsernameInput('');
      setPasswordInput('');
      setRoleIdInput(roles[0]?.id || 2);
      fetchAdmins();
    } else {
      setFormMsg({ type: 'error', text: 'Failed to register user. Username or phone may already exist.' });
    }
    setTimeout(() => setFormMsg(null), 3000);
  };

  const handleOpenEdit = (adm: any) => {
    setEditingUser(adm);
    setEditName(adm.nama_admin);
    setEditPhone(adm.nomor_wa || '');
    setEditUsername(adm.username);
    setEditPassword('');
    setEditRoleId(adm.role_id);
    setEditMsg(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editName || !editUsername) return;

    const payload: any = {
      nama_admin: editName,
      nomor_wa: editPhone || null,
      username: editUsername,
      role_id: editRoleId
    };
    if (editPassword.trim()) {
      payload.password = editPassword;
    }

    const res = await updateAdmin(editingUser.id, payload);
    if (res.success) {
      setEditMsg({ type: 'success', text: 'User profile updated successfully!' });
      setTimeout(() => {
        setEditingUser(null);
        fetchAdmins();
      }, 1500);
    } else {
      setEditMsg({ type: 'error', text: res.error || 'Failed to update. Username/phone is taken.' });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (id === user?.id) {
      alert('Cannot delete your own logged-in session account.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete user "${name}"?`)) {
      return;
    }

    const res = await deleteAdmin(id);
    if (res.success) {
      alert('User account deleted successfully.');
      fetchAdmins();
    } else {
      alert(res.message || 'Failed to delete user.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title */}
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-400">
          Manajemen Pengguna
        </h1>
        <p className="text-xs text-muted-foreground font-semibold">
          Tambah, edit kredensial, sesuaikan peran (role), dan aktifkan/nonaktifkan akun admin & CS.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Users List (2 columns) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Registered Administrators & CS Agents
          </span>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ID</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Display Name</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Username</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/55 text-sm font-semibold">
                {admins.map((adm) => (
                  <tr key={adm.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5 text-muted-foreground font-mono">#{adm.id}</td>
                    <td className="px-4 py-3.5 text-foreground">{adm.nama_admin}</td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground font-normal">{adm.username}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                        {adm.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground font-normal">
                      {adm.nomor_wa || <span className="text-xs text-muted-foreground/40 italic font-sans font-normal">None</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <button 
                        onClick={() => toggleAdmin(adm.id)}
                        disabled={adm.id === user?.id}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {adm.is_active ? (
                          <span className="flex items-center gap-1 text-emerald-500 font-bold text-xs uppercase">
                            <ToggleRight size={20} /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground/60 font-bold text-xs uppercase">
                            <ToggleLeft size={20} /> Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(adm)}
                          className="p-2 border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                          title="Edit user credentials"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(adm.id, adm.nama_admin)}
                          disabled={adm.id === user?.id || adm.username === 'admin'}
                          className="p-2 border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-rose-500/5"
                          title="Delete user account"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden flex flex-col gap-3">
            {admins.map((adm) => (
              <div key={adm.id} className="p-4 bg-card border border-border/80 shadow-sm rounded-2xl flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{adm.nama_admin}</span>
                    <span className="text-[10px] text-muted-foreground font-bold tracking-wide uppercase mt-0.5">{adm.role}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">#{adm.id}</span>
                </div>
                
                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground mt-1">
                  <div className="flex justify-between">
                    <span>Username:</span>
                    <span className="font-mono text-foreground font-semibold">{adm.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span className="font-mono text-foreground">{adm.nomor_wa || 'None'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-1">
                  <button 
                    onClick={() => toggleAdmin(adm.id)}
                    disabled={adm.id === user?.id}
                    className="flex items-center gap-1 text-xs select-none cursor-pointer disabled:opacity-50"
                  >
                    {adm.is_active ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-bold uppercase text-[10px]">
                        <ToggleRight size={18} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground/60 font-bold uppercase text-[10px]">
                        <ToggleLeft size={18} /> Inactive
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(adm)}
                      className="px-3 py-1.5 border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(adm.id, adm.nama_admin)}
                      disabled={adm.id === user?.id || adm.username === 'admin'}
                      className="px-3 py-1.5 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-xl transition-all cursor-pointer disabled:opacity-30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Form Column (1 column) */}
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4 self-start">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <UserPlus size={14} className="text-primary" /> Register New Account
          </span>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            
            {formMsg && (
              <div className={`p-3.5 rounded-xl border text-xs font-bold ${
                formMsg.type === 'success' 
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' 
                  : 'border-rose-500/20 bg-rose-500/5 text-rose-500'
              }`}>
                {formMsg.text}
              </div>
            )}

            {/* Display Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Display Name</label>
              <input
                type="text"
                placeholder="e.g. Amanda Putri"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
              />
            </div>

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Login Username</label>
              <input
                type="text"
                placeholder="e.g. amandaputri"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Login Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
              />
            </div>

            {/* Role Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Access Role</label>
              <select
                value={roleIdInput}
                onChange={(e) => setRoleIdInput(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">WhatsApp Number (Optional)</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g. 62896xxxx"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <span className="text-[9px] text-muted-foreground font-semibold mt-1">
                Leave empty for monitoring-only accounts. For CS, include country prefix code (e.g., 62).
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              Register User Account
            </button>
          </form>
        </div>

      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditingUser(null)}
        >
          <div 
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border py-4.5 px-5 bg-muted/30">
              <div className="flex flex-col">
                <span className="font-bold text-sm text-foreground">Edit User Profile</span>
                <span className="text-xs text-muted-foreground font-semibold mt-0.5">Admin ID: #{editingUser.id}</span>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleUpdate} className="p-6 flex flex-col gap-4">
              {editMsg && (
                <div className={`p-3.5 rounded-xl border text-xs font-bold ${
                  editMsg.type === 'success' 
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' 
                    : 'border-rose-500/20 bg-rose-500/5 text-rose-500'
                }`}>
                  {editMsg.text}
                </div>
              )}

              {/* Display Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Login Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  disabled={editingUser.username === 'admin'}
                  required
                  className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary disabled:opacity-60"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  New Password <span className="text-[10px] text-muted-foreground lowercase normal-case">(Leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <Key size={15} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Role Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Access Role</label>
                <select
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(parseInt(e.target.value))}
                  disabled={editingUser.username === 'admin'}
                  className="w-full px-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary cursor-pointer disabled:opacity-60"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">WhatsApp Number</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="e.g. 62896xxxx"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-border/80 rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 justify-end border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isLoading && <Loader2 size={12} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;
