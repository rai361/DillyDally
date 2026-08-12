'use client';

import { useEffect, useRef, useState } from 'react';

interface SpotCard {
  id: string;
  title: string;
  description?: string;
  position?: [number, number];
  image?: string | null;
  tags?: string[] | null;
  category?: string | null;
  time?: string | null;
  price?: number | null;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant' | 'system'; text: string }>>([]);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SpotCard[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendQuery = async (q: string) => {
    if (!q.trim()) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    setResults([]);
    try {
      // Send conversation messages so the server can call Gemini with context and ask follow-ups
      const res = await fetch('/api/gemini-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, messages }),
      });
      if (!res.ok) {
        const t = await res.text();
        setMessages((m) => [...m, { role: 'assistant', text: `Error: ${t}` }]);
        setLoading(false);
        return;
      }
      const payload = await res.json();
      // payload: { messages?: string[], spots?: SpotCard[] }
      if (Array.isArray(payload.messages)) {
        payload.messages.forEach((txt: string) =>
          setMessages((m) => [...m, { role: 'assistant', text: txt }])
        );
      }
      if (Array.isArray(payload.spots)) setResults(payload.spots);
    } catch (err: unknown) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Search failed' }]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    sendQuery(q);
  };

  const onOpenSpot = (spotId: string) => {
    // Dispatch a global event that page.tsx listens to and opens the ExpandedWidget
    window.dispatchEvent(new CustomEvent('open-spot', { detail: { spotId } }));
    setOpen(false);
  };

  return (
    <div>
      {/* Floating button */}
      <button
        aria-label="Open chat"
        onClick={() => setOpen((o) => !o)}
        className="fixed right-6 bottom-6 z-[700] flex h-14 w-14 items-center justify-center rounded-full bg-[#a1602a] shadow-xl transition hover:scale-105"
        title="Chat with Jeffery"
      >
        <img src="/gooseeee.png" alt="chat" className="h-10 w-10" />
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed right-6 bottom-24 z-[700] w-80 max-w-xs rounded-xl bg-[#f5ecd9] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#4a3f2f]/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <img src="/gooseeee.png" alt="jeffery" className="h-8 w-8 rounded-full" />
              <div className="text-sm font-semibold text-[#4a3f2f]">Jeffery</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#6b5d45]">✕</button>
          </div>

          <div className="max-h-64 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={`mb-2 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-md px-3 py-2 text-sm ${m.role === 'user' ? 'bg-[#a1602a] text-black' : 'bg-white text-[#4a3f2f]'}`}>
                  {m.text}
                </div>
              </div>
            ))}

            {loading && <div className="text-sm text-[#6b5d45]">Searching...</div>}

            {results.length > 0 && (
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
            )}

            {results.length === 0 && !loading && messages.length === 0 && (
              <div className="text-sm text-[#6b5d45]">Ask for a type of location, e.g. "quiet parks near me"</div>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-[#4a3f2f]/10 px-3 py-2">
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
