import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Conversation, Message } from "@/mock-data/chats";

export const MAX_CONVERSATIONS = 50;
export const MAX_MESSAGES = 200;
const TITLE_MAX_CHARS = 40;

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  /** Conversations waiting for an assistant reply (not persisted). */
  pendingIds: string[];
  /** True once saved conversations were read from localStorage (client only, not persisted). */
  hasHydrated: boolean;
  createConversation: (firstMessage: Message) => string;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  deleteConversation: (conversationId: string) => void;
  clearAll: () => void;
  setActive: (conversationId: string | null) => void;
  setPending: (conversationId: string, pending: boolean) => void;
}

export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > TITLE_MAX_CHARS ? `${clean.slice(0, TITLE_MAX_CHARS).trimEnd()}…` : clean;
}

// localStorage can throw (private mode, quota, disabled storage); the app must keep working without it.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Saving is best effort.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore.
    }
  },
};

function newest(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      activeId: null,
      pendingIds: [],
      hasHydrated: false,

      createConversation: (firstMessage) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const conversation: Conversation = {
          id,
          title: titleFrom(firstMessage.content),
          createdAt: now,
          updatedAt: now,
          messages: [firstMessage],
        };
        set((state) => ({ conversations: newest([conversation, ...state.conversations]), activeId: id }));
        return id;
      },

      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, message].slice(-MAX_MESSAGES), updatedAt: Date.now() }
              : c,
          ),
        })),

      updateMessage: (conversationId, messageId, patch) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) }
              : c,
          ),
        })),

      removeMessage: (conversationId, messageId) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) } : c,
          ),
        })),

      renameConversation: (conversationId, title) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, title: titleFrom(title) } : c,
          ),
        })),

      deleteConversation: (conversationId) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== conversationId),
          activeId: state.activeId === conversationId ? null : state.activeId,
        })),

      clearAll: () => set({ conversations: [], activeId: null }),

      setActive: (conversationId) => set({ activeId: conversationId }),

      setPending: (conversationId, pending) =>
        set((state) => ({
          pendingIds: pending
            ? [...new Set([...state.pendingIds, conversationId])]
            : state.pendingIds.filter((id) => id !== conversationId),
        })),
    }),
    {
      name: "ops-assistant-chats",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ conversations: state.conversations }),
      // Saved chats are read after mount (see AppShell), so the server HTML and the first client
      // render both see an empty store and hydration cannot mismatch.
      skipHydration: true,
      onRehydrateStorage: () => () => useChatStore.setState({ hasHydrated: true }),
    },
  ),
);
