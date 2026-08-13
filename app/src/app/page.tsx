'use client';

import { getSideQuests, submitQuestForApproval, updateCompletions } from '@/lib/functions';
import { HypeIndicator, PriceIndicator, TimeIndicator } from '@/lib/components/Indicators';
import dynamic from 'next/dynamic';
import { ChangeEvent, createContext, Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { Category, QuestCompletionEntry, Quest } from '@/lib/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import useAuth from '@/lib/hooks/useAuth';
import { StarRating } from '@/lib/components/StarRating';
import { AccountPopup } from '@/lib/components/AccountPopup';
import { useMapEvents } from 'react-leaflet';
import { toDataURL } from '@/lib/utils';
import ChatWidget from '../lib/components/ChatWidget';
import { ALL_CATEGORIES } from '@/lib/constants';
import useProfile from '@/lib/hooks/useProfile';
import { useRouter } from 'next/navigation';

interface PickerProps {
  quests: Quest[]
}

const Picker = createContext<PickerProps>({
  quests: []
});

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

type CompletionMap = Record<any, QuestCompletionEntry[]>;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function pointsForQuest(quest: Quest): number {
  return quest.hype * 10;
}

function totalPointsFrom(map: CompletionMap): number {
  return Object.values(map).reduce(
    (sum, entries) => sum + entries.reduce((s, e) => s + e.points, 0),
    0
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

function QuestCard({
  quest,
  onExpand,
  completedCount,
  isBookmarked,
  onToggleBookmark,
  updateQuestStatus
}: {
  quest: Quest;
  onExpand: (quest: Quest) => void;
  completedCount: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  updateQuestStatus: (variables: string[]) => any
}) {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <div className="relative w-56 overflow-hidden rounded-lg bg-[#f5ecd9] text-[#4a3f2f]">
      <button
        onClick={() => onExpand(quest)}
        className="block w-full cursor-pointer text-left transition hover:brightness-95"
      >
        <div className="relative">
          <img src={quest.image} alt={quest.title} className="h-28 w-full object-cover" />
          {completedCount > 0 && (
            <span className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#3f7a4e] px-1.5 text-xs font-bold text-[#f5ecd9] shadow">
              {completedCount > 1 ? `${completedCount}×` : '✓'}
            </span>
          )}
        </div>
        <div className="space-y-1.5 p-2.5">
          <CategoryBadge category={quest.category} />
          <h3 className="text-base font-bold leading-tight text-[#4a3f2f]">{quest.title}</h3>
          <div className="flex items-center justify-between text-sm">
            <PriceIndicator price={quest.price} />
            <HypeIndicator hype={quest.hype} />
          </div>
          <TimeIndicator time={quest.time} />
          <div className={`pt-0.5 text-xs readable-font font-medium text-[#a1602a]`}>
            Tap to see more →
          </div>
        </div>
      </button>

      {isAuthenticated && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark();
          }}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Save for later'}
          className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-md transition ${
            isBookmarked ? 'bg-[#a1602a] text-[#f5ecd9]' : 'bg-[#f5ecd9]/90 text-[#4a3f2f]/60 hover:text-[#4a3f2f]'
          }`}
        >
          {isBookmarked ? '🔖' : '📑'}
        </button>
      )}

      {isAdmin && (
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {[["approved", "✓", "bg-[#48871d]"], ["pending", "", "bg-[#cfb223]"], ["rejected", "✘", "bg-[#9f3a33]"]].map(status => (
            <button  
              key={status[0]}
              onClick={() => {
                if (status[0] != "pending") {
                  updateQuestStatus([quest.id, status[0]])
                }
              }}        
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm shadow-md transition ${
                status[0] == quest.status ? `${status[2]} text-[#f5ecd9]` : 'bg-[#f5ecd9]/90 text-[#4a3f2f]/60 hover:text-[#4a3f2f]'
              }`}
            >
              {status[1]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpandedWidget({
  quest,
  entries,
  isFavorited,
  onToggleFavorite,
  isBookmarked,
  onToggleBookmark,
  onLogCompletion,
  onClose,
}: {
  quest: Quest;
  entries: QuestCompletionEntry[];
  isFavorited: boolean;
  onToggleFavorite: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onLogCompletion: () => void;
  onClose: () => void;
}) {
  const { isAuthenticated } = useAuth();

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  const completedCount = entries.length;
  const totalQuestPoints = entries.reduce((sum, e) => sum + e.points, 0);

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
          <img src={quest.image} alt={quest.title} className="h-64 w-full object-cover" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#4a3f2f]/80 text-lg font-bold text-[#f5ecd9] hover:bg-[#4a3f2f]"
          >
            ×
          </button>
        </div>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto p-5">
          <CategoryBadge category={quest.category} />
          {/* Title keeps the crayon display font, matching the card. */}
          <h2 className="text-2xl font-extrabold leading-tight text-[#4a3f2f]">
            {quest.title}
          </h2>
          <p className={`text-base readable-font leading-relaxed text-[#5c4f3a]`}>{quest.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {quest.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-[#4a3f2f]/10 pt-3">
            <div className="flex flex-col items-start gap-1">
              <span className={`text-xs readable-font font-semibold uppercase text-[#4a3f2f]/50`}>
                Price
              </span>
              <PriceIndicator price={quest.price} size="lg" />
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className={`text-xs readable-font font-semibold uppercase text-[#4a3f2f]/50`}>
                Hype
              </span>
              <HypeIndicator hype={quest.hype} size="lg" />
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className={`text-xs readable-font font-semibold uppercase text-[#4a3f2f]/50`}>
                Time
              </span>
              <TimeIndicator time={quest.time} size="lg" />
            </div>
          </div>

          {isAuthenticated && (
            <>
              {completedCount > 0 && (
                <div className={`flex items-center gap-2 rounded-lg bg-[#3f7a4e]/10 px-3 py-2 text-xs readable-font font-semibold text-[#3f7a4e]`}>
                  <span>
                    Completed {completedCount}× · {totalQuestPoints} pts earned
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
              <p className={`text-center text-[11px] readable-font text-[#4a3f2f]/40`}>
                Bookmarks stay private. Featuring adds this quest to your public profile.
              </p>

              {sortedEntries.length > 0 && (
                <div className="space-y-2 border-t border-[#4a3f2f]/10 pt-3">
                  <p className={`text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50`}>
                    Your log ({sortedEntries.length})
                  </p>
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {sortedEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 rounded-lg bg-[#4a3f2f]/5 p-2">
                        {entry.imageUrls[0] && (
                          <img src={entry.imageUrls[0]} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-xs readable-font font-semibold text-[#4a3f2f]`}>
                            {formatDate(entry.completedAt)} · +{entry.points} pts
                          </p>
                          {entry.note && (
                            <p className={`truncate text-[11px] readable-font text-[#6b5d45]`}>{entry.note}</p>
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
            </>
          )}

        </div>
      </div>
    </div>
  );
}

function CompletionModal({
  quest,
  onClose,
  onSubmit,
}: {
  quest: Quest;
  onClose: () => void;
  onSubmit: (entry: Partial<QuestCompletionEntry>) => void;
}) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const points = pointsForQuest(quest);
  const canSubmit = imageUrls.length > 0;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImageUrls((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      rating,
      note: notes.trim(),
      imageUrls,
      points,
      completedAt: new Date().toISOString(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-1100 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-[#f5ecd9] text-[#4a3f2f] shadow-2xl readable-font"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#4a3f2f]/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Log completion
            </p>
            <h2 className="truncate text-base font-bold text-[#4a3f2f]">{quest.title}</h2>
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
              {imageUrls.map((photo, i) => (
                <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-[#4a3f2f]/10">
                  <img src={photo} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
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
            {imageUrls.length === 0 && (
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
            type="submit"
            className="rounded-full bg-[#a1602a] px-5 py-2 text-sm font-bold text-[#f5ecd9] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#4a3f2f]/15 disabled:text-[#4a3f2f]/40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function NewQuestModal({ onClose, picker, setPicker } : { onClose: Function, picker: any, setPicker: any }) {
  const [selectedCategory, setCategory] = useState<Category>(ALL_CATEGORIES[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [image, setImage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const [fields, setFields] = useState<{
    title: string;
    description: string;
    price: number;
    time: string;
  }>({
    title: "",
    description: "",
    price: 0,
    time: ""
  });

  const modifyField = (field: keyof typeof fields) => {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields(prev => ({
        ...prev,
        [field]: event.target.value
      }));
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    setImage(await toDataURL(files[0]));
  };

  const saveQuest = async () => {
    await submitQuestForApproval({
      title: fields.title,
      category: selectedCategory,
      latitude: picker.pickerLocation[0],
      longitude: picker.pickerLocation[1],
      time: fields.time,
      tags,
      image: image!,
      description: fields.description,
      price: fields.price
    });

    queryClient.invalidateQueries({ queryKey: ['quests'] })
  };

  return (
    <>
      <div className="px-4 py-4">
        <div className="flex items-center justify-between border-b border-[#4a3f2f]/10 mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl">Submit a new quest!</h1>
          </div>
        </div>

        <form 
          onSubmit={(event) => {
            event.preventDefault();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label className="block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Choose an image
            </label>
            <div className="relative h-16 w-16 rounded-lg border border-dashed border-[#4a3f2f]/25 text-[#4a3f2f]/50 hover:border-[#a1602a] hover:text-[#a1602a]">
              <input 
                type="file"
                accept="image/*"
                className="text-transparent w-full h-full"
                onChange={(event) => handleFiles(event.currentTarget.files)}
              />
              <div className="pointer-events-none inset-0 absolute flex flex-col items-center justify-center gap-0.5">
                <span className="text-base leading-none">+</span>
                <span className="text-[10px] font-semibold">Add</span>
              </div>
            </div>
            <div className="h-full">
              {image && (
                <img src={image} className="h-24 rounded-sm" />
              )}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Quest Title
            </label>
            <input 
              type="text" 
              className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40"
              onChange={modifyField('title')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Price
            </label>
            <div className="pl-4 relative focus:outline-none focus-within:ring-2 focus-within:ring-[#a1602a]/40 rounded-lg border border-[#4a3f2f]/15 bg-white/40">
              <span className="absolute left-3 top-[50%] translate-y-[-50%] ">$</span>
              <input 
                type="number"
                placeholder="67"
                className="w-full resize-none px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none"
                onChange={modifyField('price')}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Approximate amount of time
            </label>
            <div className="pl-4 relative focus:outline-none focus-within:ring-2 focus-within:ring-[#a1602a]/40 rounded-lg border border-[#4a3f2f]/15 bg-white/40">
              <span className="absolute left-3 top-[50%] translate-y-[-50%] ">$</span>
              <input 
                type="text"
                className="w-full resize-none px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none"
                onChange={modifyField('time')}
              />
            </div>
          </div>
          <div>
            <label htmlFor="quest-description" className="mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Description
            </label>
            <textarea
              id="quest-description"
              rows={3}
              placeholder="Quest Description"
              className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40"
              onChange={modifyField('description')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Category
            </label>
            <select 
              className={`rounded-md  flex w-full items-center gap-2 px-3 py-2 text-left text-sm readable-font transition ${selectedCategory && CATEGORY_BADGE_STYLES[selectedCategory]}`}
              onChange={(event) => {
                const category = ALL_CATEGORIES[parseInt(event.target.value)];
                
                setPicker((prev: any) => ({
                  ...prev,
                  pickerIcon: category
                }));
                setCategory(category)
              }}
              defaultValue={0}
            >
              {ALL_CATEGORIES.map((category, idx) => (
                <option key={idx} value={idx}>
                  {CATEGORY_ICONS[category]} {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Tags
            </label>
            <input 
              type="text" 
              className="mb-1.5 w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40"
              onKeyDown={(event) => {
                if (event.key == "Enter") {
                  const value = event.currentTarget.value.trim();

                  if (value) {
                    setTags(prev => [...prev, value]);
                    event.currentTarget.value = '';
                  }

                  event.preventDefault();
                }
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, idx) => 
                <button
                  onClick={() => {
                    setTags(prev => [...prev].filter((_, i) => i != idx))
                  }}
                  key={idx}
                  className="border-[#4a3f2f]/15 group bg-transparent text-[#6b5d45] hover:border-[#4a3f2f]/30 rounded-full border px-2.5 py-1 text-sm readable-font font-medium transition"
                >
                  #{tag}&nbsp;
                  <span className="hidden group-hover:inline-block">&times;</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <button
          className="text-sm readable-font font-semibold text-[#a1602a] hover:underline"
          onClick={() => onClose()}
        >
          Cancel
        </button>
        <button
          type="submit"
          onClick={() => {
            saveQuest().then(() => onClose());
          }}
          className="cursor-pointer rounded-full bg-[#a1602a] px-5 py-2 text-sm font-bold text-[#f5ecd9] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#4a3f2f]/15 disabled:text-[#4a3f2f]/40"
        >
          Save
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sidebar — styled like a trailhead signpost / park field guide
// ---------------------------------------------------------------------------

type Suggestion =
  | { type: 'quest'; label: string; quest: Quest }
  | { type: 'tag'; label: string };

function getSuggestions(query: string, quests: any): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const QuestMatches: Suggestion[] = quests
    .filter((s: any) =>
      s.title.toLowerCase().includes(q)
    )
    .slice(0, 4)
    .map((s: any) => ({ type: 'quest', label: s.title, quest: s }));

  const seenTags = new Set<string>();
  const tagMatches: Suggestion[] = [];
  for (const quest of quests) {
    for (const tag of quest.tags) {
      if (tag.includes(q) && !seenTags.has(tag)) {
        seenTags.add(tag);
        tagMatches.push({ type: 'tag', label: tag });
      }
    }
  }

  return [...QuestMatches, ...tagMatches].slice(0, 6);
}

function Filters({ 
  quests,
  filteredQuests,
  query,
  onQueryChange,
  onSelectTag,
  activeCategories,
  availableTags,
  activeTags,
  onSelectQuest,
  onToggleCategory,
  onToggleTag,
  statusFilter,
  setStatusFilter
} : {
  quests: Quest[];
  filteredQuests: Quest[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelectQuest: (quest: Quest) => void;
  onSelectTag: (tag: string) => void;
  activeCategories: Set<Category>;
  onToggleCategory: (category: Category) => void;
  availableTags: string[];
  activeTags: Set<string>;
  onToggleTag: (tag: string) => void;
  statusFilter: string[];
  setStatusFilter: Dispatch<SetStateAction<string[]>>;
}) {
  const { isAdmin } = useAuth();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const suggestions = useMemo(() => getSuggestions(query, filteredQuests), [query]);

  const handleSuggestionPick = (s: Suggestion) => {
    if (s.type === 'quest') {
      onQueryChange(s.label);
      onSelectQuest(s.quest);
    } else {
      onQueryChange('');
      onSelectTag(s.label);
    }
    setShowSuggestions(false);
  };

  return (
    <>
      {/* Scrollable filter content */}
      <div className="flex-1 space-y-5 px-4 py-4">
        {/* Search with autocomplete */}
        <div className="relative">
          <label className={`mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50`}>
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
              className={`w-full bg-transparent text-base readable-font text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none`}
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
                    {s.type === 'quest' ? (
                      <>
                        <span>{CATEGORY_ICONS[s.quest.category]}</span>
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

        {/* Some of the worst code ive ever written */}
        {isAdmin && (
          <div>
            <span className="mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
              Status Filters (Admin-only)
            </span>
            <div className="space-y-1.5">
              {[["Approved", "bg-[#3f7a4e]"], ["Pending", "bg-[#c9a13b]"], ["Rejected", "bg-[#c1573a]"]].map((status) => {
                const active = statusFilter.includes(status[0].toLowerCase());
                
                return (
                  <button
                    key={status[0]}
                    onClick={() => setStatusFilter(
                      prev => 
                        !active ? [...prev, status[0].toLowerCase()] : 
                        prev.length == 1 ? prev :
                        prev.filter(value => value != status[0].toLowerCase())
                    )}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base readable-font font-semibold transition 
                    ${!active ?  "bg-[#4a3f2f]/5 text-[#4a3f2f]/40" : `${status[1]} text-[#f5ecd9]`}`}
                  >
                    <span>{status[0]}</span>
                    <span className="text-sm opacity-70">{quests.filter(quest => quest.status == status[0].toLowerCase()).length}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Categories */}
        <div>
          <span className="mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
            Categories
          </span>
          <div className="space-y-1.5">
            {ALL_CATEGORIES.map((category) => {
              const active = activeCategories.has(category);
              const count = quests.filter((s: any) => s.category === category).length;
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
          <span className="mb-1.5 block text-xs readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
            Tags
          </span>
          {availableTags.length === 0 ? (
            <p className="text-sm readable-font text-[#6b5d45]">No tags for the categories selected.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag: any) => {
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
    </>
  )
}

function Sidebar({
  quests,
  filteredQuests,
  open,
  onClose,
  query,
  onQueryChange,
  onSelectQuest,
  onSelectTag,
  activeCategories,
  onToggleCategory,
  availableTags,
  activeTags,
  onToggleTag,
  resultCount,
  onClearAll,
  picker,
  setPicker,
  statusFilter,
  setStatusFilter
}: {
  quests: Quest[],
  filteredQuests: Quest[];
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  onSelectQuest: (quest: Quest) => void;
  onSelectTag: (tag: string) => void;
  activeCategories: Set<Category>;
  onToggleCategory: (category: Category) => void;
  availableTags: string[];
  activeTags: Set<string>;
  onToggleTag: (tag: string) => void;
  resultCount: number;
  onClearAll: () => void;
  picker: any;
  setPicker: any;
  statusFilter: string[],
  setStatusFilter: Dispatch<SetStateAction<string[]>>
}) {
  const [isNewQuestOpen, setNewQuestOpen] = useState(false);
  
  const activeFilterCount = 
    (ALL_CATEGORIES.length - activeCategories.size) + 
    activeTags.size + 
    (query.trim() ? 1 : 0) + 
    (statusFilter.length != 1 ? 1 : statusFilter[0] != "approved" ? 1 : 0);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div onClick={onClose} className="fixed inset-0 z-550 bg-black/30 sm:hidden" />
      )}

      <aside
        className={`overflow-y-scroll fixed inset-y-0 left-0 z-600 flex w-[85%] max-w-xs transform flex-col bg-[#f5ecd9] shadow-2xl transition-transform duration-300 ease-out sm:static sm:w-80 sm:max-w-none sm:translate-x-0 sm:shadow-none ${
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
                  quest on the page where the hand-drawn voice is the point. */}
              <h1 className="text-2xl font-extrabold leading-tight text-[#4a3f2f] mb-1">
                DillyDally
              </h1>
              <p className="text-sm font-medium tracking-wide text-[#8b5e34]">
                Find your next quest sidequest :)
              </p>
            </div>
          </div>
        </div>

        {!isNewQuestOpen && (
          <div className="flex shrink-0 items-center justify-between px-4 py-3">
            <button
                className="text-sm readable-font font-semibold text-[#a1602a] hover:underline"
                onClick={() => {
                  setNewQuestOpen(true);
                  setPicker((prev: any) => ({
                    ...prev,
                    isPlacing: true
                  }))
                }}
              >
              Submit your quest ideas!
            </button>
          </div>
        )}

        {isNewQuestOpen ? (
          <NewQuestModal 
            onClose={() => {
              setNewQuestOpen(false);
              setPicker((prev: any) => ({
                ...prev,
                isPlacing: false
              }));
            }} 
            picker={picker}
            setPicker={setPicker}
          />
        ) : (
          <Filters 
            quests={quests}
            filteredQuests={filteredQuests}
            query={query}
            onQueryChange={onQueryChange}
            onSelectTag={onSelectTag}
            activeCategories={activeCategories}
            availableTags={availableTags}
            activeTags={activeTags}
            onSelectQuest={onSelectQuest}
            onToggleCategory={onToggleCategory}
            onToggleTag={onToggleTag}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        )}

        {/* Footer */}
        <div className="flex shrink-0 justify-self-end self-stretch items-center justify-between border-t border-[#4a3f2f]/10 bg-[#4a3f2f]/5 px-4 py-3">
          <span className={`text-sm readable-font font-medium text-[#6b5d45]`}>
            {resultCount} quest{resultCount === 1 ? '' : 's'}
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={onClearAll}
              className="text-sm readable-font font-semibold text-[#a1602a] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </aside>
    </>
  );
}


function PlaceableMarker({ position, setPosition, icon } : { position: any, setPosition: Function, icon: any }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={icon}>
    </Marker>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

async function fetchResourceAsSet(resource: string){
  const { data, error } = await supabase
      .from(resource)
      .select('*');

    if (data) {
      return new Set(data.map(row => row.quest_id));
    } else {
      return new Set();
    }
}

export default function DillyDallyPage() {
  const { user, isAuthenticated, isUserLoaded } = useAuth(); 
  const { profile } = useProfile();

  const router = useRouter();

  const queryClient = useQueryClient();

  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => fetchResourceAsSet('favorites'),
    enabled: isUserLoaded && isAuthenticated
  });

  const { mutate: toggleFavorite } = useMutation({
    mutationFn: async (questId: string) => {
      if (!user || !favorites) return;
      
      if (favorites.has(questId)) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('quest_id', questId)
        } else {
          await supabase
            .from('favorites')
            .insert({
              quest_id: questId,
              user_id: user.id,
            });
        }
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    }
  });
  
  const { data: bookmarks } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => fetchResourceAsSet('bookmarks'),
    enabled: isUserLoaded && isAuthenticated
  });

  const { mutate: toggleBookmark } = useMutation({
    mutationFn: async (questId: string) => {
      if (!user || !bookmarks) return;
      
      if (bookmarks.has(questId)) {
        await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('quest_id', questId)
        } else {
        await supabase
          .from('bookmarks')
          .insert({
            quest_id: questId,
            user_id: user.id,
          });
      }
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    }
  })
  
  const { data: completions } = useQuery({
    queryKey: ['completions'],
    async queryFn() {
      const { data, error } = await supabase
        .from('completed')
        .select('*');
      
      if (error) throw error;

      return Object.groupBy(data ?? [], (row) => row.quest_id) as CompletionMap;
    },
    retry: false,
    enabled: isUserLoaded && isAuthenticated
  });

  const { mutate: addCompletion } = useMutation({
    mutationFn: async (variables: [string, Partial<QuestCompletionEntry>]) => {
      if (!user) return;

      const questId = variables[0];
      const entry = variables[1];
      
      return updateCompletions(user.id, questId, entry);
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['completions'] });
    }
  });

  let { data: quests, isPending } = useQuery({
    queryKey: ['quests'],
    queryFn: getSideQuests,
    initialData: []
  });

  const { mutate: updateQuestStatus } = useMutation({
    async mutationFn(variables: string[]) {
      const questId = variables[0];
      const status = variables[1];

      await supabase
        .from('quests')
        .update({
          status
        })
        .eq('id', questId);
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ['quests'] })
    }
  })

  const [completingQuest, setCompletingQuest] = useState<Quest | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [icons, setIcons] = useState<Record<Category, any> | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set(ALL_CATEGORIES));

  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const [{ isPlacing, pickerLocation, icon: pickerIcon }, setPicker] = useState<{ 
    isPlacing: boolean, 
    pickerLocation: [number, number],
    icon: Category
  }>({
    isPlacing: false,
    pickerLocation: UTSG_COORDS,
    icon: ALL_CATEGORIES[0]
  });

  const [statusFilters, setStatusFilters] = useState(['approved']);
  
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

  useEffect(() => {
    const handler = (event: any) => {
      try {
        const questId = event?.detail?.questId;
        if (!questId) return;

        const found = quests.find((quest) => quest.id === questId);
        if (found) setSelectedQuest(found);

      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('open-quest', handler as EventListener);
    return () => window.removeEventListener('open-quest', handler as EventListener);
  }, [quests]);

  function matchesQuery(quest: Quest, query: string): boolean {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      quest.title.toLowerCase().includes(q) ||
      quest.description.toLowerCase().includes(q) ||
      quest.category.toLowerCase().includes(q) ||
      quest.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  const availableTags = useMemo(() => {
      const tagSet = new Set<string>();
      const activeQuests = quests
        .filter(q => activeCategories.has(q.category))
        .filter(q => statusFilters.includes(q.status));
      
      activeQuests.forEach(quest => quest.tags.forEach(tag => tagSet.add(tag)));

      return Array.from(tagSet).sort();
    }, [activeCategories, quests, statusFilters]);

  const filteredQuests = useMemo(() => 
    quests.filter(
      (quest) =>
        activeCategories.has(quest.category) &&
        (activeTags.size === 0 || quest.tags.some((tag) => activeTags.has(tag))) &&
        matchesQuery(quest, query) &&
        statusFilters.includes(quest.status)
    ), [quests, query, activeCategories, activeTags, statusFilters]);

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
        filteredQuests.filter((s) => activeCategories.has(s.category) || s.category === category)
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
    setStatusFilters(['approved']);
  };

  return (
    <main className="relative flex h-screen w-screen bg-[#f0e6d2]">
      <Sidebar
        quests={quests}
        filteredQuests={filteredQuests}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        query={query}
        onQueryChange={setQuery}
        onSelectQuest={setSelectedQuest}
        onSelectTag={selectTagFromSearch}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        availableTags={availableTags}
        activeTags={activeTags}
        onToggleTag={toggleTag}
        resultCount={filteredQuests.length}
        onClearAll={clearAll}
        picker={{ isPlacing, pickerLocation, icon: pickerIcon }}
        setPicker={setPicker}
        statusFilter={statusFilters}
        setStatusFilter={setStatusFilters}
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
            filteredQuests.map((quest) => (
              <Marker key={quest.id} position={quest.position} icon={icons[quest.category as Category]}>
                <Popup>
                  <QuestCard
                    quest={quest}
                    onExpand={setSelectedQuest}
                    completedCount={(completions ? (completions[quest.id] ?? []) : []).length}
                    isBookmarked={bookmarks?.has(quest.id) ?? false}
                    onToggleBookmark={() => toggleBookmark(quest.id)}
                    updateQuestStatus={updateQuestStatus}
                  />
                </Popup>
                {isPlacing && (
                  <PlaceableMarker 
                    position={pickerLocation}
                    setPosition={(position: any) => setPicker(prev => ({
                      ...prev,
                      pickerLocation: position
                    }))}
                    icon={icons[pickerIcon]}
                  />
                )}
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

        <AccountPopup />

        {isPending && (
          <div className={`absolute right-4 top-16 z-500 rounded-full bg-[#f5ecd9] px-3 py-1.5 text-sm readable-font font-semibold text-[#6b5d45] shadow-md`}>
            Searching…
          </div>
        )}

        {!isPending && filteredQuests.length === 0 && (
          <div className="absolute bottom-6 left-1/2 z-500 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl bg-[#f5ecd9] p-4 text-center shadow-lg">
            <p className={`text-base readable-font font-semibold text-[#4a3f2f]`}>No sidequests match yet.</p>
            <p className={`mt-1 text-sm readable-font text-[#6b5d45]`}>
              Try clearing a tag or category filter.
            </p>
          </div>
        )}
      </div>

        {selectedQuest && (
          <ExpandedWidget
            quest={selectedQuest}
            entries={completions ? (completions[selectedQuest.id] ?? []) : []}
            isFavorited={favorites?.has(selectedQuest.id) ?? false}
            onToggleFavorite={() => toggleFavorite(selectedQuest.id)}
            isBookmarked={bookmarks?.has(selectedQuest.id) ?? false}
            onToggleBookmark={() => toggleBookmark(selectedQuest.id)}
            onLogCompletion={() => setCompletingQuest(selectedQuest)}
            onClose={() => setSelectedQuest(null)}
          />
        )}

        {completingQuest && (
          <CompletionModal
            quest={completingQuest}
            onClose={() => setCompletingQuest(null)}
            onSubmit={(entry) => addCompletion([completingQuest.id, entry])}
          />
        )}

        <ChatWidget />
    </main>
  );
}