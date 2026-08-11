'use client';

import { getSideQuests } from '@/lib/functions';
import { HypeIndicator, PriceIndicator, TimeIndicator } from '@/lib/components/Indicators';
import useProfile from '@/lib/hooks/useProfile';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Category, Spot } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';

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
// Types
// ---------------------------------------------------------------------------

/**
 * Backend integration point.
 * Swap the body of this function for a real request, e.g.:
 *   const params = new URLSearchParams({
 *     query: filters.query,
 *     categories: [...filters.categories].join(','),
 *     tags: [...filters.tags].join(','),
 *   });
 *   const res = await fetch(`/api/spots${params}`, { signal });
 *   return res.json();
 * The UI only depends on this returning `Promise<Spot[]>`.
 */

interface SpotFilters {
  query: string;
  categories: Set<Category>;
  tags: Set<string>;
}


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

async function fetchSpots(filters: SpotFilters, signal?: AbortSignal): Promise<Spot[]> {
  const ALL_SPOTS = await getSideQuests();

  await new Promise((resolve) => setTimeout(resolve, 220));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return ALL_SPOTS.filter(
    (spot) =>
      filters.categories.has(spot.category) &&
      // @ts-ignore
      (filters.tags.size === 0 || spot.tags.some((tag) => filters.tags.has(tag))) &&
      matchesQuery(spot, filters.query)
  );
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

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs readable-font font-semibold uppercase tracking-wide ${CATEGORY_BADGE_STYLES[category]}`}
    >
      {CATEGORY_ICONS[category]} {category}
    </span>
  );
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className={`inline-block rounded-full border border-[#4a3f2f]/15 bg-[#4a3f2f]/5 px-2.5 py-1 text-xs readable-font font-medium text-[#6b5d45]`}>
      #{tag}
    </span>
  );
}

function SpotCard({ spot, onExpand }: { spot: Spot; onExpand: (spot: Spot) => void }) {
  return (
    <button
      onClick={() => onExpand(spot)}
      className="block w-56 cursor-pointer overflow-hidden rounded-lg bg-[#f5ecd9] text-left text-[#4a3f2f] transition hover:brightness-95"
    >
      <img src={spot.image} alt={spot.title} className="h-28 w-full object-cover" />
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
        <div className={`pt-0.5 text-xs readable-font font-medium text-[#a1602a]`}>
          Tap to see more →
        </div>
      </div>
    </button>
  );
}

