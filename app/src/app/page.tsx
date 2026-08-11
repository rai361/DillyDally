'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const ZoomControl = dynamic(
  () => import('react-leaflet').then((mod) => mod.ZoomControl),
  { ssr: false }
);

const UTSG_COORDS: [number, number] = [43.6629, -79.3957];

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
// The site-wide default (set in globals.css / layout.tsx) is a hand-drawn
// "crayon" display font. That's the right voice for the wordmark, tagline,
// and spot titles — but it hurts legibility for anything functional: body
// copy, form controls, filter chips, stats. `READABLE_FONT` explicitly opts
// those elements back into a plain system sans stack via Tailwind's
// `font-sans` utility, which — because it's a class, not an inherited
// element selector — wins over the crayon font cascading down from <body>.
const READABLE_FONT = 'font-sans';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = 'User Submitted' | 'Promoted' | 'Food!' | 'Parks';

interface Spot {
  id: string;
  position: [number, number];
  title: string;
  description: string;
  image: string;
  price: 1 | 2 | 3 | 4; // out of 4
  hype: 1 | 2 | 3 | 4 | 5; // out of 5
  time: string;
  category: Category;
  tags: string[];
}

// Shape of the filter state. This is intentionally the same shape a future
// `GET /api/spots` endpoint would accept as query params, e.g.
//   /api/spots?query=kimchi&categories=Food!,Parks&tags=quiet,free
interface SpotFilters {
  query: string;
  categories: Set<Category>;
  tags: Set<string>;
}

// ---------------------------------------------------------------------------
// Quest completions, points, favorites, bookmarks
// ---------------------------------------------------------------------------
// Quests can be logged as "completed" any number of times — a repeat trip
// still counts, as long as a fresh photo comes with it. Each log entry is
// immutable once saved and carries the points it earned at that moment, so
// changing the points formula later never rewrites anyone's history.
//
// "Featuring" a spot on your profile is a property of the *spot*, not of
// any one completion — you don't re-feature it every time you go back — so
// it lives in its own set, separate from the completion log. Bookmarks work
// the same way and stay private (never surfaced on the profile).
//
// All four are local-only for now via localStorage, shaped so they can
// become real API calls without touching the components that read/write
// them:
//   completions -> POST   /api/users/me/quests/:spotId/completions
//   favorites   -> PUT/DELETE /api/users/me/favorites/:spotId
//   bookmarks   -> PUT/DELETE /api/users/me/bookmarks/:spotId
// The dashboard reads the same `dillydally:completions` /
// `dillydally:favorites` keys to populate the pinned-photos carousel,
// favorite-sidequests list, and total points.

interface CompletionEntry {
  id: string;
  rating: number; // 0 (unrated) – 5
  notes: string;
  photos: string[]; // base64 data URLs for now, at least one is required
  points: number;
  completedAt: string; // ISO date
}

type CompletionMap = Record<string, CompletionEntry[]>;

const COMPLETIONS_KEY = 'dillydally:completions';
const BOOKMARKS_KEY = 'dillydally:bookmarks';
const FAVORITES_KEY = 'dillydally:favorites';

// Defensive: an earlier version of this app stored one Completion object
// per spot instead of an array of entries. This normalizes whatever is in
// localStorage into the current shape so a stale/mismatched schema (or
// hand-edited data) can't crash the page — unrecognized shapes are just
// dropped rather than thrown.
function sanitizeCompletions(raw: unknown): CompletionMap {
  if (!raw || typeof raw !== 'object') return {};
  const result: CompletionMap = {};

  const toEntry = (value: unknown): CompletionEntry | null => {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    if (typeof v.completedAt !== 'string') return null;
    return {
      id: typeof v.id === 'string' ? v.id : generateId(),
      rating: typeof v.rating === 'number' ? v.rating : 0,
      notes: typeof v.notes === 'string' ? v.notes : '',
      photos: Array.isArray(v.photos) ? (v.photos as string[]) : [],
      points: typeof v.points === 'number' ? v.points : 0,
      completedAt: v.completedAt,
    };
  };

  for (const [spotId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const entries = value.map(toEntry).filter((e): e is CompletionEntry => e !== null);
      if (entries.length > 0) result[spotId] = entries;
    } else {
      // Legacy single-completion-per-spot shape.
      const entry = toEntry(value);
      if (entry) result[spotId] = [entry];
    }
  }

  return result;
}

function loadCompletions(): CompletionMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(COMPLETIONS_KEY);
    return raw ? sanitizeCompletions(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function persistCompletions(map: CompletionMap) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(map));
}

function loadIdSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistIdSet(key: string, ids: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify([...ids]));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// Points scale with a spot's hype rating — flashier, more sought-after
// spots are worth more. See note above on why this isn't retroactive.
function pointsForSpot(spot: Spot): number {
  return spot.hype * 10;
}

