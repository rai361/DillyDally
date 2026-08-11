'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Shared tokens (mirrors app/page.tsx — pull into a shared module if the
// palette needs to move in both places at once)
// ---------------------------------------------------------------------------

type Category = 'User Submitted' | 'Promoted' | 'Food!' | 'Parks';

const CATEGORY_BADGE_STYLES: Record<Category, string> = {
  'User Submitted': 'bg-[#6b8fb5] text-[#f5ecd9]',
  Promoted: 'bg-[#c9a13b] text-[#f5ecd9]',
  'Food!': 'bg-[#c1573a] text-[#f5ecd9]',
  Parks: 'bg-[#3f7a4e] text-[#f5ecd9]',
};

const CATEGORY_ICONS: Record<Category, string> = {
  'User Submitted': '📍',
  Promoted: '✨',
  'Food!': '🍜',
  Parks: '🌳',
};

// Minimal lookup so a favorited spot ID can be rendered here without the
// dashboard needing the map's full Spot data (position, description, image
// etc). Mirrors app/page.tsx's ALL_SPOTS — move both into a shared module
// once there's a real `/api/spots` to hit instead.
const SPOT_LOOKUP: Record<string, { title: string; category: Category; hype: 1 | 2 | 3 | 4 | 5; time: string }> = {
  robarts: { title: 'Robarts 13th Floor Study Nook', category: 'User Submitted', hype: 3, time: '~2 hrs' },
  harthouse: { title: 'Hart House Great Hall', category: 'User Submitted', hype: 4, time: '~30 min' },
  sidsmith: { title: 'Sid Smith Food Court Bowls', category: 'Food!', hype: 3, time: '~20 min' },
  baldwin: { title: 'Kimchi House, Baldwin St.', category: 'Food!', hype: 5, time: '~45 min' },
  secondcup: { title: 'Second Cup on College', category: 'Promoted', hype: 2, time: '~15 min' },
  newcollege: { title: 'New College Dining Hall Wings Night', category: 'Promoted', hype: 4, time: '~1 hr' },
  philosopherswalk: { title: "Philosopher's Walk", category: 'Parks', hype: 4, time: '~15 min' },
  queenspark: { title: 'Queen\u2019s Park Green', category: 'Parks', hype: 4, time: '~1 hr' },
  taddlecreek: { title: 'Taddle Creek Trail Marker', category: 'Parks', hype: 2, time: '~10 min' },
  kensington: { title: 'Kensington Market Empanadas', category: 'User Submitted', hype: 5, time: '~30 min' },
};

// ---------------------------------------------------------------------------
// Completion / favorites data (same shape + localStorage keys as
// app/page.tsx — the map page is the only place these get written)
// ---------------------------------------------------------------------------
// Swap all of these localStorage reads for `GET /api/users/me/quests` and
// `GET /api/users/me/favorites` once there's a backend.

interface CompletionEntry {
  id: string;
  rating: number;
  notes: string;
  photos: string[];
  points: number;
  completedAt: string;
}

type CompletionMap = Record<string, CompletionEntry[]>;

const COMPLETIONS_KEY = 'dillydally:completions';
const FAVORITES_KEY = 'dillydally:favorites';
const FOLLOWING_KEY = 'dillydally:following';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Defensive: an earlier version of the map page stored one Completion
// object per spot instead of an array of entries. This normalizes whatever
// is in localStorage into the current shape so a stale schema can't crash
// the dashboard — unrecognized shapes are just dropped rather than thrown.
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

function loadIdSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
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
// Shaped the way `GET /api/users/me` would eventually respond — swapping
// this constant for a fetch call is a contained change once the endpoint
// exists.

interface UserProfile {
  displayName: string;
  handle: string;
  bio: string;
  avatar: string;
  followers: number;
  following: number;
}

const CURRENT_USER: UserProfile = {
  displayName: 'Denial Scissor',
  handle: 'wedabestmusic',
  bio: 'First Year Computer Engineering. Daily Minoxidil User.',
  avatar: '/IMG_5581.jpg',
  followers: 128,
  following: 54,
};

interface QuestPhoto {
  id: string;
  image: string;
  caption: string;
  completedAt: string;
}

interface FavoriteSpot {
  id: string;
  title: string;
  category: Category;
  hype: 1 | 2 | 3 | 4 | 5;
  time: string;
}

