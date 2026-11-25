import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { askAgentChat } from '../api/client';

const STARTER_PROMPTS = [
  'Is there any event clash tomorrow at 10 AM in Seminar Hall A?',
  'Which clubs are quiet or losing members?',
  'Who is the best volunteer for Event Photographer?',
  'What events are scheduled on 27 Nov?',
  'Is Seminar Hall B free tomorrow at 2 PM?',
];

export default function ChatView() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask me about event clashes on a specific date/time/venue, club health, volunteer availability, or scheduled events.',
      facts: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendQuestion = async (textOverride) => {
    const q = (textOverride ?? input).trim();
    if (!q || sending) return;

    const userMsg = { id: `u_${Date.now()}`, role: 'user', text: q, facts: [] };
    setMessages((prev) => [...prev, userMsg]);
    if (!textOverride) setInput('');
    setSending(true);

    try {
      const res = await askAgentChat(q);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          facts: res.facts || [],
          intent: res.intent,
          confidence: res.confidence,
          aiModel: res.aiModel,
        },
      ]);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Assistant failed to respond');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuestion();
  };

  return (
    <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl flex flex-col h-[calc(100vh-7.5rem)] min-h-[500px] animate-fadeIn">
      {/* Chat Header */}
      <div className="px-5 py-3.5 border-b border-gray-200 dark:border-[#1c1c1c] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] flex items-center justify-center">
            <Bot className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Coordinator Assistant</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Live database Q&A for clashes, club health, schedules & volunteers
            </p>
          </div>
        </div>
      </div>

      {/* Starter Prompt Chips */}
      <div className="px-5 py-2.5 border-b border-gray-100 dark:border-[#1c1c1c] flex flex-wrap gap-1.5 shrink-0">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => sendQuestion(prompt)}
            disabled={sending}
            className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-[#141414] hover:bg-gray-100 dark:hover:bg-[#1d1d1d] border border-gray-200 dark:border-[#262626] text-[11px] font-medium text-gray-700 dark:text-gray-300 transition disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl px-4 py-3 text-xs sm:text-sm space-y-2.5 ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#222222] text-gray-800 dark:text-gray-200'
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                {Array.isArray(msg.facts) && msg.facts.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {msg.facts.map((fact, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#2a2a2a] text-xs"
                      >
                        <p className="font-bold text-gray-900 dark:text-white truncate">{fact.title}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{fact.subtitle}</p>
                        <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 mt-1">{fact.meta}</p>
                      </div>
                    ))}
                  </div>
                )}

                {!isUser && msg.aiModel && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 pt-0.5">
                    Intent: {msg.intent} ({msg.confidence}%) · {msg.aiModel}
                  </p>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {sending && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div className="rounded-2xl px-4 py-3 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#222222] text-xs text-gray-500">
              Checking live schedule & club telemetry...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-gray-200 dark:border-[#1c1c1c] flex items-center gap-2.5 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask e.g. 'Is there any clash tomorrow at 10 AM in Seminar Hall A?'"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#111111] text-sm text-gray-900 dark:text-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          Ask
        </button>
      </form>
    </div>
  );
}
