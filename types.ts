
export type UserProfile = {
  id: string;
  display_name: string;
  native_language: string;
  target_language: string;
  difficulty_level: 'Beginner' | 'Intermediate' | 'Advanced';
  avatar_voice: string;
};

export type Flashcard = {
  id?: number;
  user_id: string;
  word: string;
  translation: string;
  example_sentence: string;
  part_of_speech: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  due_date: string;
  interval: number;
  repetition: number;
  efactor: number;
};

export type GeminiFlashcard = {
  word: string;
  translation: string;
  example_sentence: string;
  part_of_speech: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
};

export type GeminiResponse = {
  reply: string;
  flashcards: GeminiFlashcard[];
  emotion: 'happy' | 'thinking' | 'teaching' | 'confused';
  avatar_action: 'talk' | 'nod' | 'wave' | 'smile';
  pronunciation_feedback: string;
};

export type Conversation = {
  id?: number;
  user_id: string;
  transcript: string;
  avatar_response: string;
  created_at?: string;
  session_id?: number | null;
  isStreaming?: boolean;
};

export type ChatSession = {
  id: number;
  user_id: string;
  title: string;
  created_at: string;
};


export enum DifficultyLevel {
    Beginner = 'Beginner',
    Intermediate = 'Intermediate',
    Advanced = 'Advanced',
}