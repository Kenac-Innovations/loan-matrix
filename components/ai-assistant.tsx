"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  FileText,
  Send,
  X,
  MessageSquare,
  Sparkles,
  BarChart3,
  CreditCard,
  Shield,
  Settings,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePathname } from "next/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: {
    title: string;
    excerpt: string;
    documentType: string;
  }[];
};

type Suggestion = {
  text: string;
  icon: React.ReactNode;
  id: string; // Unique identifier for tracking shown suggestions
};

type ContextualSuggestions = {
  [key: string]: {
    suggestions: Suggestion[];
    quickSuggestions: string[];
  };
};

export function AIAssistant() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipIndex, setTooltipIndex] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const [hasNewSuggestion, setHasNewSuggestion] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shownSuggestions, setShownSuggestions] = useState<{
    [key: string]: string[];
  }>({});
  const [lastPathChange, setLastPathChange] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your KENAC Loan Matrix AI assistant. How can I help you with loan information today?",
    },
  ]);

  // Sample documents for demonstration
  const sampleDocuments = [
    {
      title: "Mortgage Loan Policy",
      excerpt:
        "Section 3.2: Approval requirements for mortgage loans above $200,000 require additional verification steps...",
      documentType: "Policy",
    },
    {
      title: "Business Loan Terms",
      excerpt:
        "Interest rates for business loans are calculated based on the prime rate plus a risk-adjusted margin...",
      documentType: "Terms",
    },
    {
      title: "KYC Procedure Manual",
      excerpt:
        "Client verification must include government-issued ID, proof of address, and income verification...",
      documentType: "Procedure",
    },
  ];

  // Context-aware suggestions based on current page
  const contextualSuggestions: ContextualSuggestions = {
    // Dashboard page suggestions
    "/dashboard": {
      suggestions: [
        {
          id: "dashboard-1",
          text: "Explain the risk assessment metrics",
          icon: <BarChart3 className="h-3 w-3 text-blue-400 mr-1" />,
        },
        {
          id: "dashboard-2",
          text: "How do I interpret the loan portfolio chart?",
          icon: <BarChart3 className="h-3 w-3 text-green-400 mr-1" />,
        },
        {
          id: "dashboard-3",
          text: "What's causing the security alerts?",
          icon: <Shield className="h-3 w-3 text-red-400 mr-1" />,
        },
        {
          id: "dashboard-4",
          text: "Summarize today's pending approvals",
          icon: <CreditCard className="h-3 w-3 text-purple-400 mr-1" />,
        },
        {
          id: "dashboard-5",
          text: "How can I improve our security score?",
          icon: <Shield className="h-3 w-3 text-blue-400 mr-1" />,
        },
        {
          id: "dashboard-6",
          text: "What's the trend in client acquisition?",
          icon: <Users className="h-3 w-3 text-green-400 mr-1" />,
        },
      ],
      quickSuggestions: [
        "Explain risk metrics",
        "Analyze portfolio trends",
        "Summarize pending approvals",
      ],
    },

    // RAG dashboard suggestions
    "/dashboard/rag": {
      suggestions: [
        {
          id: "rag-1",
          text: "How do I add new documents to the knowledge base?",
          icon: <FileText className="h-3 w-3 text-blue-400 mr-1" />,
        },
        {
          id: "rag-2",
          text: "What's the optimal similarity threshold?",
          icon: <Settings className="h-3 w-3 text-green-400 mr-1" />,
        },
        {
          id: "rag-3",
          text: "Explain the reindexing process",
          icon: <Sparkles className="h-3 w-3 text-purple-400 mr-1" />,
        },
        {
          id: "rag-4",
          text: "Which AI model should I use for my use case?",
          icon: <Bot className="h-3 w-3 text-yellow-400 mr-1" />,
        },
        {
          id: "rag-5",
          text: "How do citations work in the RAG system?",
          icon: <FileText className="h-3 w-3 text-blue-400 mr-1" />,
        },
        {
          id: "rag-6",
          text: "What file formats are supported for upload?",
          icon: <FileText className="h-3 w-3 text-green-400 mr-1" />,
        },
      ],
      quickSuggestions: [
        "Add new documents",
        "Configure RAG settings",
        "Explain citation feature",
      ],
    },

    // Default suggestions (used when no specific context matches)
    default: {
      suggestions: [
        {
          id: "default-1",
          text: "Need help with loan policies?",
          icon: <FileText className="h-3 w-3 text-blue-400 mr-1" />,
        },
        {
          id: "default-2",
          text: "Ask me about verification procedures",
          icon: <MessageSquare className="h-3 w-3 text-green-400 mr-1" />,
        },
        {
          id: "default-3",
          text: "I can explain compliance requirements",
          icon: <Shield className="h-3 w-3 text-purple-400 mr-1" />,
        },
        {
          id: "default-4",
          text: "Questions about interest rates?",
          icon: <CreditCard className="h-3 w-3 text-yellow-400 mr-1" />,
        },
        {
          id: "default-5",
          text: "How to analyze client risk profiles?",
          icon: <Users className="h-3 w-3 text-blue-400 mr-1" />,
        },
        {
          id: "default-6",
          text: "Need help with the dashboard features?",
          icon: <Settings className="h-3 w-3 text-green-400 mr-1" />,
        },
      ],
      quickSuggestions: [
        "Current rates",
        "KYC requirements",
        "Approval process",
      ],
    },
  };

  // Get current context based on pathname
  const getCurrentContext = () => {
    // Check if we have specific suggestions for this path
    if (contextualSuggestions[pathname]) {
      return contextualSuggestions[pathname];
    }

    // Check for partial matches (for nested routes)
    for (const path in contextualSuggestions) {
      if (path !== "default" && pathname.startsWith(path)) {
        return contextualSuggestions[path];
      }
    }

    // Fall back to default suggestions
    return contextualSuggestions.default;
  };

  const currentContext = getCurrentContext();
  const allSuggestions = currentContext.suggestions;
  const quickSuggestions = currentContext.quickSuggestions;

  // Get suggestions that haven't been shown yet for this path
  const getUnshownSuggestions = () => {
    const shown = shownSuggestions[pathname] || [];
    return allSuggestions.filter(
      (suggestion) => !shown.includes(suggestion.id)
    );
  };

  // Get a random suggestion that hasn't been shown yet
  const getNextSuggestion = () => {
    const unshown = getUnshownSuggestions();

    // If all suggestions have been shown, reset the tracking for this path
    if (unshown.length === 0) {
      const newShownSuggestions = { ...shownSuggestions };
      newShownSuggestions[pathname] = [];
      setShownSuggestions(newShownSuggestions);
      return allSuggestions[Math.floor(Math.random() * allSuggestions.length)];
    }

    // Return a random unshown suggestion
    return unshown[Math.floor(Math.random() * unshown.length)];
  };

  // Track that a suggestion has been shown
  const markSuggestionAsShown = (suggestionId: string) => {
    const newShownSuggestions = { ...shownSuggestions };
    if (!newShownSuggestions[pathname]) {
      newShownSuggestions[pathname] = [];
    }
    if (!newShownSuggestions[pathname].includes(suggestionId)) {
      newShownSuggestions[pathname].push(suggestionId);
    }
    setShownSuggestions(newShownSuggestions);
  };

  // Get the current suggestion to show
  const currentSuggestion = allSuggestions[tooltipIndex];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Track path changes
  useEffect(() => {
    if (lastPathChange !== pathname) {
      setLastPathChange(pathname);

      // Reset tooltip index when path changes
      setTooltipIndex(0);

      // Hide any active tooltip when changing pages
      setShowTooltip(false);

      // Schedule a delayed suggestion after path change (after 10 seconds)
      const pathChangeTimer = setTimeout(() => {
        if (!isOpen) {
          const nextSuggestion = getNextSuggestion();
          const index = allSuggestions.findIndex(
            (s) => s.id === nextSuggestion.id
          );
          if (index !== -1) {
            setTooltipIndex(index);
            setShowTooltip(true);
            setHasNewSuggestion(true);
            setIsPulsing(true);
            setTimeout(() => setIsPulsing(false), 1500);
            markSuggestionAsShown(nextSuggestion.id);

            // Hide tooltip after 5 seconds if not interacted with
            setTimeout(() => {
              setShowTooltip(false);
            }, 5000);
          }
        }
      }, 10000); // Delay showing suggestion after page change

      return () => clearTimeout(pathChangeTimer);
    }
  }, [pathname, isOpen]);

  // Effect for showing tooltip periodically (but not too frequently)
  useEffect(() => {
    const tooltipTimer = setTimeout(() => {
      if (!isOpen && !showTooltip) {
        const nextSuggestion = getNextSuggestion();
        const index = allSuggestions.findIndex(
          (s) => s.id === nextSuggestion.id
        );
        if (index !== -1) {
          setTooltipIndex(index);
          setShowTooltip(true);
          setHasNewSuggestion(true);
          setIsPulsing(true);
          setTimeout(() => setIsPulsing(false), 1500);
          markSuggestionAsShown(nextSuggestion.id);

          // Hide tooltip after 5 seconds if not interacted with
          setTimeout(() => {
            setShowTooltip(false);
          }, 5000);
        }
      }
    }, 45000); // Show tooltip after 45 seconds of inactivity (much longer delay)

    return () => clearTimeout(tooltipTimer);
  }, [isOpen, showTooltip, pathname]);

  // Periodic pulse animation to draw attention (but less frequently)
  useEffect(() => {
    const pulseTimer = setInterval(() => {
      if (!isOpen && !showTooltip) {
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 1500);
      }
    }, 60000); // Pulse every 60 seconds if not open or showing tooltip (reduced frequency)

    return () => clearInterval(pulseTimer);
  }, [isOpen, showTooltip]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: query }]);

    // Clear input and set loading
    setQuery("");
    setIsLoading(true);

    // Simulate AI response with retrieved documents
    setTimeout(() => {
      let response: Message;

      if (
        query.toLowerCase().includes("mortgage") ||
        query.toLowerCase().includes("loan")
      ) {
        response = {
          role: "assistant",
          content:
            "Based on our loan policies, mortgage loans above $200,000 require additional verification steps including income verification, credit history review, and property appraisal. The current interest rates for mortgage loans range from 3.5% to 5.2% depending on the loan term and applicant's credit score.",
          sources: [sampleDocuments[0], sampleDocuments[1]],
        };
      } else if (
        query.toLowerCase().includes("kyc") ||
        query.toLowerCase().includes("verification")
      ) {
        response = {
          role: "assistant",
          content:
            "According to our KYC Procedure Manual, client verification must include government-issued ID, proof of address, and income verification. All documents must be current within the last 3 months. For high-value loans, additional verification steps may be required.",
          sources: [sampleDocuments[2]],
        };
      } else if (
        query.toLowerCase().includes("risk") ||
        query.toLowerCase().includes("assessment")
      ) {
        response = {
          role: "assistant",
          content:
            "The risk assessment metrics on your dashboard show the distribution of loans by risk category. Currently, 68% of loans are classified as low risk (green), 24% as medium risk (yellow), and 8% as high risk (red). This is within our target risk profile of maintaining at least 65% low-risk loans.",
        };
      } else if (
        query.toLowerCase().includes("document") ||
        query.toLowerCase().includes("knowledge base")
      ) {
        response = {
          role: "assistant",
          content:
            "To add new documents to the knowledge base, use the 'Upload Document' button in the Documents tab. The system supports PDF, DOCX, and XLSX formats. Once uploaded, documents will be processed and indexed automatically, making their content available for AI-powered searches and responses.",
        };
      } else {
        response = {
          role: "assistant",
          content:
            "I don't have specific information about that in my knowledge base. Would you like me to help you with information about our loan policies, interest rates, or verification procedures?",
        };
      }

      setMessages((prev) => [...prev, response]);
      setIsLoading(false);
    }, 1500);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setIsOpen(true);
    setShowTooltip(false);
    setHasNewSuggestion(false);
  };

  return (
    <>
      {/* Floating button with tooltip */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* Tooltip/suggestion bubble */}
        {showTooltip && (
          <div
            className="mb-3 max-w-xs animate-fade-in rounded-lg bg-[#1a2035] p-3 text-white shadow-lg border border-[#2a3045] transform transition-all duration-300 ease-in-out"
            style={{
              animation: "fadeIn 0.3s ease-in-out",
              transform: "scale(1)",
              opacity: 1,
            }}
          >
            <div className="flex items-center">
              {currentSuggestion.icon}
              <p className="text-sm">{currentSuggestion.text}</p>
            </div>
            <div className="mt-2 flex justify-between">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 py-1 text-xs text-gray-400 hover:text-white"
                onClick={() => setShowTooltip(false)}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                className="h-7 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600"
                onClick={() => handleSuggestionClick(currentSuggestion.text)}
              >
                Ask
              </Button>
            </div>
            <div className="absolute -bottom-2 right-4 h-3 w-3 rotate-45 bg-[#1a2035] border-r border-b border-[#2a3045]"></div>
          </div>
        )}

        <Button
          onClick={() => {
            setIsOpen(true);
            setShowTooltip(false);
            setHasNewSuggestion(false);
          }}
          className={`h-14 w-14 rounded-full bg-blue-500 p-0 shadow-lg hover:bg-blue-600 transition-all duration-300 ${
            isPulsing ? "animate-pulse-ring" : ""
          }`}
          aria-label="Open AI Assistant"
        >
          <Bot className="h-6 w-6" />
          {hasNewSuggestion && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold animate-bounce">
              !
            </span>
          )}
        </Button>
      </div>

      {/* AI Assistant Dialog */}
      {isOpen && (
        <div
          className="fixed bottom-0 right-0 z-50 w-full sm:bottom-6 sm:right-6 sm:w-full sm:max-w-md"
          style={{
            animation: "slideUp 0.3s ease-out",
          }}
        >
          <Card className="border-[#1a2035] bg-[#0d121f] text-white shadow-xl sm:rounded-lg rounded-b-none rounded-t-lg h-[80vh] sm:h-auto flex flex-col">
            <CardHeader className="border-b border-[#1a2035] pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 bg-blue-500">
                    <AvatarImage
                      src="/placeholder.svg?key=ai-assistant"
                      alt="AI"
                    />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-sm">
                      KENAC AI Assistant
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-400">
                      Powered by RAG technology
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 rounded-full text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === "user"
                            ? "bg-blue-500 text-white"
                            : "bg-[#1a2035] text-white"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>

                        {/* Sources section */}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2 border-t border-[#2a3045] pt-2">
                            <p className="text-xs font-semibold text-gray-300">
                              Sources:
                            </p>
                            <div className="mt-1 space-y-2">
                              {message.sources.map((source, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-md bg-[#0a0e17] p-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <FileText className="h-3 w-3 text-blue-400" />
                                      <p className="text-xs font-medium">
                                        {source.title}
                                      </p>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className="border-blue-500 bg-blue-500/10 px-1.5 py-0 text-[10px] text-blue-400"
                                    >
                                      {source.documentType}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-[11px] text-gray-400">
                                    {source.excerpt}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg bg-[#1a2035] p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
                          <div
                            className="h-2 w-2 animate-pulse rounded-full bg-blue-400"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                          <div
                            className="h-2 w-2 animate-pulse rounded-full bg-blue-400"
                            style={{ animationDelay: "0.4s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>
            </ScrollArea>
            <CardFooter className="border-t border-[#1a2035] p-3 mt-auto">
              <form
                onSubmit={handleSubmit}
                className="flex w-full items-center gap-2"
              >
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about loan policies, procedures, or requirements..."
                  className="min-h-10 border-[#1a2035] bg-[#0a0e17] text-sm text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || !query.trim()}
                  className="h-10 w-10 rounded-full bg-blue-500 p-0 hover:bg-blue-600 flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </CardFooter>

            {/* Quick suggestion chips - now context-aware */}
            <div className="px-3 pb-3 overflow-x-auto">
              <div className="flex flex-nowrap gap-2 pb-1">
                {quickSuggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="rounded-full border-[#1a2035] bg-[#0a0e17] text-xs text-white hover:bg-[#1a2035] whitespace-nowrap flex-shrink-0"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add CSS animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          70% {
            box-shadow: 0 0 0 15px rgba(59, 130, 246, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }

        .animate-pulse-ring {
          animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1)
            infinite;
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
      `}</style>
    </>
  );
}

export default AIAssistant;
