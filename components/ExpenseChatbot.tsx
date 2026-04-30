"use client";

import { useState, useRef, useEffect } from "react";
import ChatChart, { type ChatChartData } from "./ChatChart";
import { useAuth } from "@/context/auth-context";

const CHATBOT_API_URL = "/api/chatbot";

const QUICK_PROMPTS = [
  "What is my current balance?",
  "Top spending categories?",
  "How much did I spend this month?",
  "Show recent transactions",
];

const CHART_PROMPTS = [
  "Show pie chart this month",
  "Monthly bar chart",
  "Expense trend line chart",
  "Top categories horizontal bar",
];

type Message = {
  role: "user" | "assistant";
  content: string;
  chartData?: ChatChartData;
};

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700">$1</strong>')
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>")
    .replace(
      /^(\d+)\.\s(.+)$/gm,
      '<div style="display:flex;gap:8px;margin:2px 0"><span style="color:#f97316;font-weight:700;min-width:16px">$1.</span><span>$2</span></div>'
    )
    .replace(
      /^[-•]\s(.+)$/gm,
      '<div style="display:flex;gap:8px;margin:2px 0"><span style="color:#64748b">•</span><span>$1</span></div>'
    )
    .replace(/\n/g, "<br/>");
}

export default function ExpenseChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your expense assistant 💰 Ask me anything about your spending, balance, or trends.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBar, setErrorBar] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  // Lock body scroll when fullscreen chat is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setErrorBar(null);
    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const history = newMessages.slice(1, -1).slice(-12);

    try {
      const res = await fetch(CHATBOT_API_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          conversationHistory: history,
          userId: user?.userId ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data?.error || `Error (${res.status})`;
        setErrorBar(errMsg);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry, something went wrong: ${errMsg}` },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "No response received.",
          chartData: data.chartData ?? undefined,
        },
      ]);
    } catch (err) {
      console.error("Fetch error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error — please check your connection.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showQuickPrompts = messages.length <= 1;
  const showChartPrompts = messages.length === 3;

  return (
    <>
      {/* ── Floating Trigger Button ── */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Open expense assistant"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl hover:scale-105 transition z-50"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
            <path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" />
          </svg>
        )}
      </button>

      {/* ── Fullscreen Overlay ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col"
          style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)" }}
        >
          {/* Inner panel — full viewport */}
          <div className="flex flex-col w-full h-full bg-white">

            {/* ── Header ── */}
            <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3 shadow-md flex-shrink-0">
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src="/images/chatbot.webp" alt="Assistant" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-semibold text-sm">Expense Assistant</span>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span className="text-white/80">Online</span>
                </div>
              </div>
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                className="ml-auto p-1.5 rounded-full hover:bg-white/20 transition flex-shrink-0"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* ── Error bar ── */}
            {errorBar && (
              <div className="bg-red-50 text-red-600 text-xs px-4 py-2 border-b flex-shrink-0">
                ⚠️ {errorBar}
              </div>
            )}

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" ? (
                    /* Assistant bubble — full width for charts */
                    <div className="w-full max-w-2xl mx-auto">
                      {/* Text bubble */}
                      <div className="bg-white border text-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm">
                        <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                      </div>

                      {/* Chart — full width card below the text bubble */}
                      {m.chartData && (
                        <div className="mt-3 bg-white border rounded-2xl shadow-sm overflow-hidden">
                          <ChatChart chartData={m.chartData} fullscreen />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* User bubble */
                    <div className="max-w-[75%] px-4 py-3 text-sm rounded-2xl rounded-br-sm bg-blue-600 text-white shadow-sm">
                      {m.content}
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border px-4 py-3 rounded-2xl flex gap-1 shadow-sm">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Quick Prompts ── */}
            {showQuickPrompts && (
              <div className="px-4 py-3 bg-white border-t flex flex-wrap gap-2 flex-shrink-0">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-left text-blue-600 border border-blue-400 rounded-full px-3 py-1.5 text-xs hover:bg-blue-50 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* ── Chart Prompts ── */}
            {showChartPrompts && (
              <div className="px-4 py-3 bg-white border-t flex-shrink-0">
                <p className="text-[10px] text-gray-400 mb-2">📊 Try a chart</p>
                <div className="flex flex-wrap gap-2">
                  {CHART_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-left text-purple-600 border border-purple-400 rounded-full px-3 py-1.5 text-xs hover:bg-purple-50 transition"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Input ── */}
            <div className="p-4 border-t bg-white flex-shrink-0">
              <div className="flex items-center border rounded-2xl px-4 py-2.5 bg-gray-50 gap-3 max-w-2xl mx-auto">
                <textarea
                  ref={inputRef}
                  rows={1}
                  placeholder="Write a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="flex-1 bg-transparent outline-none text-sm resize-none"
                  style={{ maxHeight: "96px", overflowY: "auto" }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
                  aria-label="Send"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}