function ExpandedWidget({ spot, onClose }: { spot: Spot; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center bg-black/40 p-4"
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
            className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#4a3f2f]/80 text-lg font-bold text-[#f5ecd9] hover:bg-[#4a3f2f]`}
          >
            ×
          </button>
        </div>
        <div className="space-y-3 p-5">
          <CategoryBadge category={spot.category} />
          {/* Title keeps the crayon display font, matching the card. */}
          <h2 className="text-2xl font-extrabold leading-tight text-[#4a3f2f]">
            {spot.title}
          </h2>
          <p className={`text-base readable-font leading-relaxed text-[#5c4f3a]`}>{spot.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {spot.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-[#4a3f2f]/10 pt-3">
            <div className="flex flex-col items-start gap-1">
              <span className={`text-xs readable-font font-semibold uppercase text-[#4a3f2f]/50`}>
                Price
              </span>
              <PriceIndicator price={spot.price} size="lg" />
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className={`text-xs readable-font font-semibold uppercase text-[#4a3f2f]/50`}>
                Hype
              </span>
              <HypeIndicator hype={spot.hype} size="lg" />
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className={`text-xs readable-font font-semibold uppercase text-[#4a3f2f]/50`}>
                Time
              </span>
              <TimeIndicator time={spot.time} size="lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar — styled like a trailhead signpost / park field guide
// ---------------------------------------------------------------------------

type Suggestion =
  | { type: 'spot'; label: string; spot: Spot }
  | { type: 'tag'; label: string };

function getSuggestions(query: string, spots: any): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const spotMatches: Suggestion[] = spots.filter((s: any) =>
    s.title.toLowerCase().includes(q)
  )
    .slice(0, 4)
    .map((s: any) => ({ type: 'spot', label: s.title, spot: s }));

  const seenTags = new Set<string>();
  const tagMatches: Suggestion[] = [];
  for (const spot of spots) {
    for (const tag of spot.tags) {
      if (tag.includes(q) && !seenTags.has(tag)) {
        seenTags.add(tag);
        tagMatches.push({ type: 'tag', label: tag });
      }
    }
  }

  return [...spotMatches, ...tagMatches].slice(0, 6);
}

function Sidebar({
  spots,
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
  spots: any,
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

  const suggestions = useMemo(() => getSuggestions(query, spots), [query, spots]);

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
        <div onClick={onClose} className="fixed inset-0 z-550 bg-black/30 sm:hidden" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-600 flex w-[85%] max-w-xs transform flex-col bg-[#f5ecd9] shadow-2xl transition-transform duration-300 ease-out sm:static sm:w-80 sm:max-w-none sm:translate-x-0 sm:shadow-none ${
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
            <label className={`mb-1.5 block text-xs  font-semibold uppercase tracking-wide text-[#4a3f2f]/50`}>
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
                className={`w-full bg-transparent text-base text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none`}
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
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm readable-font transition ${
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
            <span className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4a3f2f]/50`}>
              Categories
            </span>
            <div className="space-y-1.5">
              {ALL_CATEGORIES.map((category) => {
                const active = activeCategories.has(category);
                const count = spots.filter((s: any) => s.category === category).length;
                return (
                  <button
                    key={category}
                    onClick={() => onToggleCategory(category)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base readable-font font-semibold transition ${
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
            <span className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4a3f2f]/50`}>
              Tags
            </span>
            {availableTags.length === 0 ? (
              <p className={`text-sm readable-font text-[#6b5d45]`}>No tags for the categories selected.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const active = activeTags.has(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => onToggleTag(tag)}
                      className={`rounded-full border px-2.5 py-1 text-sm readable-font font-medium transition ${
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
          <span className={`text-sm readable-font font-medium text-[#6b5d45]`}>
            {resultCount} spot{resultCount === 1 ? '' : 's'}
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={onClearAll}
              className={`text-sm readable-font font-semibold text-[#a1602a] hover:underline`}
            >
              Clear filters
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function AccountPill() {
  const { profile } = useProfile();

  return (
      <Link
        href="/dashboard"
        className="absolute right-4 top-4 z-500 flex items-center gap-2 rounded-full bg-[#f5ecd9] px-2.5 py-2 shadow-lg transition hover:brightness-95"
      >
        {/* @ts-ignore */}
        {profile?.avatarUrl ? (
            <img
              // @ts-ignore
              src={profile.avatarUrl}
              className="flex h-7 w-7 items-center justify-center rounded-full"
            />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#a1602a] text-sm readable-font font-bold text-[#f5ecd9]">
            U
          </span>
        )}
        <span className={`pr-1 text-sm readable-font font-semibold text-[#4a3f2f]`}>{profile?.displayName ?? "Account"}</span>
      </Link>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DillyDallyPage() {
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [icons, setIcons] = useState<Record<Category, any> | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set(ALL_CATEGORIES)
  );

  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  let { data: spots, isPending } = useQuery({
    queryKey: ['spots'],
    queryFn: getSideQuests,
    initialData: []
  });

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

      setIcons(       
        {
        'User Submitted': makeIcon(CATEGORY_PIN_COLORS['User Submitted']),
        Promoted: makeIcon(CATEGORY_PIN_COLORS['Promoted']),
        'Food!': makeIcon(CATEGORY_PIN_COLORS['Food!']),
        Parks: makeIcon(CATEGORY_PIN_COLORS['Parks']),
      });
    });
  }, []);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    spots.filter((s: any) => activeCategories.has(s.category)).forEach((s) =>
      s.tags.forEach((t: any) => tagSet.add(t))
    );
    return Array.from(tagSet).sort();
  }, [activeCategories, spots]);

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
        spots.filter((s) => activeCategories.has(s.category) || s.category === category)
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

  return (
    <main className="relative flex h-screen w-screen bg-[#f0e6d2]">
      <Sidebar
        spots={spots}
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
              <Marker key={spot.id} position={spot.position} icon={icons[spot.category as Category]}>
                <Popup>
                  <SpotCard spot={spot} onExpand={setSelectedSpot} />
                </Popup>
              </Marker>
            ))}
        </MapContainer>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className={`absolute left-4 top-4 z-500 flex items-center gap-1.5 rounded-full bg-[#f5ecd9] px-3 py-2 text-sm readable-font font-semibold text-[#4a3f2f] shadow-lg sm:hidden`}
        >
          ☰ Explore
        </button>

        <AccountPill />

        {isPending && (
          <div className={`absolute right-4 top-16 z-500 rounded-full bg-[#f5ecd9] px-3 py-1.5 text-sm readable-font font-semibold text-[#6b5d45] shadow-md`}>
            Searching…
          </div>
        )}

        {!isPending && spots.length === 0 && (
          <div className="absolute bottom-6 left-1/2 z-500 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl bg-[#f5ecd9] p-4 text-center shadow-lg">
            <p className={`text-base readable-font font-semibold text-[#4a3f2f]`}>No sidequests match yet.</p>
            <p className={`mt-1 text-sm readable-font text-[#6b5d45]`}>
              Try clearing a tag or category filter.
            </p>
          </div>
        )}
      </div>

      {selectedSpot && (
        <ExpandedWidget spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
      )}
    </main>
  );
}