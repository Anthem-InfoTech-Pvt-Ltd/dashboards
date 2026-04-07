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
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-slate-700 text-white flex items-center justify-center shadow-xl hover:scale-105 transition z-50"
      >
        {isOpen ? "✕" : "💬"}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[340px] max-h-[520px] flex flex-col bg-white rounded-2xl shadow-2xl border overflow-hidden z-40">
          
          {/* Header */}
          <div className="bg-slate-700 text-white px-4 py-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-400 rounded-full flex items-center justify-center">
              🤖
            </div>
            <span className="font-semibold text-sm">Expense Assistant</span>
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
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 text-sm rounded-2xl ${
                    m.role === "user"
                      ? "bg-slate-700 text-white rounded-br-sm"
                      : "bg-white border text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing */}
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

          {/* Quick Prompts (HubSpot Style) */}
          {showQuickPrompts && (
            <div className="px-4 pb-2 pt-2 bg-gray-50 border-t space-y-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="w-full text-left border rounded-full px-4 py-2 text-sm hover:bg-gray-100 transition"
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