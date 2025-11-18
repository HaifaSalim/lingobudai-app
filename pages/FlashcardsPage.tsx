
import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../services/supabaseService';
import { generateAudio } from '../services/geminiService';
import type { Flashcard as FlashcardType } from '../types';
import Flashcard, { AudioButton } from '../components/Flashcard';

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


const FlashcardsPage: React.FC = () => {
  const { userProfile } = useAppStore();
  const [dueCards, setDueCards] = useState<FlashcardType[]>([]);
  const [allCards, setAllCards] = useState<FlashcardType[]>([]);
  const [viewMode, setViewMode] = useState<'review' | 'library'>('review');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDueCards = useCallback(async () => {
    if (!userProfile) return;
    setIsLoading(true);
    const today = new Date().toISOString();
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userProfile.id)
      .lte('due_date', today)
      .order('due_date');
    
    if (error) console.error("Error fetching due cards:", error);
    else setDueCards(data || []);
    setIsLoading(false);
    setCurrentCardIndex(0);
    setIsFlipped(false);
  }, [userProfile]);
  
  const fetchAllCards = useCallback(async () => {
    if (!userProfile) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false });
      
    if (error) console.error("Error fetching all cards:", error);
    else setAllCards(data || []);
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    if(viewMode === 'review') {
        fetchDueCards();
    } else {
        fetchAllCards();
    }
  }, [fetchDueCards, fetchAllCards, viewMode]);
  
  const playAudio = useCallback(async (text: string) => {
    if (!userProfile || !text) return;
    const audio = await generateAudio(text, userProfile.avatar_voice);
    if(audio) {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const audioBytes = decode(audio);
            const audioBuffer = await decodePcmAudioData(audioBytes, audioContext);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
        } catch (error) {
            console.error("Error playing audio:", error);
        }
    }
  }, [userProfile]);

  const updateCard = async (quality: number) => {
    if (currentCardIndex >= dueCards.length) return;
    
    const card = dueCards[currentCardIndex];
    let { repetition, interval, efactor } = card;

    if (quality < 3) {
      repetition = 0;
      interval = 1;
    } else {
      efactor = Math.max(1.3, efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * efactor);
      }
      repetition += 1;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + interval);

    await supabase
      .from('flashcards')
      .update({ repetition, interval, efactor, due_date: dueDate.toISOString() })
      .eq('id', card.id!);

    if (currentCardIndex + 1 < dueCards.length) {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentCardIndex(currentCardIndex + 1);
        }, 300);
    } else {
       setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const renderReviewMode = () => {
      if (isLoading) return <div className="text-center p-8">Loading flashcards...</div>;
      const currentCard = dueCards[currentCardIndex];
      if (!currentCard) {
        return (
          <div className="text-center p-8 flex flex-col items-center justify-center h-full">
            <h1 className="text-3xl font-bold text-green-500 dark:text-green mb-4 font-heading">All Done!</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">You've reviewed all your due flashcards for today. Great job!</p>
            <button onClick={fetchDueCards} className="bg-peach hover:bg-blush text-gray-800 font-bold py-2 px-4 rounded font-accent dark:bg-dark-peach dark:text-white dark:hover:bg-dark-blush">
                Check for more
            </button>
          </div>
        );
      }
      return (
        <div className="w-full flex flex-col items-center">
            <p className="text-gray-500 dark:text-gray-400 mb-6">Cards due: {dueCards.length - currentCardIndex}</p>
            <div className="w-full max-w-lg h-96 perspective-1000">
                <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`} onClick={() => setIsFlipped(true)}>
                    {/* Front of Review Card - Prompt with the word */}
                    <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-green to-periwinkle dark:from-dark-green/70 dark:to-dark-periwinkle/70 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-2xl hover:shadow-peach/50 transition-shadow duration-300 cursor-pointer">
                        <div className="flex-grow flex flex-col items-center justify-center">
                            <h2 className="text-4xl font-bold text-gray-800 dark:text-white break-words">{currentCard.word}</h2>
                        </div>
                        <div className="absolute bottom-4 flex flex-col items-center">
                             <AudioButton onClick={(e) => {e.stopPropagation(); playAudio(currentCard.word)}} size={24}/>
                             <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">Click card to see translation</p>
                        </div>
                    </div>
                    {/* Back of Review Card - Reveal the answer */}
                    <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-green to-periwinkle dark:from-dark-green/70 dark:to-dark-periwinkle/70 rounded-xl p-6 flex flex-col items-center justify-between text-center shadow-lg rotate-y-180">
                        <div className="w-full flex-grow flex flex-col justify-center">
                             <h2 className="text-3xl font-bold text-gray-800 dark:text-white break-words">{currentCard.word}</h2>
                            <p className="text-xl text-gray-700 dark:text-gray-200 mt-2">{currentCard.translation}</p>
                            <p className="text-lg text-gray-500 dark:text-gray-400 mt-4">({currentCard.part_of_speech})</p>
                        </div>
                        <div className="text-left w-full self-start overflow-y-auto max-h-32 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <p className="text-gray-600 dark:text-gray-300 mb-2 font-semibold">Examples:</p>
                            <ul className="text-gray-700 dark:text-gray-200 space-y-1 text-sm">
                                {(currentCard.example_sentence || '').split('\n').map((ex, i) => (
                                ex.trim() && <li key={i} className="flex items-start">
                                    <div className="flex-shrink-0 mr-1"><AudioButton onClick={(e) => {e.stopPropagation(); playAudio(ex)}} size={16} /></div>
                                    <span>{ex}</span>
                                </li>
                                ))}
                            </ul>
                        </div>
                         <AudioButton onClick={(e) => {e.stopPropagation(); playAudio(currentCard.word)}} size={24}/>
                    </div>
                </div>
            </div>
            <div className="mt-8 w-full max-w-lg min-h-[40px]">
                {isFlipped && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
                        <button onClick={() => updateCard(0)} className="bg-blush hover:opacity-80 text-gray-800 font-bold py-2 px-4 rounded font-accent dark:bg-dark-blush/80 dark:text-white dark:hover:opacity-100">Again</button>
                        <button onClick={() => updateCard(3)} className="bg-peach hover:opacity-80 text-gray-800 font-bold py-2 px-4 rounded font-accent dark:bg-dark-peach/80 dark:text-white dark:hover:opacity-100">Hard</button>
                        <button onClick={() => updateCard(4)} className="bg-periwinkle hover:opacity-80 text-gray-800 font-bold py-2 px-4 rounded font-accent dark:bg-dark-periwinkle/80 dark:text-white dark:hover:opacity-100">Good</button>
                        <button onClick={() => updateCard(5)} className="bg-green hover:opacity-80 text-gray-800 font-bold py-2 px-4 rounded font-accent dark:bg-dark-green/80 dark:text-white dark:hover:opacity-100">Easy</button>
                    </div>
                )}
            </div>
        </div>
      );
  };

  const renderLibraryMode = () => {
      if (isLoading) return <div className="text-center p-8">Loading library...</div>;
      if (allCards.length === 0) {
          return <p className="text-gray-500 dark:text-gray-400">Your flashcard library is empty. Start a conversation to create some!</p>
      }
      return (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {allCards.map(card => (
                  <Flashcard key={card.id} card={card} onPlayAudio={playAudio} />
              ))}
          </div>
      )
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center h-full">
        <h1 className="text-3xl font-bold text-peach mb-4 font-heading dark:text-[#FFDAB9]">Flashcards</h1>
        <div className="flex justify-center mb-6 border border-periwinkle rounded-lg p-1 bg-periwinkle/20 dark:border-dark-periwinkle/50 dark:bg-dark-card/50">
            <button onClick={() => setViewMode('review')} className={`px-4 py-2 text-sm font-semibold rounded-md transition ${viewMode === 'review' ? 'bg-periwinkle text-white dark:bg-dark-peach dark:text-white' : 'text-white-600 dark:text-white-300'}`}>Review Due</button>
            <button onClick={() => setViewMode('library')} className={`px-4 py-2 text-sm font-semibold rounded-md transition ${viewMode === 'library' ? 'bg-periwinkle text-white dark:bg-dark-peach dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>Library</button>
        </div>

        <div className="w-full flex-grow flex items-center justify-center">
          {viewMode === 'review' ? renderReviewMode() : renderLibraryMode()}
        </div>
    </div>
  );
};

export default FlashcardsPage;