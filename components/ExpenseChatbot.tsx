"use client";

import { useState, useRef, useEffect } from "react";
import ChatChart, { type ChatChartData } from "./ChatChart";
import { useAuth } from "@/context/auth-context";

const CHATBOT_API_URL = "/api/chatbot";

// ─── Markdown Renderer ────────────────────────────────────────────────────────

function parseTable(lines: string[]) {
  const rows = lines.filter((l) => !/^\|[-| :]+\|$/.test(l.trim()));
  if (rows.length < 1) return null;

  const parseRow = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

  const headers = parseRow(rows[0]);
  const body = rows.slice(1);

  return { headers, body: body.map(parseRow) };
}

function applyInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600">$1</strong>')
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>")
    .replace(
      /`([^`]+)`/g,
      '<code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:12px">$1</code>'
    );
}

function renderMarkdown(text: string, isDark = false): string {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let i = 0;

  const labelColor = isDark ? "#d1d5db" : "#374151";
  const borderColor = isDark ? "#374151" : "#e5e7eb";
  const headerBg = isDark ? "#1f2937" : "#f1f5f9";
  const rowEvenBg = isDark ? "#111827" : "#f8fafc";
  const rowOddBg = isDark ? "#1a2535" : "#ffffff";
  const posColor = "#16a34a";
  const negColor = "#dc2626";

  while (i < lines.length) {
    const line = lines[i];

    // ── TABLE DETECTION ──
    if (/^\|.+\|$/.test(line.trim())) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }

      const parsed = parseTable(tableLines);
      if (parsed) {
        const colCount = parsed.headers.length;
        const colWidth = `${(100 / colCount).toFixed(1)}%`;

        const headerCells = parsed.headers
          .map(
            (h) =>
              `<th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:700;color:${labelColor};border-bottom:2px solid ${borderColor};white-space:nowrap;width:${colWidth};">${applyInline(h)}</th>`
          )
          .join("");

        const bodyRows = parsed.body
          .map((row, ri) => {
            const cells = row
              .map((cell) => {
                const cellHtml = applyInline(cell);
                let cellColor = "inherit";
                if (/^\+/.test(cell.trim())) cellColor = posColor;
                else if (/^-₹|^-\$|^-/.test(cell.trim()) && /\d/.test(cell))
                  cellColor = negColor;

                return `<td style="padding:7px 12px;font-size:12.5px;color:${
                  cellColor === "inherit" ? labelColor : cellColor
                };border-bottom:1px solid ${borderColor};white-space:nowrap;">${cellHtml}</td>`;
              })
              .join("");

            const bg = ri % 2 === 0 ? rowEvenBg : rowOddBg;
            return `<tr style="background:${bg}">${cells}</tr>`;
          })
          .join("");

        blocks.push(`
          <div style="overflow-x:auto;margin:8px 0;border-radius:8px;border:1px solid ${borderColor};box-shadow:0 1px 3px rgba(0,0,0,0.06)">
            <table style="width:100%;border-collapse:collapse;font-family:inherit">
              <thead style="background:${headerBg}">
                <tr>${headerCells}</tr>
              </thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
        `);
        continue;
      }
    }

    // ── EMPTY LINE ──
    if (!line.trim()) {
      i++;
      continue;
    }

    // ── HEADING ──
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2) {
      blocks.push(
        `<div style="font-weight:700;font-size:14px;color:${labelColor};margin:6px 0 3px">${applyInline(h2[1])}</div>`
      );
      i++;
      continue;
    }
    if (h3) {
      blocks.push(
        `<div style="font-weight:600;font-size:13px;color:${labelColor};margin:4px 0 2px">${applyInline(h3[1])}</div>`
      );
      i++;
      continue;
    }

    // ── BULLET LIST ──
    if (/^[-•]\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i].trim())) {
        const content = lines[i].trim().replace(/^[-•]\s/, "");
        items.push(
          `<div style="display:flex;gap:8px;align-items:baseline;margin:2px 0"><span style="color:#9ca3af;flex-shrink:0">•</span><span>${applyInline(content)}</span></div>`
        );
        i++;
      }
      blocks.push(`<div style="margin:2px 0">${items.join("")}</div>`);
      continue;
    }

    // ── NUMBERED LIST ──
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const match = lines[i].trim().match(/^(\d+)\.\s(.+)$/);
        if (match) {
          items.push(
            `<div style="display:flex;gap:8px;align-items:baseline;margin:2px 0"><span style="color:#2563eb;font-weight:600;min-width:16px;flex-shrink:0">${match[1]}.</span><span>${applyInline(match[2])}</span></div>`
          );
        }
        i++;
      }
      blocks.push(`<div style="margin:2px 0">${items.join("")}</div>`);
      continue;
    }

    // ── PARAGRAPH ──
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^[-•]\s/.test(lines[i].trim()) &&
      !/^\d+\.\s/.test(lines[i].trim()) &&
      !/^\|.+\|$/.test(lines[i].trim()) &&
      !/^##/.test(lines[i])
    ) {
      paraLines.push(applyInline(lines[i].trim()));
      i++;
    }
    if (paraLines.length) {
      blocks.push(`<p style="margin:0">${paraLines.join("<br/>")}</p>`);
    }
  }

  return blocks
    .filter(Boolean)
    .join('<div style="height:6px"></div>');
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  "Current balance",
  "Top categories",
  "This month's spend",
  "Recent transactions",
];

