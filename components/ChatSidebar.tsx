
import React, { useState } from 'react';
import type { ChatSession } from '../types';
import { PlusCircle, Edit2, Trash2, Check, X } from 'lucide-react';

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: number | null;
  onSelectSession: (id: number) => void;
  onNewChat: () => void;
  onRenameSession: (id: number, newTitle: string) => Promise<void>;
  onDeleteSession: (id: number) => Promise<void>;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
}) => {
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [newTitle, setNewTitle] = useState('');

    const handleRenameClick = (e: React.MouseEvent, session: ChatSession) => {
        e.stopPropagation();
        setRenamingId(session.id);
        setNewTitle(session.title);
    };

    const handleRenameSubmit = async (e: React.MouseEvent | React.FormEvent, sessionId: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (newTitle.trim()) {
            await onRenameSession(sessionId, newTitle.trim());
        }
        setRenamingId(null);
    }

    const handleDeleteClick = (e: React.MouseEvent, sessionId: number) => {
        e.stopPropagation();
        if(window.confirm('Are you sure you want to delete this chat history? This action cannot be undone.')) {
            onDeleteSession(sessionId);
        }
    }

  return (
    <div className="w-64 bg-soft-white dark:bg-dark-card p-2 flex flex-col h-full border-r border-lemon dark:border-dark-bg flex-shrink-0">
      <button
        onClick={onNewChat}
        className="flex items-center justify-center w-full p-2 mb-4 rounded-lg bg-peach hover:bg-blush text-white font-semibold transition-colors font-accent dark:bg-dark-peach dark:hover:bg-dark-blush dark:text-white"
      >
        <PlusCircle size={20} className="mr-2" /> New Chat
      </button>
      <div className="flex-grow overflow-y-auto pr-1">
        {[...sessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((session) => (
          <div
            key={session.id}
            onClick={() => renamingId !== session.id && onSelectSession(session.id)}
            className={`group flex items-center justify-between p-2 my-1 rounded-lg cursor-pointer text-sm transition-colors ${
              activeSessionId === session.id
                ? 'bg-periwinkle text-gray-800 dark:bg-dark-periwinkle dark:text-white'
                : 'hover:bg-lemon/60 dark:hover:bg-dark-lemon/20'
            }`}
          >
            {renamingId === session.id ? (
                <form onSubmit={(e) => handleRenameSubmit(e, session.id)} className="w-full flex items-center">
                    <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                        className="bg-white text-gray-800 w-full text-sm p-1 rounded mr-1 border border-periwinkle dark:bg-dark-bg dark:text-gray-200 dark:border-gray-600" autoFocus
                    />
                    <button type="submit" className="p-1 hover:text-green-600 dark:hover:text-green-400"><Check size={16}/></button>
                    <button type="button" onClick={() => setRenamingId(null)} className="p-1 hover:text-red-500 dark:hover:text-red-400"><X size={16}/></button>
                </form>
            ) : (
                <>
                    <span className="truncate flex-grow pr-2">{session.title}</span>
                    <div className="flex items-center flex-shrink-0 space-x-1 ml-2 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleRenameClick(e, session)} className="p-1 hover:text-gray-800 dark:hover:text-white"><Edit2 size={14}/></button>
                        <button onClick={(e) => handleDeleteClick(e, session.id)} className="p-1 hover:text-gray-800 dark:hover:text-white"><Trash2 size={14}/></button>
                    </div>
                </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatSidebar;