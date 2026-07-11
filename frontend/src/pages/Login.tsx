import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Compass, Lock, User, Loader2, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await login(username, password);
      if (!res.success) {
        setError(res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#030712] font-sans antialiased">
      {/* Background dynamic ambient gradients */}
      <div className="absolute top-[-20%] left-[-20%] h-[80%] w-[80%] rounded-full bg-emerald-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] h-[80%] w-[80%] rounded-full bg-teal-500/10 blur-[150px] pointer-events-none" />

      {/* Login Card */}
      <div className="relative w-full max-w-md p-8 sm:p-10 mx-4 rounded-3xl bg-gray-900/40 border border-white/5 backdrop-blur-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center">
        
        {/* Brand Logo */}
        <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/10 mb-6">
          <Compass size={36} className="animate-spin-slow" />
        </div>

        {/* Title */}
        <h1 className="font-heading font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 text-center mb-1">
          Welcome to TripBwi CRM
        </h1>
        <p className="text-xs text-gray-400 font-semibold text-center mb-8">
          Enter credentials to manage your tour campaigns
        </p>

        {/* Error Alert */}
        {error && (
          <div className="w-full mb-6 p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs font-bold flex items-center gap-3">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          
          {/* Username */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] uppercase font-black tracking-widest text-gray-400 ml-1">
              Username
            </label>
            <div className="relative w-full">
              <User size={16} className="absolute left-4 top-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full pl-11 pr-4 py-3.5 bg-gray-950/50 border border-white/5 rounded-2xl text-sm font-semibold text-white placeholder-gray-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] uppercase font-black tracking-widest text-gray-400 ml-1">
              Password
            </label>
            <div className="relative w-full">
              <Lock size={16} className="absolute left-4 top-3.5 text-gray-500" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-11 pr-4 py-3.5 bg-gray-950/50 border border-white/5 rounded-2xl text-sm font-semibold text-white placeholder-gray-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In to Console</span>
            )}
          </button>

        </form>

      </div>
    </div>
  );
};

export default Login;
