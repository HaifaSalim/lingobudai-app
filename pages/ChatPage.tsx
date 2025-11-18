
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../services/supabaseService';
import { getAIResponseStream, generateAudio, createFlashcardForWord } from '../services/geminiService';
import type { Conversation, ChatSession, GeminiResponse, Flashcard, GeminiFlashcard } from '../types';
import ChatSidebar from '../components/ChatSidebar';
import InteractiveText from '../components/InteractiveText';
import { Send, Search } from 'lucide-react';

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


const ChatPage: React.FC = () => {
  const { userProfile } = useAppStore();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Conversation[]>([]);
  const [allMessages, setAllMessages] = useState<Conversation[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);


  const fetchSessions = useCallback(async () => {
    if (!userProfile) return;
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching sessions:", error.message);
    } else {
        setSessions(data || []);
        if(!activeSessionId && data && data.length > 0) {
            setActiveSessionId(data[0].id);
        }
    }
  }, [userProfile, activeSessionId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    // The TTS model returns audio at a 24000 sample rate.
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    return () => {
        audioContextRef.current?.close();
    }
  }, []);

  useEffect(() => {
    const fetchAllMessages = async () => {
        if (!userProfile) return;
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', userProfile.id);
        if (error) console.error("Error fetching all messages:", error.message);
        else setAllMessages(data || []);
    }
    fetchAllMessages();
  }, [userProfile]);


  useEffect(() => {
    const fetchMessages = async () => {
        if (!activeSessionId) {
            setMessages([]);
            return;
        };
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('session_id', activeSessionId)
          .order('created_at', { ascending: true });
        if (error) console.error("Error fetching messages:", error.message);
        else setMessages(data || []);
    };
    fetchMessages();
  }, [activeSessionId]);
  
  useEffect(() => {
    if (!searchQuery) { // Only auto-scroll when not searching
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, searchQuery]);
  
  const playAudio = useCallback(async (base64Audio: string) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    try {
        const audioBytes = decode(base64Audio);
        const audioBuffer = await decodePcmAudioData(audioBytes, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.start(0);
    } catch (error) {
        console.error("Error playing audio:", error);
    }
  }, []);

  const showToast = (message: string, duration = 3000) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), duration);
  };

  const handleNewFlashcards = useCallback(async (flashcards: GeminiFlashcard[]) => {
    if (!userProfile || flashcards.length === 0) return;

    const wordsToCheck = flashcards.map(fc => fc.word);
    
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
    const uniqueFlashcards = flashcards.filter(fc => !existingWordsSet.has(fc.word));
    
    if (uniqueFlashcards.length === 0) return;
    
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userProfile || !activeSessionId) return;

    const transcript = newMessage;
    setNewMessage('');
    
    const optimisticUserMessage: Conversation = {
        id: Date.now(),
        user_id: userProfile.id,
        transcript: transcript,
        avatar_response: '',
        session_id: activeSessionId,
        created_at: new Date().toISOString(),
    };
    
    const optimisticAIMessage: Conversation = {
        id: Date.now() + 1,
        user_id: 'ai', // Special ID for AI
        transcript: '',
        avatar_response: '',
        isStreaming: true,
        session_id: activeSessionId,
        created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticUserMessage, optimisticAIMessage]);
    setIsLoading(true);

    if(messages.length === 0) {
        const newTitle = transcript.substring(0, 30);
        await supabase.from('chat_sessions').update({ title: newTitle }).eq('id', activeSessionId);
        setSessions(prev => prev.map(s => s.id === activeSessionId ? {...s, title: newTitle} : s));
    }
    
    getAIResponseStream(transcript, userProfile, {
        onTextChunk: (textChunk) => {
            setMessages(prev => prev.map(msg => 
                msg.id === optimisticAIMessage.id 
                    ? { ...msg, avatar_response: msg.avatar_response + textChunk } 
                    : msg
            ));
        },
        onComplete: (fullResponse) => {
            setIsLoading(false);

            // Finalize optimistic AI message state
            setMessages(prev => prev.map(msg =>
                msg.id === optimisticAIMessage.id
                    ? { ...msg, avatar_response: fullResponse.reply, isStreaming: false }
                    : msg
            ));
            
            // --- Start background tasks in parallel ---
            
            // 1. Generate and play audio immediately
            generateAudio(fullResponse.reply, userProfile.avatar_voice).then(audio => {
                if (audio) playAudio(audio);
            });

            // 2. Handle flashcards in the background
            handleNewFlashcards(fullResponse.flashcards);

            // 3. Save conversation to DB and then replace optimistic messages with the real one
            supabase.from('conversations').insert({
              user_id: userProfile.id,
              transcript: transcript,
              avatar_response: fullResponse.reply,
              session_id: activeSessionId,
            }).select().single().then(({ data: savedTurn, error: insertError }) => {
                if (insertError) {
                    console.error("Failed to save conversation:", insertError);
                    // On failure, remove the optimistic messages to avoid a broken state
                    setMessages(prev => prev.filter(msg => msg.id !== optimisticUserMessage.id && msg.id !== optimisticAIMessage.id));
                    return;
                }
                if (savedTurn) {
                    setMessages(prev => [
                        ...prev.filter(msg => msg.id !== optimisticUserMessage.id && msg.id !== optimisticAIMessage.id),
                        savedTurn
                    ]);
                    setAllMessages(prev => [...prev.filter(m => m.session_id !== savedTurn.session_id || m.id !== savedTurn.id), savedTurn]);
                }
            });
        },
        onError: (errorDetails) => {
            console.error("Streaming failed:", errorDetails.message);
            setIsLoading(false);
            // Remove optimistic messages on error
            setMessages(prev => prev.filter(msg => msg.id !== optimisticUserMessage.id && msg.id !== optimisticAIMessage.id));

            if (errorDetails.isRateLimit) {
                showToast("API rate limit reached. Please wait a minute.");
                setIsRateLimited(true);
                setTimeout(() => setIsRateLimited(false), 60000); // 60-second cooldown
            } else {
                showToast(`An unexpected error occurred: ${errorDetails.message}`);
            }
        }
    });
  };
  
  const handleNewChat = async () => {
    if (!userProfile) return;
    const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: userProfile.id, title: 'New Chat' })
        .select()
        .single();

    if(error || !data) {
        console.error("Could not create new session", error?.message);
        return;
    }
    setSessions(prev => [data, ...prev]);
    setActiveSessionId(data.id);
  }

  const handleDeleteSession = async (id: number) => {
    await supabase.from('chat_sessions').delete().eq('id', id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
        const nextSession = sessions.find(s => s.id !== id);
        setActiveSessionId(nextSession ? nextSession.id : null);
    }
  }

  const handleRenameSession = async (id: number, newTitle: string) => {
    await supabase.from('chat_sessions').update({ title: newTitle }).eq('id', id);
    setSessions(prev => prev.map(s => s.id === id ? {...s, title: newTitle} : s));
  }

  const handleWordDoubleClick = async (word: string) => {
    if (!userProfile) return;
    
    const { data: existingCard, error: checkError } = await supabase
        .from('flashcards')
        .select('id')
        .eq('user_id', userProfile.id)
        .eq('word', word)
        .maybeSingle();

    if (checkError) {
        showToast(`Error: ${checkError.message}`);
        return;
    }

    if (existingCard) {
        showToast(`Flashcard for "${word}" already exists!`);
        return;
    }

    showToast(`Creating flashcard for "${word}"...`);
    
    const contextSentence = messages[messages.length-1]?.avatar_response || messages[messages.length-1]?.transcript || "";
    const flashcardData = await createFlashcardForWord(word, contextSentence, userProfile);

    if (flashcardData) {
        const newFlashcard: Omit<Flashcard, 'id'> = {
            user_id: userProfile.id,
            word: flashcardData.word,
            translation: flashcardData.translation,
            example_sentence: flashcardData.example_sentence,
            part_of_speech: flashcardData.part_of_speech,
            difficulty: flashcardData.difficulty,
            due_date: new Date().toISOString(),
            interval: 1,
            repetition: 0,
            efactor: 2.5,
        };
        const { error } = await supabase.from('flashcards').insert([newFlashcard]);
        if (error) {
            showToast(`Error: ${error.message}`);
        } else {
            showToast(`Flashcard for "${word}" created!`);
        }
    } else {
        showToast(`Could not create flashcard for "${word}".`);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return null;
    }
    const results = allMessages.filter(msg => 
      msg.transcript.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (msg.avatar_response && msg.avatar_response.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const groupedBySession = results.reduce((acc, msg) => {
        const sessionId = msg.session_id || -1;
        if(!acc[sessionId]) {
            acc[sessionId] = [];
        }
        acc[sessionId].push(msg);
        return acc;
    }, {} as Record<number, Conversation[]>);
    
    return groupedBySession;

  }, [allMessages, searchQuery]);

  const getSessionTitle = (sessionId: string) => {
    if(sessionId === '-1') return "Voice Chats";
    return sessions.find(s => s.id === Number(sessionId))?.title || "Unknown Chat";
  }
  
  const StreamingIndicator = () => (
    <div className="flex justify-start my-2">
      <div className="p-3 rounded-lg bg-periwinkle/50 dark:bg-dark-periwinkle/50 text-gray-800 dark:text-gray-200 inline-block">
        <div className="flex items-center justify-center space-x-1">
          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full relative">
       {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green dark:bg-dark-green text-gray-800 dark:text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-out border border-green-300 dark:border-dark-green">
            {toastMessage}
        </div>
      )}
      <ChatSidebar 
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />
      <div className="flex flex-col flex-grow h-full p-4">
        <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
                type="text"
                placeholder="Search in all conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-periwinkle rounded-lg p-2 pl-10 text-gray-800 focus:ring-peach focus:border-peach dark:bg-dark-card dark:border-gray-600 dark:text-gray-200"
            />
        </div>
        <div className="flex-grow bg-white/60 backdrop-blur-sm dark:bg-dark-card/60 rounded-lg p-4 overflow-y-auto space-y-4">
            {searchResults ? (
                <div>
                    {Object.keys(searchResults).length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <p>No results found for "{searchQuery}"</p>
                        </div>
                    ) : (
                                              Object.entries(searchResults).map(([sessionId, foundMessages]) => (
                            <div key={sessionId} className="mb-6">
                                <h3 className="text-peach font-bold mb-2 border-b border-lemon pb-1 font-heading dark:border-dark-peach">{getSessionTitle(sessionId)}</h3>
                                {(foundMessages as Conversation[]).map(msg => (
                                    <div key={msg.id} className="text-sm my-1 p-2 rounded-md hover:bg-lemon/50 dark:hover:bg-dark-lemon/20">
                                        <p className="font-semibold text-gray-800 dark:text-gray-200"><InteractiveText text={msg.transcript} onWordDoubleClick={() => {}} highlight={searchQuery} userProfile={userProfile} /></p>
                                        {msg.avatar_response && <p className="text-gray-600 dark:text-gray-400 pl-4"><InteractiveText text={msg.avatar_response} onWordDoubleClick={() => {}} highlight={searchQuery} userProfile={userProfile} /></p>}
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <>
                    {messages.map((msg) => {
                        // For persisted messages, render both user and AI parts in one go
                        if (msg.user_id !== 'ai' && !msg.isStreaming) {
                             return (
                                <React.Fragment key={msg.id}>
                                <div className="flex justify-end">
                                    <div className="p-3 rounded-lg max-w-lg bg-gradient-to-br from-peach to-blush text-gray-800 dark:from-dark-bubble-peach-start dark:to-dark-bubble-blush-end dark:text-white shadow-sm">
                                        <InteractiveText text={msg.transcript} onWordDoubleClick={handleWordDoubleClick} userProfile={userProfile} />
                                    </div>
                                </div>
                                {msg.avatar_response && (
                                     <div className="flex justify-start">
                                         <div className="p-3 rounded-lg max-w-lg bg-gradient-to-br from-green to-periwinkle text-gray-800 dark:from-dark-bubble-green-start dark:to-dark-bubble-periwinkle-end dark:text-white shadow-sm">
                                             <InteractiveText text={msg.avatar_response} onWordDoubleClick={handleWordDoubleClick} userProfile={userProfile} />
                                         </div>
                                     </div>
                                )}
                                </React.Fragment>
                             )
                        }
                        // For optimistic messages, render them as they are
                        if (msg.user_id !== 'ai' && msg.isStreaming) {
                             return (
                                <div key={msg.id} className="flex justify-end">
                                    <div className="p-3 rounded-lg max-w-lg bg-gradient-to-br from-peach to-blush text-gray-800 dark:from-dark-bubble-peach-start dark:to-dark-bubble-blush-end dark:text-white shadow-sm">
                                        <InteractiveText text={msg.transcript} onWordDoubleClick={handleWordDoubleClick} userProfile={userProfile} />
                                    </div>
                                </div>
                             )
                        }
                        if (msg.user_id === 'ai' && msg.isStreaming) {
                             return (
                                <div key={msg.id} className="flex justify-start">
                                    <div className="p-3 rounded-lg max-w-lg bg-gradient-to-br from-green to-periwinkle text-gray-800 dark:from-dark-bubble-green-start dark:to-dark-bubble-periwinkle-end dark:text-white shadow-sm">
                                        <InteractiveText text={msg.avatar_response} onWordDoubleClick={handleWordDoubleClick} userProfile={userProfile} />
                                        {msg.isStreaming && <span className="inline-block w-2 h-4 bg-white dark:bg-gray-200 ml-1 animate-pulse align-middle" />}
                                    </div>
                                </div>
                             )
                        }
                        return null;
                    })}
                    {isLoading && !messages.some(m => m.isStreaming) && <StreamingIndicator />}
                    {messages.length === 0 && !isLoading && (
                         <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <p>{activeSessionId ? "Send a message to start." : "Create or select a chat."}</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </>
            )}
        </div>
        <form onSubmit={handleSendMessage} className="mt-4 flex items-center space-x-2">
            <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder={isRateLimited ? "API limit reached. Please wait..." : "Type your message..."}
            className="flex-grow bg-white border border-periwinkle rounded-lg p-2 text-gray-800 focus:ring-peach focus:border-peach dark:bg-dark-card dark:border-gray-600 dark:text-gray-200"
            disabled={isLoading || !activeSessionId || isRateLimited}
            />
            <button type="submit" disabled={isLoading || !newMessage.trim() || !activeSessionId || isRateLimited} className="bg-peach text-gray-800 p-2 rounded-lg disabled:opacity-60 hover:bg-blush transition-colors dark:bg-dark-peach dark:text-white dark:hover:bg-dark-blush">
            <Send size={24} />
            </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;
