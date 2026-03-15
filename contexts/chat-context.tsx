"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: {
    title: string;
    excerpt: string;
    documentType: string;
    similarity?: number;
  }[];
  responseTime?: number;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
};

type ChatContextType = {
  currentSession: ChatSession;
  sessions: ChatSession[];
  addMessage: (message: Message) => void;
  createNewSession: () => void;
  switchToSession: (sessionId: string) => void;
  clearCurrentSession: () => void;
  exportSession: (sessionId: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY = "kenac-ai-chat-sessions";
const CURRENT_SESSION_KEY = "kenac-ai-current-session";

const createWelcomeMessage = (): Message => ({
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to the KENAC AI Assistant! I'm here to help you with loan management, client information, analytics, and compliance questions. How can I assist you today?",
  timestamp: new Date(),
});

const createDefaultSession = (): ChatSession => ({
  id: "default",
  title: "New Chat",
  messages: [createWelcomeMessage()],
  createdAt: new Date(),
  updatedAt: new Date(),
});

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<ChatSession>(
    createDefaultSession()
  );
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load sessions from localStorage on mount
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem(STORAGE_KEY);
      const savedCurrentSessionId = localStorage.getItem(CURRENT_SESSION_KEY);

      if (savedSessions) {
        const parsedSessions: ChatSession[] = JSON.parse(savedSessions).map(
          (session: any) => ({
            ...session,
            createdAt: new Date(session.createdAt),
            updatedAt: new Date(session.updatedAt),
            messages: session.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            })),
          })
        );

        setSessions(parsedSessions);

        // Restore current session if it exists
        if (savedCurrentSessionId) {
          const currentSessionData = parsedSessions.find(
            (s) => s.id === savedCurrentSessionId
          );
          if (currentSessionData) {
            setCurrentSession(currentSessionData);
          } else {
            // If saved session doesn't exist, check if there's a current session in localStorage
            const savedCurrentSession = localStorage.getItem(
              `${CURRENT_SESSION_KEY}-data`
            );
            if (savedCurrentSession) {
              const parsedCurrentSession = JSON.parse(savedCurrentSession);
              setCurrentSession({
                ...parsedCurrentSession,
                createdAt: new Date(parsedCurrentSession.createdAt),
                updatedAt: new Date(parsedCurrentSession.updatedAt),
                messages: parsedCurrentSession.messages.map((msg: any) => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp),
                })),
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error("Error saving sessions:", error);
    }
  }, [sessions]);

  // Save current session to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CURRENT_SESSION_KEY, currentSession.id);
      localStorage.setItem(
        `${CURRENT_SESSION_KEY}-data`,
        JSON.stringify(currentSession)
      );
    } catch (error) {
      console.error("Error saving current session:", error);
    }
  }, [currentSession]);

  const addMessage = useCallback((message: Message) => {
    setCurrentSession((prev) => {
      const updatedSession = {
        ...prev,
        messages: [...prev.messages, message],
        updatedAt: new Date(),
        // Update title based on first user message
        title:
          prev.messages.length === 1 && message.role === "user"
            ? message.content.substring(0, 50) +
              (message.content.length > 50 ? "..." : "")
            : prev.title,
      };

      // Update the session in the sessions array if it exists
      setSessions((prevSessions) => {
        const existingIndex = prevSessions.findIndex((s) => s.id === prev.id);
        if (existingIndex >= 0) {
          const newSessions = [...prevSessions];
          newSessions[existingIndex] = updatedSession;
          return newSessions;
        }
        return prevSessions;
      });

      return updatedSession;
    });
  }, []);

  const createNewSession = useCallback(() => {
    // Save current session to sessions array if it has messages beyond welcome
    setCurrentSession((prev) => {
      if (prev.messages.length > 1) {
        setSessions((prevSessions) => {
          const existingIndex = prevSessions.findIndex((s) => s.id === prev.id);
          if (existingIndex >= 0) {
            const newSessions = [...prevSessions];
            newSessions[existingIndex] = prev;
            return newSessions;
          } else {
            return [prev, ...prevSessions];
          }
        });
      }

      // Create new session
      const newSession = createDefaultSession();
      newSession.id = Date.now().toString();
      return newSession;
    });
  }, []);

  const switchToSession = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        setCurrentSession(session);
      }
    },
    [sessions]
  );

  const clearCurrentSession = useCallback(() => {
    const newSession = createDefaultSession();
    newSession.id = Date.now().toString();
    setCurrentSession(newSession);
  }, []);

  const exportSession = useCallback(
    (sessionId: string) => {
      const session =
        sessionId === currentSession.id
          ? currentSession
          : sessions.find((s) => s.id === sessionId);
      if (!session) return;

      const chatData = {
        session,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(chatData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-session-${session.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [currentSession, sessions]
  );

  const value: ChatContextType = {
    currentSession,
    sessions,
    addMessage,
    createNewSession,
    switchToSession,
    clearCurrentSession,
    exportSession,
    isLoading,
    setIsLoading,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
