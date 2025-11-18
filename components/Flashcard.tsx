
import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { Flashcard as FlashcardType } from '../types';

/**
 * A reusable, minimal button for playing audio.
 */
export const AudioButton: React.FC<{ onClick: (e: React.MouseEvent) => void; size?: number; className?: string }> = ({ onClick, size = 20, className = '' }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-full text-gray-600 hover:bg-black/10 hover:text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-peach dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white ${className}`}
    aria-label="Play audio"
  >
    <Volume2 size={size} />
  </button>
);

interface FlashcardProps {
  card: FlashcardType;
  onPlayAudio: (text: string) => void;
}

/**
 * A visually appealing flashcard component for the library view.
 * Features a flip animation, gradient backgrounds, and clear typography.
 */
const Flashcard: React.FC<FlashcardProps> = ({ card, onPlayAudio }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div 
            className="w-full h-56 perspective-1000 group cursor-pointer" 
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                {/* Card Front */}
                <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-green to-periwinkle dark:from-dark-green/70 dark:to-dark-periwinkle/70 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-lg group-hover:shadow-2xl group-hover:shadow-blush/50 transition-shadow duration-300">
                    <div className="flex-grow flex flex-col items-center justify-center">
                        <h3 className="text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white break-words">{card.word}</h3>
                        <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">{card.translation}</p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">({card.part_of_speech})</p>
                    <div className="absolute bottom-2">
                        <AudioButton onClick={(e) => { e.stopPropagation(); onPlayAudio(card.word); }} />
                    </div>
                </div>

                {/* Card Back */}
                <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-green to-periwinkle dark:from-dark-green/70 dark:to-dark-periwinkle/70 rounded-xl p-6 flex flex-col justify-between text-center shadow-lg rotate-y-180">
                    <div className="w-full">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{card.translation}</h3>
                        <div className="text-left text-sm text-gray-700 dark:text-gray-200 mt-3 space-y-1 max-h-28 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {(card.example_sentence || '').split('\n').map((ex, i) => (
                                ex.trim() && (
                                    <div key={i} className="flex items-start">

                                        <div className="flex-shrink-0 -ml-2 mr-1">
                                            <AudioButton onClick={(e) => { e.stopPropagation(); onPlayAudio(ex); }} size={14} />
                                        </div>
                                        <span>{ex}</span>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                    <div className="self-center">
                     </div>
                </div>
            </div>
        </div>
    );
};

export default Flashcard;