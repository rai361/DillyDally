'use client';

import { Quest } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';

type Message = {
  role: 'user' | 'model';
  parts: [{ text: string, quests?: Quest[] }];
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [results, setResults] = useState<Quest[]>([]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');

    const updatedHistory: Message[] = [
      ...history,
      { role: 'user', parts: [{ text: userText }] },
    ];

    setHistory(updatedHistory);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: history,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setHistory([
        ...updatedHistory,
        { role: 'model', parts: [{ text: data.text, quests: data?.quests ?? [] }] },
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onOpenSpot = (questId: string) => {
    // Dispatch a global event that page.tsx listens to and opens the ExpandedWidget
    window.dispatchEvent(new CustomEvent('open-quest', { detail: { questId } }));
    // setOpen(false);
  };

  return (
    <div>
      {/* Floating button */}
      <button
        aria-label="Open chat"
        onClick={() => setOpen((o) => !o)}
        className="fixed right-6 bottom-6 z-700 flex h-14 w-14 items-center justify-center rounded-full bg-[#a1602a] shadow-xl transition hover:scale-105"
        title="Chat with Jeffery"
      >
        <img src="/gooseeee.png" alt="chat" className="h-10 w-10" />
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed right-6 bottom-24 z-700 w-80 max-w-xs rounded-xl bg-[#f5ecd9] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#4a3f2f]/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <img src="/gooseeee.png" alt="jeffery" className="h-8 w-8 rounded-full" />
              <div className="text-sm font-semibold text-[#4a3f2f]">Jeffery</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#6b5d45]">✕</button>
          </div>

          <div className="max-h-64 overflow-y-auto p-3">
            {history.map((m, i) => (
              <div key={i} className={`mb-2 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-md px-3 py-2 text-sm ${m.role === 'user' ? 'bg-[#a1602a] text-black' : 'bg-white text-[#4a3f2f]'}`}>
                  {m.parts[0].text}
                  {m.parts[0]?.quests && (
                    <div className="mt-2 space-y-2">
                      {m.parts[0]?.quests?.map(quest => (
                        <button
                          key={quest.id}
                          onClick={() => onOpenSpot(quest.id)}
                          className="w-full rounded-lg border border-[#4a3f2f]/10 bg-white p-2 text-left shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            {quest.image ? (
                              <img src={quest.image} alt={quest.title} className="h-12 w-16 shrink-0 rounded-md object-cover" />
                            ) : (
                              <div className="h-12 w-16 shrink-0 rounded-md bg-[#f0e6d2]" />
                            )}

                            <div className="flex-1">
                              <div className="text-sm font-semibold text-[#4a3f2f]">{quest.title}</div>
                              {quest.description && <div className="mt-1 text-xs text-[#6b5d45] line-clamp-2">{quest.description}</div>}
                              <div className="mt-1 flex flex-wrap gap-1">
                                {quest.tags && Array.isArray(quest.tags) && quest.tags.slice(0,3).map((t) => (
                                  <span key={t} className="text-xs text-[#6b5d45] rounded-full border px-2 py-0.5">#{t}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && <div className="text-sm text-[#6b5d45]">Searching...</div>}

            {/* {results.length > 0 && (
              <div className="mt-2 space-y-2">
                {results.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onOpenSpot(s.id)}
                    className="w-full rounded-lg border border-[#4a3f2f]/10 bg-white p-2 text-left shadow-sm"
                  >
                        <div className="flex items-center gap-3">
                          {s.image ? (
                            <img src={s.image} alt={s.title} className="h-12 w-16 flex-shrink-0 rounded-md object-cover" />
                          ) : (
                            <div className="h-12 w-16 flex-shrink-0 rounded-md bg-[#f0e6d2]" />
                          )}

                          <div className="flex-1">
                            <div className="text-sm font-semibold text-[#4a3f2f]">{s.title}</div>
                            {s.description && <div className="mt-1 text-xs text-[#6b5d45] line-clamp-2">{s.description}</div>}
                            <div className="mt-1 flex flex-wrap gap-1">
                              {s.tags && Array.isArray(s.tags) && s.tags.slice(0,3).map((t) => (
                                <span key={t} className="text-xs text-[#6b5d45] rounded-full border px-2 py-0.5">#{t}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
              </div>
            )} */}

            {results.length === 0 && !loading && history.length === 0 && (
              <div className="text-sm text-[#6b5d45]">Ask for a type of location, e.g. "quiet parks near me"</div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[#4a3f2f]/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search (natural language)..."
                className="w-full rounded-full border border-[#4a3f2f]/10 px-3 py-2 text-[#4a3f2f]  text-sm focus:outline-none"
              />
              <button type="submit" className="rounded-full bg-[#a1602a] px-3 py-2 text-white text-sm">Go</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}