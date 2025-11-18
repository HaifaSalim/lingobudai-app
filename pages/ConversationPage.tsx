
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { getAIResponseStream, generateAudio, createFlashcardForWord } from '../services/geminiService';
import { supabase } from '../services/supabaseService';
import Avatar from '../components/Avatar';
import InteractiveText from '../components/InteractiveText';
import type { GeminiResponse, Flashcard, GeminiFlashcard } from '../types';
import { Mic, RefreshCw } from 'lucide-react';

// Helper functions for decoding raw PCM audio from the Gemini API
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodePcmAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const sampleRate = 24000; // Gemini TTS output sample rate
  const numChannels = 1;     // Gemini TTS output is mono
  // Use a view of the buffer that accounts for byte offset and length
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const ConversationPage: React.FC = () => {
  const { userProfile } = useAppStore();
  const [transcript, setTranscript] = useState('');
  const [avatarResponse, setAvatarResponse] = useState<GeminiResponse | null>(null);
  const [streamingReply, setStreamingReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const lastAudioRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const CONVERSATION_STARTERS = [
    "Let's talk about my day",
    "How do I order a coffee?",
    "Tell me about travel destinations",
    "What are some common hobbies?",
  ];

  useEffect(() => {
    // The TTS model returns audio at a 24000 sample rate.
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    return () => {
        audioContextRef.current?.close();
    }
  }, []);

  const showToast = (message: string, duration = 3000) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), duration);
  };

  const playAudio = useCallback(async (base64Audio: string) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
       // Re-initialize if context was closed for any reason
       audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    try {
        setIsSpeaking(true);
        const audioBytes = decode(base64Audio);
        const audioBuffer = await decodePcmAudioData(audioBytes, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        source.start(0);
    } catch (error) {
        console.error("Error playing audio:", error);
        setIsSpeaking(false);
    }
  }, []);
  
  const handleNewFlashcards = useCallback(async (flashcards: GeminiFlashcard[]) => {
    if (!userProfile || flashcards.length === 0) return;
    
    // 1. Get words from incoming flashcards
    const wordsToCheck = flashcards.map(fc => fc.word);
    
    // 2. Check which words already exist in the database for the current user
    const { data: existingCards, error: checkError } = await supabase
      .from('flashcards')
      .select('word')
      .eq('user_id', userProfile.id)
      .in('word', wordsToCheck);
      
    if(checkError) {
      console.error("Error checking for existing flashcards:", checkError);
      return;
    }
    
    const existingWordsSet = new Set(existingCards.map(c => c.word));
    
    // 3. Filter out flashcards that already exist
    const uniqueFlashcards = flashcards.filter(fc => !existingWordsSet.has(fc.word));
    
    if (uniqueFlashcards.length === 0) return;
    
    // 4. Insert only the new, unique flashcards
    const newFlashcards: Omit<Flashcard, 'id'>[] = uniqueFlashcards.map(fc => ({
        user_id: userProfile.id,
        word: fc.word,
        translation: fc.translation,
        example_sentence: fc.example_sentence,
        part_of_speech: fc.part_of_speech,
        difficulty: fc.difficulty,
        due_date: new Date().toISOString(),
        interval: 1,
        repetition: 0,
        efactor: 2.5,
    }));

    await supabase.from('flashcards').insert(newFlashcards);
  }, [userProfile]);
  
  const handleSpeechResult = useCallback(async (result: string) => {
    if (!userProfile || !result.trim()) return;

    setTranscript(result);
    setIsLoading(true);
    setAvatarResponse(null);
    setStreamingReply('');

    getAIResponseStream(result, userProfile, {
        onTextChunk: (textChunk) => {
            setStreamingReply(prev => prev + textChunk);
        },
        onComplete: (fullResponse) => {
            setAvatarResponse(fullResponse);
            setStreamingReply(fullResponse.reply); // Set final full reply
            setIsLoading(false);

            // --- Start all background tasks in parallel ---
            
            // 1. Generate and play audio (high priority)
            generateAudio(fullResponse.reply, userProfile.avatar_voice || 'Kore').then(audio => {
                if (audio) {
                    lastAudioRef.current = audio;
                    playAudio(audio); // This is async, but we don't await it to prevent blocking
                }
            });

            // 2. Handle flashcards (in background)
            handleNewFlashcards(fullResponse.flashcards);

            // 3. Save conversation (in background)
            supabase.from('conversations').insert({
                user_id: userProfile.id,
                transcript: result,
                avatar_response: fullResponse.reply,
                session_id: null,
            });
        },
        onError: (errorDetails) => {
            console.error("Streaming failed:", errorDetails.message);
            setIsLoading(false);
            if (errorDetails.isRateLimit) {
                showToast("API rate limit reached. Please wait a minute.");
                setIsRateLimited(true);
                setTimeout(() => setIsRateLimited(false), 60000); // 60-second cooldown
            } else {
                showToast(`An error occurred: ${errorDetails.message}`);
            }
        },
    });
  }, [userProfile, handleNewFlashcards, playAudio]);
  
  const handleReplayAudio = () => {
    if(lastAudioRef.current) {
        playAudio(lastAudioRef.current);
    }
  }

  const handleStartConversation = (prompt: string) => {
    if (!isListening && !isLoading) {
      handleSpeechResult(prompt);
    }
  };

  const { isListening, startListening, stopListening, hasSupport } = useSpeechRecognition(handleSpeechResult);
  
  const MicButton = () => (
    <button
      onMouseDown={startListening}
      onMouseUp={stopListening}
      onTouchStart={startListening}
      onTouchEnd={stopListening}
      disabled={!hasSupport || isLoading || isRateLimited}
      className={`relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-peach/50
        ${isListening ? 'bg-blush animate-pulse scale-110' : 'bg-peach'}
        ${isLoading || isRateLimited ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'}
        dark:focus:ring-dark-blush/50 ${isListening ? 'dark:bg-dark-blush' : 'dark:bg-dark-peach'}`}
    >
      <Mic size={40} className="text-white" />
    </button>
  );

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-between h-full relative">
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green dark:bg-dark-green text-gray-800 dark:text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-out border border-green-300 dark:border-dark-green">
            {toastMessage}
        </div>
      )}
      <div className="flex-grow flex flex-col items-center justify-center w-full">
        {(!transcript && !avatarResponse && !isLoading) ? (
            <div className="text-center animate-fade-in">
                <Avatar isSpeaking={isLoading || isSpeaking} isListening={isListening} emotion="happy" action="smile" isRateLimited={isRateLimited} />
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mt-6 mb-4 font-heading">Conversation Starters</h2>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                    {CONVERSATION_STARTERS.map((prompt) => (
                        <button 
                            key={prompt} 
                            onClick={() => handleStartConversation(prompt)}
                            className="px-4 py-2 bg-periwinkle/50 hover:bg-periwinkle text-gray-700 dark:bg-dark-periwinkle/50 dark:hover:bg-dark-periwinkle dark:text-gray-200 rounded-full text-sm font-accent transition-colors"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            </div>
        ) : (
          <div className="w-full max-w-3xl text-center">
            <Avatar 
                isSpeaking={isLoading || isSpeaking} 
                isListening={isListening} 
                emotion={avatarResponse?.emotion || 'thinking'} 
                action={avatarResponse?.avatar_action || 'smile'}
                isRateLimited={isRateLimited}
            />
            <div className="mt-6 p-4 bg-white/50 dark:bg-dark-card/50 rounded-lg min-h-[8rem] flex flex-col justify-center shadow-inner">
                <p className="text-lg text-gray-500 dark:text-gray-400 mb-2 italic">"{transcript}"</p>
                <div className="h-px bg-lemon dark:bg-dark-peach w-1/3 mx-auto my-2"></div>
                <div className="relative">
                    <InteractiveText 
                        text={streamingReply} 
                        onWordDoubleClick={() => { /* Placeholder */ }} 
                        className="text-xl text-gray-800 dark:text-gray-100"
                        userProfile={userProfile}
                    />
                    {isLoading && <span className="inline-block w-2 h-5 bg-peach dark:bg-dark-peach ml-1 animate-pulse align-middle" />}
                </div>
                {avatarResponse?.pronunciation_feedback && (
                  <p className="text-sm text-peach dark:text-dark-peach mt-3 animate-fade-in">💡 {avatarResponse.pronunciation_feedback}</p>
                )}
            </div>
             <div className="h-8 mt-2">
                {lastAudioRef.current && !isSpeaking && !isLoading && (
                  <button onClick={handleReplayAudio} className="flex items-center mx-auto text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors animate-fade-in font-accent">
                    <RefreshCw size={16} className="mr-2"/> Replay Audio
                  </button>
                )}
            </div>
          </div>
        )}
      </div>
      <div className="w-full flex justify-center p-4">
        <MicButton />
      </div>
    </div>
  );
};

export default ConversationPage;
