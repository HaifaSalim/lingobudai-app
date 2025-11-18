
import React, { useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { useThemeStore } from './store/useThemeStore';
import { supabase } from './services/supabaseService';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import ConversationPage from './pages/ConversationPage';
import ChatPage from './pages/ChatPage';
import FlashcardsPage from './pages/FlashcardsPage';
import SettingsPage from './pages/SettingsPage';
import Navbar from './components/Navbar';
import Tooltip from './components/Tooltip';

const App: React.FC = () => {
  const { session, userProfile, setSession, setUserProfile, clearState } = useAppStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
  }, [theme]);

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
        console.error('Error fetching profile:', error.message);
      } else if (data) {
        setUserProfile(data);
      } else {
        setUserProfile(null);
      }
    } catch (err: any) {
      console.error('Caught exception while fetching profile:', err.message);
    }
  }, [setUserProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        clearState();
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, clearState, fetchUserProfile]);

  if (session === undefined) {
    return <div className="flex items-center justify-center h-screen bg-soft-white text-gray-700 dark:bg-dark-bg dark:text-dark-text">Loading...</div>;
  }
  
  const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex flex-col h-screen">
      <Navbar />
      <main className="flex-grow overflow-auto">{children}</main>
    </div>
  );

  return (
    <HashRouter>
      <Tooltip />
      <Routes>
        <Route path="/auth" element={!session ? <AuthPage /> : <Navigate to="/" />} />
        <Route 
          path="/*"
          element={
            session ? (
              userProfile?.target_language ? (
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<ConversationPage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/flashcards" element={<FlashcardsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </AppLayout>
              ) : (
                <OnboardingPage />
              )
            ) : (
              <Navigate to="/auth" />
            )
          }
        />
      </Routes>
    </HashRouter>
  );
};

export default App;