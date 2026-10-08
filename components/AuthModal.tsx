import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: any) => void;
  forceLogin?: boolean;
}

export default function AuthModal({ isOpen, onClose, onSuccess, forceLogin = false }: AuthModalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalı ve sadece harf/rakam içermelidir.');
      return;
    }

    setLoading(true);
    const fakeEmail = `${cleanUsername}@snaproom.local`;

    try {
      if (authMode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({ 
          email: fakeEmail, 
          password,
          options: {
            data: { username: cleanUsername }
          }
        });
        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            throw new Error('Bu kullanıcı adı çoktan alınmış! Lütfen başka bir tane dene.');
          }
          throw signUpError;
        }
        
        // Auto sign-in if email confirmation is disabled (it usually is for local fake emails)
        if (data.session) {
          onSuccess?.(data.session.user);
          onClose();
        } else {
          // Fallback if not auto signed in
          setAuthMode('login');
          setError('Kayıt başarılı! Lütfen giriş yapın.');
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ 
          email: fakeEmail, 
          password 
        });
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error('Kullanıcı adı veya şifre hatalı.');
          }
          throw signInError;
        }
        if (data.session) {
          onSuccess?.(data.session.user);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={forceLogin ? undefined : onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#12151F] border border-white/10 rounded-[2rem] p-6 max-w-sm w-full shadow-2xl relative"
          >
            <button
              onClick={() => forceLogin ? router.push('/') : onClose()}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#CCFF00] flex items-center justify-center">
                <User className="w-4 h-4 text-black font-black" />
              </div>
              <h3 className="text-xl font-black text-white">SnapRoom <span className="text-[#CCFF00]">Hesabı</span></h3>
            </div>

            <div className="flex bg-black/40 rounded-xl p-1 mb-6 border border-white/10">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${authMode === 'login' ? 'bg-white/15 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${authMode === 'register' ? 'bg-white/15 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
              >
                Kayıt Ol
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold block mb-1.5 ml-1">Kullanıcı Adı</label>
                <input
                  type="text"
                  placeholder="örn: onur123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#CCFF00] transition"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold block mb-1.5 ml-1">Şifre</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#CCFF00] transition"
                />
              </div>

              {authMode === 'login' && (
                <div className="flex items-center gap-2 mt-2 ml-1">
                  <input 
                    type="checkbox" 
                    id="rememberMe" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#CCFF00] rounded"
                  />
                  <label htmlFor="rememberMe" className="text-xs text-neutral-400 cursor-pointer select-none">Beni Hatırla</label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-sm transition mt-2 disabled:opacity-50"
              >
                {loading ? 'Bekleniyor...' : authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
