
import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../services/supabaseService';
import { LANGUAGES, DIFFICULTY_LEVELS, AVATAR_VOICES } from '../constants';
import type { UserProfile } from '../types';

const OnboardingPage: React.FC = () => {
  const { session, setUserProfile } = useAppStore();
  const [displayName, setDisplayName] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState(LANGUAGES[0]);
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[1]);
  const [difficultyLevel, setDifficultyLevel] = useState(DIFFICULTY_LEVELS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      setError('You must be logged in to create a profile.');
      return;
    }
    setLoading(true);
    setError(null);

    const profileData: Omit<UserProfile, 'id'> = {
      display_name: displayName,
      native_language: nativeLanguage,
      target_language: targetLanguage,
      difficulty_level: difficultyLevel as UserProfile['difficulty_level'],
      avatar_voice: AVATAR_VOICES[0].id, // Default voice
    };

    try {
      // Use upsert to atomically update an existing profile or insert a new one.
      // This is more robust than separate update/insert logic.
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, ...profileData })
        .select()
        .single();
      
      if (error) throw error;
      
      setUserProfile(data);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-white dark:bg-dark-bg px-4">
      <div className="max-w-lg w-full space-y-8 bg-white dark:bg-dark-card p-10 rounded-xl shadow-lg border border-lemon dark:border-dark-peach">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-800 dark:text-soft-white font-heading">
            Welcome to LingoBud AI!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Let's set up your language learning profile.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="display_name" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Display Name</label>
            <input
              id="display_name" name="display_name" type="text" required
              className="mt-1 block w-full px-3 py-2 border border-periwinkle bg-soft-white text-gray-800 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-peach focus:border-peach sm:text-sm dark:bg-dark-bg dark:border-gray-600 dark:text-gray-200"
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="native_language" className="block text-sm font-medium text-gray-600 dark:text-gray-300">I speak...</label>
            <select id="native_language" name="native_language" required
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-periwinkle bg-soft-white text-gray-800 focus:outline-none focus:ring-peach focus:border-peach sm:text-sm rounded-md dark:bg-dark-bg dark:border-gray-600 dark:text-gray-200"
              value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)}>
              {LANGUAGES.map(lang => <option key={lang}>{lang}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="target_language" className="block text-sm font-medium text-gray-600 dark:text-gray-300">I want to learn...</label>
            <select id="target_language" name="target_language" required
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-periwinkle bg-soft-white text-gray-800 focus:outline-none focus:ring-peach focus:border-peach sm:text-sm rounded-md dark:bg-dark-bg dark:border-gray-600 dark:text-gray-200"
              value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
              {LANGUAGES.filter(l => l !== nativeLanguage).map(lang => <option key={lang}>{lang}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-gray-600 dark:text-gray-300">My level is...</label>
            <select id="difficulty" name="difficulty" required
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-periwinkle bg-soft-white text-gray-800 focus:outline-none focus:ring-peach focus:border-peach sm:text-sm rounded-md dark:bg-dark-bg dark:border-gray-600 dark:text-gray-200"
              value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value)}>
              {DIFFICULTY_LEVELS.map(level => <option key={level}>{level}</option>)}
            </select>
          </div>
          <div>
            <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-800 bg-peach hover:bg-blush focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach disabled:opacity-60 font-accent dark:text-white dark:bg-dark-peach/80 dark:hover:bg-dark-blush/80">
              {loading ? 'Saving...' : 'Start Learning'}
            </button>
          </div>
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;