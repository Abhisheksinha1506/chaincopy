import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, UserPlus, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Clear error when switching modes
    React.useEffect(() => {
        setError(null);
    }, [isSignUp]);

    // Reset state when modal opens/closes
    React.useEffect(() => {
        if (!isOpen) {
            setError(null);
            setLoading(false);
            setEmail('');
            setPassword('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;

                // If identities is empty, it means the user already exists (Supabase security feature)
                if (data.user && data.user.identities && data.user.identities.length === 0) {
                    setError('An account with this email already exists. Try signing in instead!');
                    return;
                }

                alert('Success! Please check your email for the confirmation link.');
                onClose();
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onClose();
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                <div className="p-8 flex flex-col items-center">
                    <div className="mb-6 p-4 bg-zinc-900 rounded-2xl border border-white/10 shadow-xl">
                        {isSignUp ? <UserPlus className="w-8 h-8 text-white" /> : <LogIn className="w-8 h-8 text-white" />}
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
                        {isSignUp ? 'Create an Account' : 'Welcome Back'}
                    </h2>
                    <p className="text-zinc-500 text-sm mb-8 text-center">
                        {isSignUp
                            ? 'Start syncing your chains across devices securely.'
                            : 'Log in to access your synced chains and items.'}
                    </p>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2">
                                <span className="mt-0.5 whitespace-pre-wrap">{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white hover:bg-zinc-200 text-black rounded-2xl font-bold transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                                    {isSignUp ? <Sparkles className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 flex flex-col items-center gap-4">
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-zinc-500 hover:text-white text-sm transition-colors"
                        >
                            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-zinc-600 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default AuthModal;
