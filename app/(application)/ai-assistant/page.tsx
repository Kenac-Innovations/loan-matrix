"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  FileText,
  Send,
  MessageSquare,
  Sparkles,
  BarChart3,
  CreditCard,
  Shield,
  Settings,
  Users,
  Download,
  Copy,
  RefreshCw,
  Trash2,
  Plus,
  History,
  BookOpen,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import {
  useChatContext,
  type Message,
  type ChatSession,
} from "@/contexts/chat-context";

const SAMPLE_SUGGESTIONS = [
  {
    category: "Loan Management",
    icon: <CreditCard className="h-4 w-4" />,
    suggestions: [
      "Show me all overdue loans",
      "What are the current interest rates?",
      "List loan products available",
      "Generate loan portfolio summary",
    ],
  },
  {
    category: "Client Management",
    icon: <Users className="h-4 w-4" />,
    suggestions: [
      "Find clients with outstanding balances",
      "Show active clients this month",
      "List clients requiring KYC updates",
      "Generate client risk assessment",
    ],
  },
  {
    category: "Analytics & Reports",
    icon: <BarChart3 className="h-4 w-4" />,
    suggestions: [
      "Portfolio at risk analysis",
      "Monthly disbursement report",
      "Collection efficiency metrics",
      "Risk assessment dashboard",
    ],
  },
  {
    category: "Compliance & Policies",
    icon: <Shield className="h-4 w-4" />,
    suggestions: [
      "KYC requirements checklist",
      "Loan approval procedures",
      "Risk management policies",
      "Regulatory compliance guide",
    ],
  },
];

export default function AIAssistantPage() {
  const {
    currentSession,
    sessions,
    addMessage,
    createNewSession,
    switchToSession,
    clearCurrentSession,
    exportSession,
    isLoading,
    setIsLoading,
  } = useChatContext();

  const [query, setQuery] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentSession.messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userQuery = query.trim();
    const messageId = Date.now().toString();
    const userMessage: Message = {
      id: messageId,
      role: "user",
      content: userQuery,
      timestamp: new Date(),
    };

    // Add user message using context
    addMessage(userMessage);

    // Clear input and set loading
    setQuery("");
    setIsLoading(true);

    try {
      const startTime = Date.now();

      // Call the RAG API
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: userQuery }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from RAG system");
      }

      const ragResponse = await response.json();
      const responseTime = Date.now() - startTime;

      // Format sources for display
      const formattedSources =
        ragResponse.sources?.map((source: any) => ({
          title: source.document.title,
          excerpt: source.document.content.substring(0, 200) + "...",
          documentType: source.document.documentType,
          similarity: source.similarity,
        })) || [];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: ragResponse.answer,
        timestamp: new Date(),
        sources: formattedSources,
        responseTime,
      };

      // Add assistant message using context
      addMessage(assistantMessage);

      toast({
        title: "Response generated",
        description: `Response time: ${responseTime}ms`,
      });
    } catch (error) {
      console.error("Error querying RAG system:", error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I'm sorry, I'm having trouble accessing the knowledge base right now. Please try again later or contact support if the issue persists.",
        timestamp: new Date(),
      };

      // Add error message using context
      addMessage(errorMessage);

      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setSelectedSuggestion(suggestion);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    });
  };

  const exportChat = () => {
    exportSession(currentSession.id);
    toast({
      title: "Chat exported",
      description: "Chat session has been downloaded",
    });
  };

  const clearChat = () => {
    clearCurrentSession();
    toast({
      title: "Chat cleared",
      description: "Started a new chat session",
    });
  };

  const newChat = () => {
    createNewSession();
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10 bg-blue-500">
              <AvatarFallback className="bg-blue-500 text-white">
                <Bot className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Assistant
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Powered by RAG
              </p>
            </div>
          </div>

          <Button onClick={newChat} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Suggestions */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Sparkles className="h-4 w-4" />
                Quick Suggestions
              </div>

              {SAMPLE_SUGGESTIONS.map((category, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                    {category.icon}
                    {category.category}
                  </div>
                  <div className="space-y-1">
                    {category.suggestions.map((suggestion, idx) => (
                      <Button
                        key={idx}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`w-full justify-start text-left h-auto p-2 text-xs ${
                          selectedSuggestion === suggestion
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        }`}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Session History */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <History className="h-4 w-4" />
            Recent Sessions
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No previous sessions
            </p>
          ) : (
            <div className="space-y-1">
              {sessions.slice(0, 3).map((session) => (
                <Button
                  key={session.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => switchToSession(session.id)}
                  className="w-full justify-start text-left h-auto p-2"
                >
                  <div>
                    <p className="text-xs font-medium truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {session.messages.length} messages
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentSession.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentSession.messages.length} messages
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportChat}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={clearChat}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {currentSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] ${
                      message.role === "user"
                        ? "bg-blue-500 text-white rounded-lg p-4"
                        : "space-y-3"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 bg-blue-500 mt-1">
                          <AvatarFallback className="bg-blue-500 text-white">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    AI Assistant
                                  </span>
                                  {message.responseTime && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {message.responseTime}ms
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyMessage(message.content)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-white">
                                {message.content}
                              </p>

                              {/* Sources */}
                              {message.sources &&
                                message.sources.length > 0 && (
                                  <div className="mt-4 border-t pt-4">
                                    <div className="flex items-center gap-2 mb-3">
                                      <BookOpen className="h-4 w-4 text-blue-500" />
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Sources ({message.sources.length})
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {message.sources.map((source, idx) => (
                                        <div
                                          key={idx}
                                          className="rounded-md bg-gray-50 dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700"
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <FileText className="h-3 w-3 text-blue-500" />
                                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {source.title}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                {source.documentType}
                                              </Badge>
                                              {source.similarity && (
                                                <Badge
                                                  variant="outline"
                                                  className="text-xs"
                                                >
                                                  {Math.round(
                                                    source.similarity * 100
                                                  )}
                                                  %
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                          <p className="text-xs text-gray-600 dark:text-gray-400">
                                            {source.excerpt}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )}

                    {message.role === "user" && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm opacity-90">You</span>
                        <span className="text-xs opacity-75">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    )}

                    {message.role === "user" && (
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 bg-blue-500 mt-1">
                      <AvatarFallback className="bg-blue-500 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Thinking...
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <div className="flex-1">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about loans, clients, policies, or anything else..."
                className="min-h-[60px] max-h-[120px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="h-[60px] px-6"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3" />
              <span>Powered by RAG + GPT-4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