// Shown before the user has completed / favorited anything, so the page
// has something to say instead of just looking broken on first run.
const DEMO_PHOTOS: QuestPhoto[] = [
  { id: 'p1', image: 'https://picsum.photos/seed/questphoto1/500/500', caption: 'Sunset, Philosopher\u2019s Walk', completedAt: '' },
  { id: 'p2', image: 'https://picsum.photos/seed/questphoto2/500/500', caption: 'First kimchi jjigae of the semester', completedAt: '' },
  { id: 'p3', image: 'https://picsum.photos/seed/questphoto3/500/500', caption: 'Hammock day, Queen\u2019s Park', completedAt: '' },
  { id: 'p4', image: 'https://picsum.photos/seed/questphoto4/500/500', caption: 'Robarts, 2am, still going', completedAt: '' },
  { id: 'p5', image: 'https://picsum.photos/seed/questphoto5/500/500', caption: 'Empanada run, Kensington', completedAt: '' },
];

const DEMO_FAVORITES: FavoriteSpot[] = [
  { id: 'baldwin', title: 'Kimchi House, Baldwin St.', category: 'Food!', hype: 5, time: '~45 min' },
  { id: 'queenspark', title: 'Queen\u2019s Park Green', category: 'Parks', hype: 4, time: '~1 hr' },
  { id: 'harthouse', title: 'Hart House Great Hall', category: 'User Submitted', hype: 4, time: '~30 min' },
  { id: 'kensington', title: 'Kensington Market Empanadas', category: 'User Submitted', hype: 5, time: '~30 min' },
];

function deriveDashboardData(
  completions: CompletionMap,
  favoriteIds: Set<string>
): { photos: QuestPhoto[]; favorites: FavoriteSpot[]; points: number } {
  const entries = Object.entries(completions).flatMap(([spotId, list]) =>
    list.map((entry) => ({ spotId, entry }))
  );
  entries.sort((a, b) => new Date(b.entry.completedAt).getTime() - new Date(a.entry.completedAt).getTime());

  const photos: QuestPhoto[] = entries.flatMap(({ spotId, entry }) =>
    entry.photos.map((image, i) => ({
      id: `${entry.id}-${i}`,
      image,
      caption: SPOT_LOOKUP[spotId]?.title ?? 'Sidequest',
      completedAt: entry.completedAt,
    }))
  );

  const favorites: FavoriteSpot[] = [...favoriteIds]
    .map((spotId) => {
      const spot = SPOT_LOOKUP[spotId];
      return spot ? { id: spotId, ...spot } : null;
    })
    .filter((s): s is FavoriteSpot => s !== null);

  return {
    photos: photos.length > 0 ? photos : DEMO_PHOTOS,
    favorites: favorites.length > 0 ? favorites : DEMO_FAVORITES,
    points: totalPointsFrom(completions),
  };
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function HypeIndicator({ hype }: { hype: number }) {
  return (
    <span className="text-sm">
      {'🔥'.repeat(hype)}
      <span className="opacity-20">{'🔥'.repeat(5 - hype)}</span>
    </span>
  );
}

function SectionEyebrow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className="h-px flex-1 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #8b5e34 0px, #8b5e34 4px, transparent 4px, transparent 9px)',
        }}
      />
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#8b5e34]">
        <span aria-hidden>{icon}</span>
        {children}
      </span>
      <span
        className="h-px flex-1 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #8b5e34 0px, #8b5e34 4px, transparent 4px, transparent 9px)',
        }}
      />
    </div>
  );
}

function StatBlock({ value, label, accent = false }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-5">
      <span className={`text-xl font-extrabold ${accent ? 'text-[#a1602a]' : 'text-[#4a3f2f]'}`}>{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
        {label}
      </span>
    </div>
  );
}

// Demo-only follow toggle for this profile. There's no other-user view yet
// (this page always renders "me"), so this doesn't touch the follower
// count — it's here so the interaction exists and is easy to wire up to
// `PUT/DELETE /api/users/:handle/follow` once profiles are viewable by
// other people.
function FollowButton() {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setFollowing(window.localStorage.getItem(FOLLOWING_KEY) === '1');
  }, []);

  const toggle = () => {
    setFollowing((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(FOLLOWING_KEY, next ? '1' : '0');
      }
      return next;
    });
  };

  return (
    <button
      onClick={toggle}
      className={`group mt-4 rounded-full px-5 py-2 text-sm font-semibold shadow-md transition ${
        following
          ? 'bg-[#4a3f2f]/10 text-[#4a3f2f] hover:bg-[#c1573a]/10 hover:text-[#c1573a]'
          : 'bg-[#a1602a] text-[#f5ecd9] hover:brightness-95'
      }`}
    >
      {following ? (
        <>
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </>
      ) : (
        '+ Follow'
      )}
    </button>
  );
}

