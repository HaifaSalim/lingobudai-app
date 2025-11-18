
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../services/supabaseService';
import { LANGUAGES, DIFFICULTY_LEVELS, AVATAR_VOICES } from '../constants';
import type { UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';

const SettingsPage: React.FC = () => {
  const { userProfile, setUserProfile } = useAppStore();
  const navigate = useNavigate();
  
  const [displayName, setDisplayName] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState<UserProfile['difficulty_level']>('Beginner');
  const [avatarVoice, setAvatarVoice] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.display_name);
      setNativeLanguage(userProfile.native_language);
      setTargetLanguage(userProfile.target_language);
      setDifficultyLevel(userProfile.difficulty_level);
      setAvatarVoice(userProfile.avatar_voice);
    }
  }, [userProfile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setLoading(true);
    setMessage(null);

    const updatedProfile = {
      display_name: displayName,
      native_language: nativeLanguage,
      target_language: targetLanguage,
      difficulty_level: difficultyLevel,
      avatar_voice: avatarVoice,
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(updatedProfile)
      .eq('id', userProfile.id)
      .select()
      .single();

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setUserProfile(data);
      setMessage('Profile updated successfully!');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!userProfile) {
    return <div>Loading profile...</div>;
  }
  
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold text-peach mb-6 font-heading">Settings</h1>
      <form onSubmit={handleUpdate} className="space-y-6 bg-white dark:bg-dark-card p-8 rounded-lg shadow-lg border border-lemon dark:border-dark-peach">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Display Name</label>
          <input type="text" id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="mt-1 block w-full bg-soft-white border-periwinkle rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-peach focus:border-peach dark:bg-dark-bg dark:border-gray-600" />
        </div>
        <div>
          <label htmlFor="nativeLanguage" className="block text-sm font-medium text-gray-600 dark:text-gray-300">I speak...</label>
          <select id="nativeLanguage" value={nativeLanguage} onChange={e => setNativeLanguage(e.target.value)}
            className="mt-1 block w-full bg-soft-white border-periwinkle rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-peach focus:border-peach dark:bg-dark-bg dark:border-gray-600">
            {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="targetLanguage" className="block text-sm font-medium text-gray-600 dark:text-gray-300">I want to learn...</label>
          <select id="targetLanguage" value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}
            className="mt-1 block w-full bg-soft-white border-periwinkle rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-peach focus:border-peach dark:bg-dark-bg dark:border-gray-600">
            {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="difficultyLevel" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Difficulty Level</label>
          <select id="difficultyLevel" value={difficultyLevel} onChange={e => setDifficultyLevel(e.target.value as UserProfile['difficulty_level'])}
            className="mt-1 block w-full bg-soft-white border-periwinkle rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-peach focus:border-peach dark:bg-dark-bg dark:border-gray-600">
            {DIFFICULTY_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="avatarVoice" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Avatar Voice</label>
          <select id="avatarVoice" value={avatarVoice} onChange={e => setAvatarVoice(e.target.value)}
            className="mt-1 block w-full bg-soft-white border-periwinkle rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-peach focus:border-peach dark:bg-dark-bg dark:border-gray-600">
            {AVATAR_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <button type="submit" disabled={loading} className="bg-green hover:bg-green/80 text-gray-800 font-bold py-2 px-4 rounded disabled:opacity-60 font-accent dark:bg-dark-green/80 dark:hover:bg-dark-green dark:text-white">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}
        </div>
      </form>
      <div className="mt-8 bg-white dark:bg-dark-card p-8 rounded-lg shadow-lg border border-lemon dark:border-dark-peach">
        <h2 className="text-xl font-bold text-blush dark:text-dark-blush/90 mb-4">Account Actions</h2>
        <button onClick={handleLogout} className="bg-blush hover:bg-blush/80 text-gray-800 font-bold py-2 px-4 rounded font-accent dark:bg-dark-blush/80 dark:hover:bg-dark-blush dark:text-white">
          Log Out
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;