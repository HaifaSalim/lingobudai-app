
import React from 'react';
import { Player } from '@lottiefiles/react-lottie-player';
import type { GeminiResponse } from '../types';

interface AvatarProps {
  emotion: GeminiResponse['emotion'];
  action: GeminiResponse['avatar_action'];
  isSpeaking: boolean;
  isListening: boolean;
  isRateLimited?: boolean;
}

// Placeholder for a Lottie animation. 
// You can find free animations at https://lottiefiles.com/
// For a real app, you might want animations for each state.
const AVATAR_ANIMATION_URL = "https://lottie.host/989e89d9-6306-40dc-a07d-aa14012247c4/EvRmdJIj6K.json";

const Avatar: React.FC<AvatarProps> = ({ isSpeaking, isListening, isRateLimited }) => {
  const getStatusText = () => {
    if (isRateLimited) return "API limit reached. Please wait a moment.";
    if (isListening) return "Listening...";
    if (isSpeaking) return "Thinking...";
    return "Press and hold the mic to talk";
  };
  
  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`w-64 h-64 md:w-80 md:h-80 rounded-full transition-all duration-300 ${isListening ? 'bg-peach/50 dark:bg-dark-peach/50 scale-105' : 'bg-periwinkle/30 dark:bg-dark-periwinkle/30'}`}>
        <Player
          autoplay
          loop
          src={AVATAR_ANIMATION_URL}
          style={{ height: '100%', width: '100%' }}
        />
      </div>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 h-6 font-accent">{getStatusText()}</p>
    </div>
  );
};

export default Avatar;