// Slight alternating tilt so the photo strip reads as pinned snapshots
// rather than a stock gallery grid.
const PHOTO_TILT = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2', '-rotate-1'];

function PhotoCarousel({ photos }: { photos: QuestPhoto[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-1 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <figure
            key={photo.id}
            className={`w-40 shrink-0 snap-start rounded-sm bg-[#f5ecd9] p-2 pb-4 shadow-lg transition hover:-translate-y-1 hover:shadow-xl ${PHOTO_TILT[i % PHOTO_TILT.length]}`}
          >
            <img
              src={photo.image}
              alt={photo.caption}
              className="h-36 w-full rounded-[2px] object-cover"
            />
            <figcaption className="mt-2 text-center text-xs leading-snug text-[#6b5d45]">
              {photo.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      {/* Nav arrows — same circular treatment as the map's zoom control */}
      <button
        onClick={() => scrollByAmount(-1)}
        aria-label="Scroll photos left"
        className="absolute -left-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#f5ecd9] text-[#a1602a] shadow-md hover:brightness-95 sm:flex"
      >
        ‹
      </button>
      <button
        onClick={() => scrollByAmount(1)}
        aria-label="Scroll photos right"
        className="absolute -right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#f5ecd9] text-[#a1602a] shadow-md hover:brightness-95 sm:flex"
      >
        ›
      </button>
    </div>
  );
}

function FavoriteSpotCard({ spot }: { spot: FavoriteSpot }) {
  return (
    <Link
      href={`/?spot=${spot.id}`}
      className="flex items-center justify-between gap-3 rounded-lg bg-[#f5ecd9] px-4 py-3 shadow-md transition hover:brightness-95"
    >
      <div className="min-w-0">
        <span
          className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_BADGE_STYLES[spot.category]}`}
        >
          {CATEGORY_ICONS[spot.category]} {spot.category}
        </span>
        <h3 className="truncate text-base font-bold text-[#4a3f2f]">{spot.title}</h3>
        <div className="mt-1 flex items-center gap-3">
          <HypeIndicator hype={spot.hype} />
          <span className="text-xs font-semibold text-[#3d6ea1]">⏱️ {spot.time}</span>
        </div>
      </div>
      <span className="shrink-0 text-xs font-medium text-[#a1602a]">Map →</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const user = CURRENT_USER;
  const [dashboard, setDashboard] = useState<{ photos: QuestPhoto[]; favorites: FavoriteSpot[]; points: number }>({
    photos: DEMO_PHOTOS,
    favorites: DEMO_FAVORITES,
    points: 0,
  });

  useEffect(() => {
    setDashboard(deriveDashboardData(loadCompletions(), loadIdSet(FAVORITES_KEY)));
  }, []);

  return (
    <main className="min-h-screen w-screen bg-[#f0e6d2] text-[#4a3f2f]">
      <Link
        href="/"
        className="fixed left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-[#f5ecd9] px-3 py-2 text-xs font-semibold text-[#4a3f2f] shadow-lg hover:brightness-95"
      >
        ← Back to map
      </Link>

      <div className="mx-auto flex max-w-xl flex-col items-center px-6 pb-16 pt-20">
        {/* Profile */}
        <img
          src={user.avatar}
          alt={user.displayName}
          className="h-24 w-24 rounded-full border-4 border-[#f5ecd9] object-cover shadow-lg"
        />
        <h1 className="mt-4 text-2xl font-extrabold leading-tight text-[#4a3f2f]">
          {user.displayName}
        </h1>
        <p className="text-sm font-semibold text-[#a1602a]">@{user.handle}</p>
        <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[#6b5d45]">
          {user.bio}
        </p>

        <FollowButton />

        <div className="mt-5 flex items-center divide-x divide-[#4a3f2f]/10 rounded-full bg-[#f5ecd9] py-3 shadow-md">
          <StatBlock value={dashboard.points} label="Points" accent />
          <StatBlock value={user.followers} label="Ducklings" />
          <StatBlock value={user.following} label="Admiring" />
        </div>

        {/* Pinned quest photos */}
        <div className="mt-12 w-full">
          <SectionEyebrow icon="📌">Pinned from quests</SectionEyebrow>
          <PhotoCarousel photos={dashboard.photos} />
        </div>

        {/* Favorite sidequests */}
        <div className="mt-10 w-full">
          <SectionEyebrow icon="⭐">Favorite sidequests</SectionEyebrow>
          <div className="space-y-2.5">
            {dashboard.favorites.map((spot) => (
              <FavoriteSpotCard key={spot.id} spot={spot} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}