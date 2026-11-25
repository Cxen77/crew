import React, { useEffect, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { askAgentChat } from '../api/client';

const STARTER_PROMPTS = [
  'Is there any event clash tomorrow at 10 AM in Seminar Hall A?',
  'Which clubs are quiet or losing members?',
  'Who is the best volunteer for Event Photographer?',
  'What events are scheduled on 27 Nov?',
  'Is Seminar Hall B free tomorrow at 2 PM?',
  'How many pending proposals need approval?',
];

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: 'Ask me about event clashes on a specific date, time, or venue, club health metrics, volunteer availability, or pending proposals.',
  facts: [],
};

export default function ChatView() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
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

  const handleClear = () => {
    setMessages([INITIAL_MESSAGE]);
  };

  return (
    <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl flex flex-col h-[calc(100vh-6.5rem)] min-h-[520px] overflow-hidden animate-fadeIn">
      {/* Clean Chat Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-[#1c1c1c] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-[#161616] border border-gray-200 dark:border-[#262626] flex items-center justify-center">
            <Bot className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Coordinator Assistant</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Grounded in live campus events, clashes, club health & volunteers
            </p>
          </div>
        </div>

        {messages.length > 1 && (
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#242424] bg-gray-50 dark:bg-[#141414] hover:bg-gray-100 dark:hover:bg-[#1e1e1e] text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3 h-3" />
            New Chat
          </button>
        )}
      </div>

      {/* Breathable Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex items-end gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#181818] border border-gray-200 dark:border-[#262626] flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-xl rounded-2xl px-4 py-3 text-xs sm:text-sm space-y-3 ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#222222] text-gray-800 dark:text-gray-200 rounded-bl-sm'
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
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {fact.subtitle}
                          </p>
                          <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 mt-1">
                            {fact.meta}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isUser && msg.aiModel && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-200/70 dark:border-[#222222] pt-1.5">
                      {msg.intent} ({msg.confidence}%) · {msg.aiModel}
                    </p>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {sending && (
            <div className="flex items-end gap-3">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#181818] border border-gray-200 dark:border-[#262626] flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#222222] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom Dock: Scrolling Suggestions Strip + Input Box */}
      <div className="border-t border-gray-200 dark:border-[#1c1c1c] bg-gray-50/60 dark:bg-[#0d0d0d] shrink-0">
        {/* Continuous Scrolling Suggestions Above Input (pauses on hover) */}
        <div className="marquee-wrapper overflow-hidden border-b border-gray-200/70 dark:border-[#1c1c1c] py-2.5">
          <div className="animate-marquee gap-2 px-3">
            {[...STARTER_PROMPTS, ...STARTER_PROMPTS].map((prompt, idx) => (
              <button
                key={`${prompt}_${idx}`}
                type="button"
                onClick={() => sendQuestion(prompt)}
                disabled={sending}
                className="px-3 py-1.5 rounded-full bg-white dark:bg-[#161616] hover:bg-gray-100 dark:hover:bg-[#222222] border border-gray-200 dark:border-[#282828] text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap transition disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:px-6 max-w-4xl mx-auto flex items-center gap-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask e.g. 'Is there any clash tomorrow at 10 AM in Seminar Hall A?'"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#141414] text-sm text-gray-900 dark:text-white focus:outline-none"
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
    </div>
  );
}