function totalPointsFrom(map: CompletionMap): number {
  return Object.values(map).reduce(
    (sum, entries) => sum + entries.reduce((s, e) => s + e.points, 0),
    0
  );
}

// ---------------------------------------------------------------------------
// Mock data (backend integration point)
// ---------------------------------------------------------------------------
// Everything in this section is what a real backend would own. `fetchSpots`
// is written as an async function that takes the same filter shape a REST
// call would, so swapping the body for a `fetch('/api/spots?...')` later is
// a one-function change — nothing in the UI below needs to know the data
// used to be local. Likewise, `getSuggestions` stands in for a future
// `GET /api/spots/suggest?query=` typeahead endpoint.
//
// Each spot also carries exactly one "company" tag — solo-friendly,
// date-friendly, or group-friendly — alongside its other free-form tags, so
// it plugs into the same tag-filter UI without any extra plumbing.

const ALL_SPOTS: Spot[] = [
  {
    id: 'robarts',
    position: [43.6644, -79.3999],
    title: 'Robarts 13th Floor Study Nook',
    description:
      'Quiet corner with skyline views. Great for cramming before finals, terrible for making friends.',
    image: 'https://picsum.photos/seed/robarts/500/350',
    price: 1,
    hype: 3,
    time: '~2 hrs',
    category: 'User Submitted',
    tags: ['quiet', 'study', 'indoor', 'solo-friendly'],
  },
  {
    id: 'harthouse',
    position: [43.664, -79.3957],
    title: 'Hart House Great Hall',
    description:
      'Gothic architecture, free events most weeks, and surprisingly good acoustics for club meetings.',
    image: 'https://picsum.photos/seed/harthouse/500/350',
    price: 1,
    hype: 4,
    time: '~30 min',
    category: 'User Submitted',
    tags: ['free', 'social', 'indoor', 'group-friendly'],
  },
  {
    id: 'sidsmith',
    position: [43.6633, -79.3997],
    title: 'Sid Smith Food Court Bowls',
    description:
      'Reliable grain bowls between classes. Gets slammed at noon, so go early or go hungry.',
    image: 'https://picsum.photos/seed/sidsmith/500/350',
    price: 2,
    hype: 3,
    time: '~20 min',
    category: 'Food!',
    tags: ['quick', 'vegetarian-friendly', 'solo-friendly'],
  },
  {
    id: 'baldwin',
    position: [43.6595, -79.4005],
    title: 'Kimchi House, Baldwin St.',
    description:
      'Small, cash-friendly, and consistently the best kimchi jjigae within walking distance of campus.',
    image: 'https://picsum.photos/seed/baldwin/500/350',
    price: 2,
    hype: 5,
    time: '~45 min',
    category: 'Food!',
    tags: ['cash-only', 'spicy', 'sit-down', 'date-friendly'],
  },
  {
    id: 'secondcup',
    position: [43.6598, -79.3977],
    title: 'Second Cup on College',
    description:
      'Sponsored spot — 10% off with your student card this month. Solid wifi, mediocre lattes.',
    image: 'https://picsum.photos/seed/secondcup/500/350',
    price: 2,
    hype: 2,
    time: '~15 min',
    category: 'Promoted',
    tags: ['study', 'wifi', 'discount', 'solo-friendly'],
  },
  {
    id: 'newcollege',
    position: [43.6656, -79.4012],
    title: 'New College Dining Hall Wings Night',
    description:
      'Sponsored by Res Life — Thursday wings night is a whole event, bring your meal card.',
    image: 'https://picsum.photos/seed/newcollege/500/350',
    price: 3,
    hype: 4,
    time: '~1 hr',
    category: 'Promoted',
    tags: ['social', 'sit-down', 'group-friendly'],
  },
  {
    id: 'philosopherswalk',
    position: [43.6672, -79.3986],
    title: "Philosopher's Walk",
    description:
      'Tree-lined path tucked behind the ROM. Best 15-minute reset between back-to-back lectures.',
    image: 'https://picsum.photos/seed/philosopherswalk/500/350',
    price: 1,
    hype: 4,
    time: '~15 min',
    category: 'Parks',
    tags: ['free', 'quiet', 'outdoor', 'date-friendly'],
  },
  {
    id: 'queenspark',
    position: [43.6619, -79.3912],
    title: 'Queen\u2019s Park Green',
    description:
      'Open lawn across from the legislature. Frisbee at noon, hammocks by 4pm most sunny days.',
    image: 'https://picsum.photos/seed/queenspark/500/350',
    price: 1,
    hype: 4,
    time: '~1 hr',
    category: 'Parks',
    tags: ['free', 'social', 'outdoor', 'group-friendly'],
  },
  {
    id: 'taddlecreek',
    position: [43.6611, -79.3975],
    title: 'Taddle Creek Trail Marker',
    description:
      'A buried creek daylighted in a small park pocket. Easy to miss, worth the two-minute detour.',
    image: 'https://picsum.photos/seed/taddlecreek/500/350',
    price: 1,
    hype: 2,
    time: '~10 min',
    category: 'Parks',
    tags: ['quiet', 'outdoor', 'hidden-gem', 'solo-friendly'],
  },
  {
    id: 'kensington',
    position: [43.6547, -79.4005],
    title: 'Kensington Market Empanadas',
    description:
      'Community-submitted find — cheap, filling, and a solid excuse to wander the market after class.',
    image: 'https://picsum.photos/seed/kensington/500/350',
    price: 1,
    hype: 5,
    time: '~30 min',
    category: 'User Submitted',
    tags: ['cash-only', 'quick', 'hidden-gem', 'date-friendly'],
  },
];

