"use client";

import { useState, useRef, useEffect } from "react";

const CHATBOT_API_URL = "/api/chatbot";

const QUICK_PROMPTS = [
  "What is my current balance?",
  "Top spending categories?",
  "How much did I spend this month?",
  "Show recent transactions",
];

type Message = { role: "user" | "assistant"; content: string };

// ✅ Markdown → HTML converter (only for assistant messages)
function renderMarkdown(text: string): string {
  return text
    // Bold: **text** → <strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700">$1</strong>')
    // Italic: *text* → <em>
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    // Numbered list: "1. text" → styled list item
    .replace(/^(\d+)\.\s(.+)$/gm, '<div style="display:flex;gap:8px;margin:2px 0"><span style="color:#f97316;font-weight:700;min-width:16px">$1.</span><span>$2</span></div>')
    // Bullet list: "- text" → styled bullet
    .replace(/^[-•]\s(.+)$/gm, '<div style="display:flex;gap:8px;margin:2px 0"><span style="color:#64748b">•</span><span>$1</span></div>')
    // Newlines → <br>
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          conversationHistory: history,
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
        { role: "assistant", content: data.reply || "No response received." },
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

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl hover:scale-105 transition z-50"
      >
        {isOpen ? (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-more-icon lucide-message-circle-more"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /><path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" /></svg>)}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[340px] max-h-[520px] flex flex-col bg-white rounded-2xl shadow-2xl border overflow-hidden z-40">

          {/* Header */}
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <img src="/images/chatbot.webp" alt="Assistant" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Expense Assistant</span>

              <div className="flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-white/80">Online</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {errorBar && (
            <div className="bg-red-50 text-red-600 text-xs px-4 py-2 border-b">
              ⚠️ {errorBar}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 text-sm rounded-2xl ${m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white border text-gray-800 rounded-bl-sm"
                    }`}
                >
                  {m.role === "assistant" ? (
                    // ✅ Assistant: render formatted HTML
                    <span
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                    />
                  ) : (
                    // ✅ User: plain text (safe, no XSS risk)
                    m.content
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border px-4 py-2 rounded-2xl flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {showQuickPrompts && (
            <div className="px-4 pb-2 pt-2 bg-gray-50 border-t space-y-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="w-fit text-left text-blue-500 border border-blue-500 rounded-full px-4 py-2 text-sm hover:bg-gray-100 transition"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t bg-white">
            <div className="flex items-center border rounded-full px-3 py-2 bg-gray-50">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Write a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="flex-1 bg-transparent outline-none text-sm resize-none"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="text-gray-500 hover:text-black disabled:opacity-40"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}