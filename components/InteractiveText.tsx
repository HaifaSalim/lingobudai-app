
import React from 'react';
import type { UserProfile } from '../types';


interface InteractiveTextProps {
  text: string;
  onWordDoubleClick: (word: string) => void;
  className?: string;
  highlight?: string;
  userProfile: UserProfile | null;
}

const InteractiveText: React.FC<InteractiveTextProps> = ({ text, onWordDoubleClick, className, highlight }) => {
  const handleDoubleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    // Regex to clean punctuation from the end of the word
    const word = e.currentTarget.innerText.trim().replace(/[.,!?;:"]$/, '');
    if (word) {
      onWordDoubleClick(word);
    }
  };

  const renderWordSpans = (textSegment: string, baseKey: string) => {
    return textSegment.split(/(\s+)/).map((segment, index) => (
      /\s+/.test(segment) ? (
        <React.Fragment key={`${baseKey}-${index}`}>{segment}</React.Fragment>
      ) : (
        <span 
          key={`${baseKey}-${index}`} 
          onDoubleClick={handleDoubleClick}
          className="cursor-pointer hover:bg-peach/50 dark:hover:bg-dark-peach/50 rounded-sm px-0.5 py-0.5 transition-colors"
        >
          {segment}
        </span>
      )
    ));
  };
  
  if (!highlight?.trim()) {
    return (
      <p className={className}>
        {renderWordSpans(text, 'initial')}
      </p>
    );
  }

  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));

  return (
    <p className={className}>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-lemon text-gray-800 dark:bg-dark-lemon dark:text-white rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>
            {renderWordSpans(part, `part-${i}`)}
          </React.Fragment>
        )
      )}
    </p>
  );
};

export default InteractiveText;