function matchesQuery(spot: Spot, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    spot.title.toLowerCase().includes(q) ||
    spot.description.toLowerCase().includes(q) ||
    spot.category.toLowerCase().includes(q) ||
    spot.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

/**
 * Backend integration point.
 * Swap the body of this function for a real request, e.g.:
 *   const params = new URLSearchParams({
 *     query: filters.query,
 *     categories: [...filters.categories].join(','),
 *     tags: [...filters.tags].join(','),
 *   });
 *   const res = await fetch(`/api/spots?${params}`, { signal });
 *   return res.json();
 * The UI only depends on this returning `Promise<Spot[]>`.
 */
async function fetchSpots(filters: SpotFilters, signal?: AbortSignal): Promise<Spot[]> {
  await new Promise((resolve) => setTimeout(resolve, 220));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return ALL_SPOTS.filter(
    (spot) =>
      filters.categories.has(spot.category) &&
      (filters.tags.size === 0 || spot.tags.some((tag) => filters.tags.has(tag))) &&
      matchesQuery(spot, filters.query)
  );
}

type Suggestion =
  | { type: 'spot'; label: string; spot: Spot }
  | { type: 'tag'; label: string };

/**
 * Backend integration point: stands in for `GET /api/spots/suggest?query=`.
 * Kept synchronous-fast on purpose (typeahead should never feel like it's
 * waiting on a spinner) — a real endpoint would want to be called with the
 * same debounce this is invoked with from the sidebar.
 */
function getSuggestions(query: string): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const spotMatches: Suggestion[] = ALL_SPOTS.filter((s) =>
    s.title.toLowerCase().includes(q)
  )
    .slice(0, 4)
    .map((s) => ({ type: 'spot', label: s.title, spot: s }));

  const seenTags = new Set<string>();
  const tagMatches: Suggestion[] = [];
  for (const spot of ALL_SPOTS) {
    for (const tag of spot.tags) {
      if (tag.includes(q) && !seenTags.has(tag)) {
        seenTags.add(tag);
        tagMatches.push({ type: 'tag', label: tag });
      }
    }
  }

  return [...spotMatches, ...tagMatches].slice(0, 6);
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const CATEGORY_BADGE_STYLES: Record<Category, string> = {
  'User Submitted': 'bg-[#6b8fb5] text-[#f5ecd9]',
  Promoted: 'bg-[#c9a13b] text-[#f5ecd9]',
  'Food!': 'bg-[#c1573a] text-[#f5ecd9]',
  Parks: 'bg-[#3f7a4e] text-[#f5ecd9]',
};

const CATEGORY_PIN_COLORS: Record<Category, string> = {
  'User Submitted': '#6b8fb5',
  Promoted: '#c9a13b',
  'Food!': '#c1573a',
  Parks: '#3f7a4e',
};

const CATEGORY_ICONS: Record<Category, string> = {
  'User Submitted': '📍',
  Promoted: '✨',
  'Food!': '🍜',
  Parks: '🌳',
};

const ALL_CATEGORIES: Category[] = ['Food!', 'Parks', 'User Submitted', 'Promoted'];

function PriceIndicator({ price, size = 'sm' }: { price: number; size?: 'sm' | 'lg' }) {
  const textSize = size === 'lg' ? 'text-xl' : 'text-base';
  return (
    <span className={`${textSize} ${READABLE_FONT} font-bold tracking-tight text-[#3f7a4e]`}>
      {'$'.repeat(price)}
      <span className="text-[#3f7a4e]/25">{'$'.repeat(4 - price)}</span>
    </span>
  );
}

function HypeIndicator({ hype, size = 'sm' }: { hype: number; size?: 'sm' | 'lg' }) {
  const textSize = size === 'lg' ? 'text-xl' : 'text-base';
  return (
    <span className={textSize}>
      {'🔥'.repeat(hype)}
      <span className="opacity-20">{'🔥'.repeat(5 - hype)}</span>
    </span>
  );
}

function TimeIndicator({ time, size = 'sm' }: { time: string; size?: 'sm' | 'lg' }) {
  const textSize = size === 'lg' ? 'text-lg' : 'text-sm';
  return (
    <span className={`${textSize} ${READABLE_FONT} font-semibold text-[#3d6ea1]`}>⏱️ {time}</span>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs ${READABLE_FONT} font-semibold uppercase tracking-wide ${CATEGORY_BADGE_STYLES[category]}`}
    >
      {CATEGORY_ICONS[category]} {category}
    </span>
  );
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className={`inline-block rounded-full border border-[#4a3f2f]/15 bg-[#4a3f2f]/5 px-2.5 py-1 text-xs ${READABLE_FONT} font-medium text-[#6b5d45]`}>
      #{tag}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Spot card — used inside map popups
// ---------------------------------------------------------------------------

function SpotCard({
  spot,
  onExpand,
  completedCount,
  isBookmarked,
  onToggleBookmark,
}: {
  spot: Spot;
  onExpand: (spot: Spot) => void;
  completedCount: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  return (
    <div className="relative w-56 overflow-hidden rounded-lg bg-[#f5ecd9] text-[#4a3f2f]">
      <button
        onClick={() => onExpand(spot)}
        className="block w-full cursor-pointer text-left transition hover:brightness-95"
      >
        <div className="relative">
          <img src={spot.image} alt={spot.title} className="h-28 w-full object-cover" />
          {completedCount > 0 && (
            <span className="absolute left-2 top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#3f7a4e] px-1.5 text-xs font-bold text-[#f5ecd9] shadow">
              {completedCount > 1 ? `${completedCount}×` : '✓'}
            </span>
          )}
        </div>
        <div className="space-y-1.5 p-2.5">
          <CategoryBadge category={spot.category} />
          {/* Title keeps the crayon display font — this is exactly the kind
              of playful, hand-lettered "trail sign" moment it's meant for. */}
          <h3 className="text-base font-bold leading-tight text-[#4a3f2f]">{spot.title}</h3>
          <div className="flex items-center justify-between text-sm">
            <PriceIndicator price={spot.price} />
            <HypeIndicator hype={spot.hype} />
          </div>
          <TimeIndicator time={spot.time} />
          <div className={`pt-0.5 text-xs ${READABLE_FONT} font-medium text-[#a1602a]`}>
            Tap to see more →
          </div>
        </div>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark();
        }}
        aria-label={isBookmarked ? 'Remove bookmark' : 'Save for later'}
        className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-md transition ${
          isBookmarked ? 'bg-[#a1602a] text-[#f5ecd9]' : 'bg-[#f5ecd9]/90 text-[#4a3f2f]/60 hover:text-[#4a3f2f]'
        }`}
      >
        {isBookmarked ? '🔖' : '📑'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded spot detail
// ---------------------------------------------------------------------------

function ExpandedWidget({
  spot,
  entries,
  isFavorited,
  onToggleFavorite,
  isBookmarked,
  onToggleBookmark,
  onLogCompletion,
  onClose,
}: {
  spot: Spot;
  entries: CompletionEntry[];
  isFavorited: boolean;
  onToggleFavorite: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onLogCompletion: () => void;
  onClose: () => void;
}) {
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  const completedCount = entries.length;
  const totalSpotPoints = entries.reduce((sum, e) => sum + e.points, 0);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-[#f5ecd9] text-[#4a3f2f] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <img src={spot.image} alt={spot.title} className="h-64 w-full object-cover" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#4a3f2f]/80 text-lg font-bold text-[#f5ecd9] hover:bg-[#4a3f2f]"
          >
            ×
          </button>
        </div>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto p-5">
          <CategoryBadge category={spot.category} />
          {/* Title keeps the crayon display font, matching the card. */}
          <h2 className="text-2xl font-extrabold leading-tight text-[#4a3f2f]">
            {spot.title}
          </h2>
          <p className={`text-base ${READABLE_FONT} leading-relaxed text-[#5c4f3a]`}>{spot.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {spot.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-[#4a3f2f]/10 pt-3">
            <div className="flex flex-col items-start gap-1">
              <span className={`text-xs ${READABLE_FONT} font-semibold uppercase text-[#4a3f2f]/50`}>
                Price
              </span>
              <PriceIndicator price={spot.price} size="lg" />
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className={`text-xs ${READABLE_FONT} font-semibold uppercase text-[#4a3f2f]/50`}>
                Hype
              </span>
              <HypeIndicator hype={spot.hype} size="lg" />
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className={`text-xs ${READABLE_FONT} font-semibold uppercase text-[#4a3f2f]/50`}>
                Time
              </span>
              <TimeIndicator time={spot.time} size="lg" />
            </div>
          </div>

          {completedCount > 0 && (
            <div className={`flex items-center gap-2 rounded-lg bg-[#3f7a4e]/10 px-3 py-2 text-xs ${READABLE_FONT} font-semibold text-[#3f7a4e]`}>
              <span>
                Completed {completedCount}× · {totalSpotPoints} pts earned
              </span>
              {isFavorited && <span className="ml-auto text-[#c9a13b]">⭐ Featured</span>}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onToggleBookmark}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Save for later'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg shadow-md transition ${
                isBookmarked ? 'bg-[#a1602a] text-[#f5ecd9]' : 'bg-[#4a3f2f]/5 text-[#4a3f2f]/60 hover:bg-[#4a3f2f]/10'
              }`}
            >
              {isBookmarked ? '🔖' : '📑'}
            </button>
            <button
              onClick={onToggleFavorite}
              aria-label={isFavorited ? 'Remove from profile' : 'Feature on profile'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg shadow-md transition ${
                isFavorited ? 'bg-[#c9a13b] text-[#f5ecd9]' : 'bg-[#4a3f2f]/5 text-[#4a3f2f]/60 hover:bg-[#4a3f2f]/10'
              }`}
            >
              ⭐
            </button>
            <button
              onClick={onLogCompletion}
              className={`flex-1 rounded-full bg-[#3f7a4e] px-4 py-3 text-lg font-bold text-[#f5ecd9] shadow-md transition hover:brightness-95`}
            >
              {completedCount > 0 ? 'Log again' : 'Mark as completed'}
            </button>
          </div>
          <p className={`text-center text-[11px] ${READABLE_FONT} text-[#4a3f2f]/40`}>
            Bookmarks stay private. Featuring adds this spot to your public profile.
          </p>

          {sortedEntries.length > 0 && (
            <div className="space-y-2 border-t border-[#4a3f2f]/10 pt-3">
              <p className={`text-xs ${READABLE_FONT} font-semibold uppercase tracking-wide text-[#4a3f2f]/50`}>
                Your log ({sortedEntries.length})
              </p>
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {sortedEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 rounded-lg bg-[#4a3f2f]/5 p-2">
                    {entry.photos[0] && (
                      <img src={entry.photos[0]} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs ${READABLE_FONT} font-semibold text-[#4a3f2f]`}>
                        {formatDate(entry.completedAt)} · +{entry.points} pts
                      </p>
                      {entry.notes && (
                        <p className={`truncate text-[11px] ${READABLE_FONT} text-[#6b5d45]`}>{entry.notes}</p>
                      )}
                    </div>
                    {entry.rating > 0 && (
                      <span className="shrink-0 text-xs text-[#c9a13b]">{'★'.repeat(entry.rating)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completion modal — logged each time a quest is completed
// ---------------------------------------------------------------------------
// Kept deliberately plain: a rating, an optional note, a required photo,
// and a live points preview. No mascots, no vibe-check emoji grid — just a
// short form.

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className="text-2xl leading-none transition hover:scale-110"
        >
          <span className={n <= value ? 'text-[#c9a13b]' : 'text-[#4a3f2f]/20'}>★</span>
        </button>
      ))}
    </div>
  );
}

function CompletionModal({
  spot,
  onClose,
  onSubmit,
}: {
  spot: Spot;
  onClose: () => void;
  onSubmit: (entry: CompletionEntry) => void;
}) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const points = pointsForSpot(spot);
  const canSubmit = photos.length > 0;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      id: generateId(),
      rating,
      notes: notes.trim(),
      photos,
      points,
      completedAt: new Date().toISOString(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-[#f5ecd9] text-[#4a3f2f] shadow-2xl ${READABLE_FONT}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#4a3f2f]/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Log completion
            </p>
            <h2 className="truncate text-base font-bold text-[#4a3f2f]">{spot.title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4a3f2f]/10 text-lg font-bold text-[#4a3f2f] hover:bg-[#4a3f2f]/20"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#4a3f2f]/70">
              Rating (optional)
            </label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div>
            <label htmlFor="completion-notes" className="mb-1.5 block text-xs font-semibold text-[#4a3f2f]/70">
              Notes (optional)
            </label>
            <textarea
              id="completion-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything worth telling the next person?"
              className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#4a3f2f]/70">
              Photo <span className="text-[#c1573a]">(required)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, i) => (
                <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-[#4a3f2f]/10">
                  <img src={photo} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[#4a3f2f]/25 text-[#4a3f2f]/50 hover:border-[#a1602a] hover:text-[#a1602a]"
              >
                <span className="text-base leading-none">+</span>
                <span className="text-[10px] font-semibold">Add</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            {photos.length === 0 && (
              <p className="mt-1.5 text-[11px] text-[#4a3f2f]/45">
                Add at least one photo to log this quest.
              </p>
            )}
          </div>

          <div className="rounded-lg bg-[#4a3f2f]/5 px-3 py-2 text-xs font-semibold text-[#4a3f2f]/70">
            This entry will earn <span className="text-[#a1602a]">+{points} pts</span>.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#4a3f2f]/10 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-semibold text-[#6b5d45] hover:bg-[#4a3f2f]/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={canSubmit ? undefined : 'Add a photo to log this quest'}
            className="rounded-full bg-[#a1602a] px-5 py-2 text-sm font-bold text-[#f5ecd9] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#4a3f2f]/15 disabled:text-[#4a3f2f]/40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar — styled like a trailhead signpost / park field guide
// ---------------------------------------------------------------------------

function Sidebar({
  open,
  onClose,
  query,
  onQueryChange,
  onSelectSpot,
  onSelectTag,
  activeCategories,
  onToggleCategory,
  availableTags,
  activeTags,
  onToggleTag,
  resultCount,
  onClearAll,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  onSelectSpot: (spot: Spot) => void;
  onSelectTag: (tag: string) => void;
  activeCategories: Set<Category>;
  onToggleCategory: (category: Category) => void;
  availableTags: string[];
  activeTags: Set<string>;
  onToggleTag: (tag: string) => void;
  resultCount: number;
  onClearAll: () => void;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const suggestions = useMemo(() => getSuggestions(query), [query]);

  const activeFilterCount =
    (ALL_CATEGORIES.length - activeCategories.size) + activeTags.size + (query.trim() ? 1 : 0);

  const handleSuggestionPick = (s: Suggestion) => {
    if (s.type === 'spot') {
      onQueryChange(s.label);
      onSelectSpot(s.spot);
    } else {
      onQueryChange('');
      onSelectTag(s.label);
    }
    setShowSuggestions(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div onClick={onClose} className="fixed inset-0 z-[550] bg-black/30 sm:hidden" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[600] flex w-[85%] max-w-xs transform flex-col bg-[#f5ecd9] shadow-2xl transition-transform duration-300 ease-out sm:static sm:w-80 sm:max-w-none sm:translate-x-0 sm:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Signpost header */}
        <div
          className="relative shrink-0 border-b-4 border-[#8b5e34] px-4 pb-4 pt-5"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, rgba(139,94,52,0.06) 0px, rgba(139,94,52,0.06) 2px, transparent 2px, transparent 10px)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#4a3f2f]/10 text-base text-[#4a3f2f] sm:hidden"
            aria-label="Close menu"
          >
            ×
          </button>
          <div className="flex items-center gap-2">
            <img src="/gooseeee.png" alt="DillyDally Logo" className="h-10 w-10" />
            <div>
              {/* Wordmark + tagline keep the crayon font — this is the one
                  spot on the page where the hand-drawn voice is the point. */}
              <h1 className="text-2xl font-extrabold leading-tight text-[#4a3f2f] mb-1">
                DillyDally
              </h1>
              <p className="text-sm font-medium tracking-wide text-[#8b5e34]">
                Find your next quest sidequest :)
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* Search with autocomplete */}
          <div className="relative">
            <label className={`mb-1.5 block text-xs ${READABLE_FONT} font-semibold uppercase tracking-wide text-[#4a3f2f]/50`}>
              Search
            </label>
            <div className="flex items-center gap-2 rounded-full bg-[#4a3f2f]/5 px-3 py-2">
              <span className="text-base text-[#4a3f2f]/50">🔍</span>
              <input
                value={query}
                onChange={(e) => {
                  onQueryChange(e.target.value);
                  setShowSuggestions(true);
                  setHighlighted(0);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 120);
                }}
                onKeyDown={(e) => {
                  if (!suggestions.length) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlighted((h) => (h + 1) % suggestions.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSuggestionPick(suggestions[highlighted]);
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
                placeholder="Try 'kimchi' or 'quiet'…"
                className={`w-full bg-transparent text-base ${READABLE_FONT} text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none`}
              />
              {query && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onQueryChange('')}
                  aria-label="Clear search"
                  className="text-sm text-[#4a3f2f]/40 hover:text-[#4a3f2f]"
                >
                  ×
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[#4a3f2f]/10 bg-[#f5ecd9] shadow-lg">
                {suggestions.map((s, i) => (
                  <li key={s.type + s.label}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionPick(s)}
                      onMouseEnter={() => setHighlighted(i)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${READABLE_FONT} transition ${
                        i === highlighted ? 'bg-[#a1602a]/15' : ''
                      }`}
                    >
                      {s.type === 'spot' ? (
                        <>
                          <span>{CATEGORY_ICONS[s.spot.category]}</span>
                          <span className="font-medium text-[#4a3f2f]">{s.label}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[#a1602a]">#</span>
                          <span className="text-[#6b5d45]">{s.label}</span>
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Categories */}
          <div>
            <span className={`mb-1.5 block text-xs ${READABLE_FONT} font-semibold uppercase tracking-wide text-[#4a3f2f]/50`}>
              Categories
            </span>
            <div className="space-y-1.5">
              {ALL_CATEGORIES.map((category) => {
                const active = activeCategories.has(category);
                const count = ALL_SPOTS.filter((s) => s.category === category).length;
                return (
                  <button
                    key={category}
                    onClick={() => onToggleCategory(category)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base ${READABLE_FONT} font-semibold transition ${
                      active
                        ? CATEGORY_BADGE_STYLES[category]
                        : 'bg-[#4a3f2f]/5 text-[#4a3f2f]/40'
                    }`}
                  >
                    <span>
                      {CATEGORY_ICONS[category]} {category}
                    </span>
                    <span className="text-sm opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <span className={`mb-1.5 block text-xs ${READABLE_FONT} font-semibold uppercase tracking-wide text-[#4a3f2f]/50`}>
              Tags
            </span>
            {availableTags.length === 0 ? (
              <p className={`text-sm ${READABLE_FONT} text-[#6b5d45]`}>No tags for the categories selected.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const active = activeTags.has(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => onToggleTag(tag)}
                      className={`rounded-full border px-2.5 py-1 text-sm ${READABLE_FONT} font-medium transition ${
                        active
                          ? 'border-[#a1602a] bg-[#a1602a] text-[#f5ecd9]'
                          : 'border-[#4a3f2f]/15 bg-transparent text-[#6b5d45] hover:border-[#4a3f2f]/30'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-[#4a3f2f]/10 bg-[#4a3f2f]/5 px-4 py-3">
          <span className={`text-sm ${READABLE_FONT} font-medium text-[#6b5d45]`}>
            {resultCount} spot{resultCount === 1 ? '' : 's'}
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={onClearAll}
              className={`text-sm ${READABLE_FONT} font-semibold text-[#a1602a] hover:underline`}
            >
              Clear filters
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Page() {
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [icons, setIcons] = useState<Record<Category, any> | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set(ALL_CATEGORIES)
  );
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const [spots, setSpots] = useState<Spot[]>(ALL_SPOTS);
  const [loading, setLoading] = useState(false);

  const [completions, setCompletions] = useState<CompletionMap>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [completingSpot, setCompletingSpot] = useState<Spot | null>(null);

  useEffect(() => {
    import('./leaflet-icon-fix');
    import('leaflet').then((L) => {
      const makeIcon = (color: string) =>
        L.divIcon({
          className: '',
          html: `<div style="
            width: 22px;
            height: 22px;
            border-radius: 50% 50% 50% 0;
            background: ${color};
            border: 2px solid #f5ecd9;
            transform: rotate(-45deg);
            box-shadow: 0 2px 4px rgba(0,0,0,0.35);
          "></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 22],
          popupAnchor: [0, -22],
        });

      setIcons({
        'User Submitted': makeIcon(CATEGORY_PIN_COLORS['User Submitted']),
        Promoted: makeIcon(CATEGORY_PIN_COLORS['Promoted']),
        'Food!': makeIcon(CATEGORY_PIN_COLORS['Food!']),
        Parks: makeIcon(CATEGORY_PIN_COLORS['Parks']),
      });
    });
  }, []);

  // Load per-user completion, bookmark, and favorite state on mount.
  useEffect(() => {
    setCompletions(loadCompletions());
    setBookmarks(loadIdSet(BOOKMARKS_KEY));
    setFavorites(loadIdSet(FAVORITES_KEY));
  }, []);

  // Re-run the (mock, soon-to-be-real) fetch whenever filters change.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchSpots({ query, categories: activeCategories, tags: activeTags }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setSpots(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setLoading(false);
      });
    return () => controller.abort();
  }, [query, activeCategories, activeTags]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    ALL_SPOTS.filter((s) => activeCategories.has(s.category)).forEach((s) =>
      s.tags.forEach((t) => tagSet.add(t))
    );
    return Array.from(tagSet).sort();
  }, [activeCategories]);

  const totalPoints = useMemo(() => totalPointsFrom(completions), [completions]);

  const toggleCategory = (category: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        if (next.size === 1) return next; // keep at least one category active
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
    setActiveTags((prev) => {
      const stillValid = new Set(
        ALL_SPOTS.filter((s) => activeCategories.has(s.category) || s.category === category)
          .flatMap((s) => s.tags)
      );
      return new Set([...prev].filter((t) => stillValid.has(t)));
    });
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const selectTagFromSearch = (tag: string) => {
    setActiveTags((prev) => new Set(prev).add(tag));
  };

  const clearAll = () => {
    setQuery('');
    setActiveCategories(new Set(ALL_CATEGORIES));
    setActiveTags(new Set());
  };

  const toggleBookmark = (spotId: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.has(spotId) ? next.delete(spotId) : next.add(spotId);
      persistIdSet(BOOKMARKS_KEY, next);
      return next;
    });
  };

  const toggleFavorite = (spotId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(spotId) ? next.delete(spotId) : next.add(spotId);
      persistIdSet(FAVORITES_KEY, next);
      return next;
    });
  };

  const addCompletion = (spotId: string, entry: CompletionEntry) => {
    setCompletions((prev) => {
      const next = { ...prev, [spotId]: [...(prev[spotId] ?? []), entry] };
      persistCompletions(next);
      return next;
    });
    setCompletingSpot(null);
  };

  return (
    <main className="relative flex h-screen w-screen bg-[#f0e6d2]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        query={query}
        onQueryChange={setQuery}
        onSelectSpot={setSelectedSpot}
        onSelectTag={selectTagFromSearch}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        availableTags={availableTags}
        activeTags={activeTags}
        onToggleTag={toggleTag}
        resultCount={spots.length}
        onClearAll={clearAll}
      />

      <div className="relative h-full flex-1">
        <MapContainer
          center={UTSG_COORDS}
          zoom={16}
          scrollWheelZoom={true}
          zoomControl={false}
          className="
            h-full w-full
            [&_.leaflet-tile-pane]:sepia-[.15]
            [&_.leaflet-tile-pane]:saturate-[1.15]
            [&_.leaflet-tile-pane]:brightness-105
            [&_.leaflet-popup-content-wrapper]:bg-[#f5ecd9]
            [&_.leaflet-popup-content-wrapper]:text-[#4a3f2f]
            [&_.leaflet-popup-content-wrapper]:rounded-xl
            [&_.leaflet-popup-content-wrapper]:shadow-lg
            [&_.leaflet-popup-content-wrapper]:p-0
            [&_.leaflet-popup-content]:m-0
            [&_.leaflet-popup-content]:w-auto
            [&_.leaflet-popup-tip]:bg-[#f5ecd9]
            [&_.leaflet-popup-close-button]:text-[#7a6a4f]
            [&_.leaflet-control-zoom]:border-none
            [&_.leaflet-control-zoom]:shadow-md
            [&_.leaflet-control-zoom-in]:bg-[#f5ecd9]
            [&_.leaflet-control-zoom-in]:text-[#a1602a]
            [&_.leaflet-control-zoom-out]:bg-[#f5ecd9]
            [&_.leaflet-control-zoom-out]:text-[#a1602a]
            [&_.leaflet-control-attribution]:bg-[#f5ecd9]/85
            [&_.leaflet-control-attribution]:text-[#6b5d45]
          "
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomright" />
          {icons &&
            spots.map((spot) => (
              <Marker key={spot.id} position={spot.position} icon={icons[spot.category]}>
                <Popup>
                  <SpotCard
                    spot={spot}
                    onExpand={setSelectedSpot}
                    completedCount={(completions[spot.id] ?? []).length}
                    isBookmarked={bookmarks.has(spot.id)}
                    onToggleBookmark={() => toggleBookmark(spot.id)}
                  />
                </Popup>
              </Marker>
            ))}
        </MapContainer>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className={`absolute left-4 top-4 z-[500] flex items-center gap-1.5 rounded-full bg-[#f5ecd9] px-3 py-2 text-sm ${READABLE_FONT} font-semibold text-[#4a3f2f] shadow-lg sm:hidden`}
        >
          ☰ Explore
        </button>

        {/* Points + account, top-right */}
        <div className="absolute right-4 top-4 z-[500] flex items-center gap-2">
          <div className={`flex items-center gap-1.5 rounded-full bg-[#f5ecd9] px-3 py-2 text-sm font-bold text-[#a1602a] shadow-lg`}>
            {totalPoints} pts
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-full bg-[#f5ecd9] px-2.5 py-2 shadow-lg transition hover:brightness-95"
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-[#a1602a] text-sm ${READABLE_FONT} font-bold text-[#f5ecd9]`}>
              U
            </span>
            <span className={`pr-1 text-sm ${READABLE_FONT} font-semibold text-[#4a3f2f]`}>Account</span>
          </Link>
        </div>

        {loading && (
          <div className={`absolute right-4 top-16 z-[500] rounded-full bg-[#f5ecd9] px-3 py-1.5 text-sm ${READABLE_FONT} font-semibold text-[#6b5d45] shadow-md`}>
            Searching…
          </div>
        )}

        {!loading && spots.length === 0 && (
          <div className="absolute bottom-6 left-1/2 z-[500] w-[90%] max-w-sm -translate-x-1/2 rounded-2xl bg-[#f5ecd9] p-4 text-center shadow-lg">
            <p className={`text-base ${READABLE_FONT} font-semibold text-[#4a3f2f]`}>No sidequests match yet.</p>
            <p className={`mt-1 text-sm ${READABLE_FONT} text-[#6b5d45]`}>
              Try clearing a tag or category filter.
            </p>
          </div>
        )}
      </div>

      {selectedSpot && (
        <ExpandedWidget
          spot={selectedSpot}
          entries={completions[selectedSpot.id] ?? []}
          isFavorited={favorites.has(selectedSpot.id)}
          onToggleFavorite={() => toggleFavorite(selectedSpot.id)}
          isBookmarked={bookmarks.has(selectedSpot.id)}
          onToggleBookmark={() => toggleBookmark(selectedSpot.id)}
          onLogCompletion={() => setCompletingSpot(selectedSpot)}
          onClose={() => setSelectedSpot(null)}
        />
      )}

      {completingSpot && (
        <CompletionModal
          spot={completingSpot}
          onClose={() => setCompletingSpot(null)}
          onSubmit={(entry) => addCompletion(completingSpot.id, entry)}
        />
      )}
    </main>
  );
}