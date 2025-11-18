
import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      }
    } catch (error: any) {
      setError(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-white dark:bg-dark-bg px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-dark-card p-10 rounded-xl shadow-lg border border-lemon dark:border-dark-peach">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-800 dark:text-soft-white font-heading">
            {isLogin ? 'Welcome back to LingoBud AI' : 'Create your account'}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-t-md relative block w-full px-3 py-2 border border-periwinkle bg-soft-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-peach focus:border-peach focus:z-10 sm:text-sm dark:bg-dark-bg dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-500"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-b-md relative block w-full px-3 py-2 border border-periwinkle bg-soft-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-peach focus:border-peach focus:z-10 sm:text-sm dark:bg-dark-bg dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-500"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-gray-800 bg-peach hover:bg-blush focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach disabled:opacity-60 font-accent dark:text-white dark:bg-dark-peach/80 dark:hover:bg-dark-blush/80"
            >
              {loading ? 'Processing...' : isLogin ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </form>
        
        {error && <p className="text-red-500 text-center text-sm">{error}</p>}
        {message && <p className="text-green-500 text-center text-sm">{message}</p>}
        <div className="text-sm text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-peach hover:text-blush font-accent dark:text-white/90 dark:hover:text-white/90">
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
