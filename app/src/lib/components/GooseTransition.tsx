"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const MESSAGES = [
  'frolicking',
  'grass touching',
  'honking politely',
  'sunning',
  'wiggling',
  'strutting',
  'neck stretching',
  'pecking at clouds',
  'waddling about',
  'merrily honking'
];

const EXIT_MS = 600;
const MAX_VISIBLE_MS = 600;

export default function GooseTransition() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'enter' | 'exit'>('idle');
  const lastMessageRef = useRef<string | null>(null);
  const hideTimeout = useRef<number | null>(null);
  const maxTimeout = useRef<number | null>(null);

  // Ensure we only apply history wrapping once across the app
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.__gooseHistoryPatched) return;
    w.__gooseHistoryPatched = true;

    const wrap = (orig: (...args: any[]) => any) => function (this: any, ...args: any[]) {
      const result = orig.apply(this, args);
      try { setTimeout(() => { window.dispatchEvent(new Event('goose:navigationstart')); }, 0); } catch (e) { }
      return result;
    };

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = wrap(origPush);
    history.replaceState = wrap(origReplace);

    const onPop = () => { try { setTimeout(() => { window.dispatchEvent(new Event('goose:navigationstart')); }, 0); } catch (e) { } };
    window.addEventListener('popstate', onPop);

    return () => {
      // Best-effort restore
      try { history.pushState = origPush; history.replaceState = origReplace; } catch (e) {}
      window.removeEventListener('popstate', onPop);
      w.__gooseHistoryPatched = false;
    };
  }, []);

  // start overlay when a navigation begins (link click / pushState / popstate)
  useEffect(() => {
    const onStart = () => {
      // pick a new message different from last
      let next = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      if (lastMessageRef.current) {
        let attempts = 0;
        while (next === lastMessageRef.current && attempts < 8) {
          next = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
          attempts++;
        }
      }
      lastMessageRef.current = next;

      if (hideTimeout.current) {
        window.clearTimeout(hideTimeout.current);
        hideTimeout.current = null;
      }
      if (maxTimeout.current) {
        window.clearTimeout(maxTimeout.current);
        maxTimeout.current = null;
      }

      setVisible(true);
      setPhase('enter');

      // safety: ensure we hide eventually even if navigation stalls
      maxTimeout.current = window.setTimeout(() => {
        setPhase('exit');
        hideTimeout.current = window.setTimeout(() => {
          setVisible(false);
          setPhase('idle');
        }, EXIT_MS);
      }, MAX_VISIBLE_MS);
    };

    window.addEventListener('goose:navigationstart', onStart);
    return () => window.removeEventListener('goose:navigationstart', onStart);
  }, []);

  // when pathname changes, consider navigation finished -> exit animation
  useEffect(() => {
    if (!visible) return;
    // If pathname changed (navigation finished), start exit
    setPhase('exit');
    if (maxTimeout.current) {
      window.clearTimeout(maxTimeout.current);
      maxTimeout.current = null;
    }
    if (hideTimeout.current) window.clearTimeout(hideTimeout.current);
    hideTimeout.current = window.setTimeout(() => {
      setVisible(false);
      setPhase('idle');
      hideTimeout.current = null;
    }, EXIT_MS);

    return () => {
      if (hideTimeout.current) {
        window.clearTimeout(hideTimeout.current);
        hideTimeout.current = null;
      }
      if (maxTimeout.current) {
        window.clearTimeout(maxTimeout.current);
        maxTimeout.current = null;
      }
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className={`goose-overlay ${phase === 'enter' ? 'enter' : phase === 'exit' ? 'exit' : ''}`} role="status" aria-live="polite">
      <img
        src="/goosey.gif"
        alt="Goosey"
        className="goose-gif"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/goosey(no background).gif';
        }}
      />
      <div className="goose-caption">{lastMessageRef.current}</div>
    </div>
  );
}