const CHART_PROMPTS = [
  "Compare credits and debits for last year",
  "Yearly Debit by Category",
  "All-time credit vs debit trend",
];

// ─── Icons ────────────────────────────────────────────────────────────────────

const BotIcon = ({ size = 18, color = "#2563eb" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 2 15 22 11 13 2 9 22 2" fill="#fff" stroke="none" />
    <line x1="22" y1="2" x2="11" y2="13" stroke="#fff" strokeWidth="2.2" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "assistant";
  content: string;
  chartData?: ChatChartData | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isMobile = () =>
  typeof window !== "undefined" && window.innerWidth <= 640;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExpenseChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your expense assistant. Ask me anything about your spending, balance, or trends.",
      chartData: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBar, setErrorBar] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
 const { user } = useAuth();

  // ── Dark mode detection ──
  useEffect(() => {
    const check = () => document.documentElement.classList.contains("dark");
    setIsDark(check());
    const obs = new MutationObserver(() => setIsDark(check()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  // ── getUserData from localStorage ──
  const getUserData = () => {
    try {
      const stored = localStorage.getItem("userData");
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  };

  // ── Auto-resize textarea ──
  const adjustTextareaHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  };

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Focus input when opened ──
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  // ── Lock body scroll (mobile fix: position fixed + full width) ──
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isOpen]);

  // ── External open/close event listeners ──
  useEffect(() => {
    const openHandler = () => setIsOpen(true);
    const closeHandler = () => setIsOpen(false);
    window.addEventListener("openExpenseChatbot", openHandler);
    window.addEventListener("closeExpenseChatbot", closeHandler);
    return () => {
      window.removeEventListener("openExpenseChatbot", openHandler);
      window.removeEventListener("closeExpenseChatbot", closeHandler);
    };
  }, []);

  // ── Send message ──
  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    setErrorBar(null);
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userText, chartData: null },
    ];
    setMessages(newMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);

    const history = newMessages.slice(1, -1).slice(-16);

    try {
      const res = await fetch(CHATBOT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
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
          {
            role: "assistant",
            content: `Something went wrong: ${errMsg}`,
            chartData: null,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "No response received.",
          chartData: data.chartData ?? null,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error. Please check your connection.",
          chartData: null,
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

  const now = new Date();
  const timeLabel = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const mobile = isMobile();

  // ── Theme colors ──
  const panelBg = isDark ? "#111827" : "#ffffff";
  const headerBg = isDark ? "#111827" : "#ffffff";
  const borderColor = isDark ? "#1f2937" : "#f0f0f0";
  const msgsBg = isDark ? "#0f172a" : "#ffffff";
  const inputAreaBg = isDark ? "#111827" : "#ffffff";
  const inputBg = isDark ? "#1f2937" : "#f3f4f6";
  const inputBorder = isDark ? "#374151" : "#e5e7eb";
  const labelColor = isDark ? "#d1d5db" : "#374151";
  const mutedColor = isDark ? "#6b7280" : "#9ca3af";
  const assistBubbleBg = isDark ? "#1e293b" : "#ffffff";
  const assistBubbleBorder = isDark ? "#334155" : "#e9eaec";
  const assistTextColor = isDark ? "#f1f5f9" : "#1f2937";
  const chartCardBg = isDark ? "#1e293b" : "#ffffff";
  const chartCardBorder = isDark ? "#334155" : "#e9eaec";

  return (
    <>
      {/* ── Backdrop ── */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.55)",
            zIndex: 9997,
          }}
        />
      )}

      {/* ── Chat Panel ── */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "all",
              width: mobile ? "100vw" : "min(860px, 96vw)",
              height: mobile ? "100dvh" : "min(88vh, 100dvh)",
              borderRadius: mobile ? 0 : "16px",
              background: panelBg,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: mobile
                ? "none"
                : "0 8px 40px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)",
              border: mobile
                ? "none"
                : `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                background: headerBg,
                padding: "14px 16px 13px",
                display: "flex",
                alignItems: "center",
                gap: "11px",
                flexShrink: 0,
                borderBottom: `1px solid ${borderColor}`,
                boxShadow: isDark
                  ? "0 1px 4px rgba(0,0,0,0.4)"
                  : "0px 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: isDark ? "#1e3a5f" : "#eff6ff",
                  border: `1.5px solid ${isDark ? "#2563eb" : "#dbeafe"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                <img
                  src="https://res.cloudinary.com/dmyq2ymj9/image/upload/v1776247153/chatbot_sxwnvy.png"
                  alt="Assistant"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 600,
                    color: isDark ? "#f3f4f6" : "#111827",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.3,
                  }}
                >
                  Expense Assistant
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    marginTop: "3px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#16a34a",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "11.5px",
                      color: mutedColor,
                      lineHeight: 1,
                    }}
                  >
                    Active now
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: isDark ? "#1f2937" : "#f3f4f6",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = isDark
                    ? "#374151"
                    : "#e5e7eb")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = isDark
                    ? "#1f2937"
                    : "#f3f4f6")
                }
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isDark ? "#9ca3af" : "#6b7280"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* ── Error Bar ── */}
            {errorBar && (
              <div
                style={{
                  background: "#fef2f2",
                  color: "#dc2626",
                  fontSize: "12px",
                  padding: "7px 16px",
                  borderBottom: "1px solid #fecaca",
                  flexShrink: 0,
                }}
              >
                ⚠ {errorBar}
              </div>
            )}

            {/* ── Messages ── */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: msgsBg,
                WebkitOverflowScrolling: "touch",
              } as React.CSSProperties}
            >
              <div
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  color: mutedColor,
                  marginBottom: "6px",
                  letterSpacing: "0.01em",
                }}
              >
                Today · {timeLabel}
              </div>

              {messages.map((msg, i) => (
                <div key={i}>
                  {/* Message bubble */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        msg.role === "user" ? "flex-end" : "flex-start",
                      alignItems: "flex-end",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: msg.chartData ? "100%" : "80%",
                        width: msg.chartData ? "100%" : undefined,
                        padding: "9px 13px",
                        fontSize: "13.5px",
                        lineHeight: 1.55,
                        borderRadius:
                          msg.role === "user"
                            ? "14px 14px 3px 14px"
                            : "14px 14px 14px 3px",
                        background:
                          msg.role === "user" ? "#2563eb" : assistBubbleBg,
                        color:
                          msg.role === "user" ? "#ffffff" : assistTextColor,
                        border:
                          msg.role === "user"
                            ? "none"
                            : `1px solid ${assistBubbleBorder}`,
                        wordBreak: "break-word",
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {msg.role === "assistant" ? (
                        <span
                          dangerouslySetInnerHTML={{
                            __html: renderMarkdown(msg.content, isDark),
                          }}
                        />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>

                  {/* Chart card */}
                  {msg.role === "assistant" && msg.chartData && (
                    <div
                      style={{
                        marginTop: "10px",
                        background: chartCardBg,
                        border: `1px solid ${chartCardBorder}`,
                        borderRadius: "12px",
                        overflow: "hidden",
                        boxShadow: isDark
                          ? "0 2px 8px rgba(0,0,0,0.4)"
                          : "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    >
                      <ChatChart chartData={msg.chartData} fullscreen={true} />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: isDark ? "#1e3a5f" : "#eff6ff",
                      border: `1px solid ${isDark ? "#2563eb" : "#dbeafe"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <BotIcon size={12} />
                  </div>
                  <div
                    style={{
                      background: assistBubbleBg,
                      border: `1px solid ${assistBubbleBorder}`,
                      borderRadius: "14px 14px 14px 3px",
                      padding: "10px 13px",
                      display: "flex",
                      gap: "4px",
                      alignItems: "center",
                    }}
                  >
                    {[0, 1, 2].map((j) => (
                      <span
                        key={j}
                        style={{
                          width: "5px",
                          height: "5px",
                          borderRadius: "50%",
                          background: mutedColor,
                          display: "inline-block",
                          animation: `chatDot 1.2s ${j * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Quick Prompts ── */}
            {showQuickPrompts && (
              <div
                style={{
                  padding: "8px 14px 10px",
                  background: inputAreaBg,
                  borderTop: `1px solid ${borderColor}`,
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  flexShrink: 0,
                }}
              >
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    style={{
                      background: isDark ? "#1f2937" : "#f8fafc",
                      color: labelColor,
                      border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                      borderRadius: "7px",
                      padding: "5px 11px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "background 0.12s, border-color 0.12s",
                      letterSpacing: "-0.005em",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark
                        ? "#1e3a5f"
                        : "#eff6ff";
                      e.currentTarget.style.borderColor = isDark
                        ? "#2563eb"
                        : "#bfdbfe";
                      e.currentTarget.style.color = "#1d4ed8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isDark
                        ? "#1f2937"
                        : "#f8fafc";
                      e.currentTarget.style.borderColor = isDark
                        ? "#374151"
                        : "#e5e7eb";
                      e.currentTarget.style.color = labelColor;
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* ── Chart Prompts ── */}
            {showChartPrompts && (
              <div
                style={{
                  padding: "8px 14px 10px",
                  background: inputAreaBg,
                  borderTop: `1px solid ${borderColor}`,
                  flexShrink: 0,
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: "10px",
                    color: mutedColor,
                  }}
                >
                  📊 Try a chart
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {CHART_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      style={{
                        background: isDark ? "#2e1b4e" : "#faf5ff",
                        color: isDark ? "#c4b5fd" : "#7c3aed",
                        border: `1px solid ${
                          isDark ? "#5b21b6" : "#ddd6fe"
                        }`,
                        borderRadius: "7px",
                        padding: "5px 11px",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "background 0.12s",
                        letterSpacing: "-0.005em",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDark
                          ? "#3b1f6a"
                          : "#ede9fe";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isDark
                          ? "#2e1b4e"
                          : "#faf5ff";
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Input ── */}
            <div
              style={{
                padding: "10px 14px",
                borderTop: `1px solid ${borderColor}`,
                background: inputAreaBg,
                flexShrink: 0,
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
              }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                maxLength={500}
                placeholder="Write a message..."
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
                disabled={loading}
                style={{
                  flex: 1,
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: "10px",
                  outline: "none",
                  fontSize: "13.5px",
                  color: isDark ? "#f3f4f6" : "#1f2937",
                  resize: "none",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                  padding: "9px 12px",
                  overflowY: input.length > 150 ? "auto" : "hidden",
                  maxHeight: "100px",
                  transition: "border-color 0.15s",
                  letterSpacing: "-0.005em",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "#93c5fd")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = inputBorder)
                }
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  border: "none",
                  background:
                    loading || !input.trim()
                      ? isDark
                        ? "#374151"
                        : "#d1d5db"
                      : "#2563eb",
                  color: "#fff",
                  cursor:
                    loading || !input.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.15s",
                  marginBottom: "1px",
                }}
                onMouseEnter={(e) => {
                  if (!loading && input.trim())
                    e.currentTarget.style.background = "#1d4ed8";
                }}
                onMouseLeave={(e) => {
                  if (!loading && input.trim())
                    e.currentTarget.style.background = "#2563eb";
                }}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </>
  );
}