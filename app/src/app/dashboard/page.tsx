'use client';

import { getFavoritedQuests, getPinnedImages } from '@/lib/functions';
import { HypeIndicator } from '@/lib/components/Indicators';
import SectionEyebrow from '@/lib/components/SectionEyebrow';
import useAuth from '@/lib/hooks/useAuth';
import useProfile from '@/lib/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Category, GalleryImage, Quest } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';
import { toDataURL } from '@/lib/utils';

interface CompletionEntry {
  id: string;
  rating: number;
  notes: string;
  photos: string[];
  points: number;
  completedAt: string;
}

type CompletionMap = Record<string, CompletionEntry[]>;

function totalPointsFrom(map: CompletionMap): number {
  return Object.values(map).reduce(
    (sum, entries) => sum + entries.reduce((s, e) => s + e.points, 0),
    0
  );
}

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

function PhotoCarousel({ photos }: { photos: GalleryImage[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-1 py-3 scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, idx) => (
          <figure
            key={photo.id}
            className={`w-40 shrink-0 snap-start rounded-sm bg-[#f5ecd9] p-2 pb-4 shadow-lg transition hover:-translate-y-1 hover:shadow-xl ${idx % 2 ? 'rotate-2' : '-rotate-1'}`}
          >
            <img
              src={photo.imageUrl}
              alt={photo.caption}
              className="h-36 w-full rounded-xs object-cover"
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

function FavoriteQuestCard({ quest }: { quest: Quest }) {
  return (
    <Link
      href={`/?quest=${quest.id}`}
      className="flex items-center justify-between gap-3 rounded-lg bg-[#f5ecd9] px-4 py-3 shadow-md transition hover:brightness-95"
    >
      <div className="min-w-0">
        <span
          className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_BADGE_STYLES[quest.category]}`}
        >
          {CATEGORY_ICONS[quest.category]} {quest.category}
        </span>
        <h3 className="truncate text-base font-bold text-[#4a3f2f]">{quest.title}</h3>
        <div className="mt-1 flex items-center gap-3">
          <HypeIndicator hype={quest.hype} />
          <span className="text-xs font-semibold text-[#3d6ea1]">⏱️ {quest.time}</span>
        </div>
      </div>
      <span className="shrink-0 text-xs font-medium text-[#a1602a]">Map →</span>
    </Link>
  );
}

function FollowButton() {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // TODO: AJSIASH
    setFollowing(true);
  }, []);

  const toggle = () => {
    setFollowing((prev) => {
      const next = !prev;
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

function AvatarUpload({ image, setImage } : { image: string, setImage: (image: string) => any }) {
  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    setImage(await toDataURL(files[0]));
  }
  
  return (
    <div className="flex flex-row justify-between gap-1.5 w-[50vw] h-[40vh] p-5 rounded-lg bg-[#f5ecd9]">
      <div className="flex flex-col">
        <label className="block text-lg readable-font font-semibold uppercase tracking-wide text-[#4a3f2f]/50">
          Choose an image
        </label>
        <div className="relative flex-1 aspect-square rounded-lg border border-dashed border-[#4a3f2f]/25 text-[#4a3f2f]/50 hover:border-[#a1602a] hover:text-[#a1602a]">
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
      </div>
      <div className="h-full">
        {image && (
          <img src={image} className="h-full rounded-full object-cover aspect-square border-4 border-[#f5ecd9]" />
        )}
      </div>
    </div>
  )
}

function Editing({ 
  displayName, 
  bio, 
  setName,
  setBio,
  setAvatar,
  onClose,
  avatarUrl
} : { 
  displayName: string, 
  avatarUrl: string,
  bio: string,
  setName: (value: string) => any,
  setBio: (value: string) => any,
  setAvatar: (url: string) => any,
  onClose: () => any
}) {
  const [fields, setFields] = useState<{ name: string, biography: string, image: string }>({
    name: displayName,
    biography: bio,
    image: avatarUrl
  });

  const modifyField = function<K extends keyof typeof fields>(field: K, value: typeof fields[K]) {
    setFields(prev => ({
      ...prev,
      [field]: value
    }));
  }

  const handleFieldUpdate = (field: keyof typeof fields) => {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields(prev => ({
        ...prev,
        [field]: event.target.value
      }));
    }
  }

  return (
    <>
      <button 
        // @ts-ignore
        commandfor="image-upload"
        command="show-modal"
        className="hover:brightness-60 cursor-pointer"
      >
        <img
          src={fields.image}
          className="h-24 w-24 rounded-full border-4 border-[#f5ecd9] object-cover shadow-lg"
        />
      </button>

      <dialog id="image-upload" closedby="any" className="absolute left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-transparent">
        <AvatarUpload image={fields.image} setImage={(image) => modifyField("image", image)} />
      </dialog>

      <div className="mt-6">
        <label>
          Display Name
        </label>
        <input 
          type="text" 
          defaultValue={displayName}
          onChange={handleFieldUpdate('name')}
          className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40"
        />
      </div>
      <div className="mt-6">
        <label>
          Bio
        </label>
        <textarea 
          rows={3}
          defaultValue={bio}
          onChange={handleFieldUpdate('biography')}
          className="w-full resize-none rounded-lg border border-[#4a3f2f]/15 bg-white/40 px-3 py-2 text-sm text-[#4a3f2f] placeholder:text-[#4a3f2f]/40 focus:outline-none focus:ring-2 focus:ring-[#a1602a]/40"
        />
      </div>

      <button
        type="submit"
        onClick={() => {
          setName(fields.name);
          setBio(fields.biography);
          setAvatar(fields.image);

          onClose();
        }}
        className="cursor-pointer rounded-full bg-[#a1602a] px-5 py-2 text-sm font-bold text-[#f5ecd9] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#4a3f2f]/15 disabled:text-[#4a3f2f]/40"
      >
        Save
      </button>
    </>
  )
}

export default function DashboardPage() {
  const { user, isAuthenticated, isUserLoaded } = useAuth();
  const { profile, setAvatar, setName, setBio } = useProfile();

  const [isEditing, setEditing] = useState(false);

  const { data: bookmarkedQuests, isPending } = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavoritedQuests,
    retry: false,
    enabled: isUserLoaded && isAuthenticated
  });

  const { data: pinnedPhotos, isPending: isPhotosPending } = useQuery({
    queryKey: ['pinned_photos'],
    queryFn: getPinnedImages,
    retry: false,
    enabled: isUserLoaded && isAuthenticated
  });

  const { data: points } = useQuery({
    queryKey: ['points'],
    queryFn: async () => {
      if (!user) return;
      
      const { data, error } = await supabase
      .from('scoreboard')
      .select('*')
      .eq('user_id', user.id)
      
      console.log('points scoreboard auhdusadsa', data, error);

      if (error) throw error;

      if (!data || data.length == 0) return 0;

      return data[0]?.points ?? 0;
    },
    retry: false,
    enabled: isUserLoaded && isAuthenticated
  });


  if (!isUserLoaded) {
    return (
      <div className="w-full flex flex-col flex-1 justify-center items-center">
        Loading!
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return (
      <div className="w-full flex flex-col flex-1 justify-center items-center">
        <div className="p-5 text-4xl flex flex-col justify-center items-center border-solid border-4 border-[#4a3f2f]/10 rounded-lg bg-[#f5ecd9] text-[#4a3f2f]">
          <p>Not Logged In</p>

          <p>Go to&nbsp;
            <a href="/login" className="underline cursor-pointer">
              /login
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-screen bg-[#f0e6d2] text-[#4a3f2f]">
      <Link
        href="/"
        className="fixed left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-[#f5ecd9] px-3 py-2 text-xs font-semibold text-[#4a3f2f] shadow-lg hover:brightness-95"
      >
        ← Back to map
      </Link>
      
      <div className="relative mx-auto flex max-w-xl flex-col items-center px-6 pb-16 pt-20">
        <button
          onClick={() => setEditing(prev => !prev)}
          className="cursor-pointer absolute right-6 top-20 z-10 flex items-center gap-1.5 rounded-full bg-[#f5ecd9] px-3 py-2 text-md font-semibold text-[#4a3f2f] shadow-lg hover:brightness-95"
        >
          {isEditing ? "Stop Editing" : "Edit"} Profile
        </button>
        

        {isEditing ? (
          <Editing 
            avatarUrl={profile.avatarUrl}
            displayName={profile.displayName}
            bio={profile.bio}
            setName={setName}
            setBio={setBio}
            // @ts-ignore
            setAvatar={setAvatar}
            onClose={() => {
              setEditing(false);  
            }}
            />
          ) : (
            <>
              <img
                src={profile.avatarUrl}
                className="h-24 w-24 rounded-full border-4 border-[#f5ecd9] object-cover shadow-lg"
              />
              <h1 className="mt-4 text-2xl font-extrabold leading-tight text-[#4a3f2f]">
                {profile.displayName}
              </h1>
              <h1 className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[#6b5d45]">
                {profile.bio}
              </h1>
            </>
        )}

        {/* <FollowButton /> */}

        <div className="mt-5 flex items-center divide-x divide-[#4a3f2f]/10 rounded-full bg-[#f5ecd9] py-3 shadow-md">
          <StatBlock value={points} label="Points" accent />
          <StatBlock value={profile.followers} label="Ducklings" />
          <StatBlock value={profile.following} label="Admiring" />
        </div>

        {/* Pinned quest photos */}
        {!isPhotosPending && (
          <div className="mt-12 w-full gap-3">
            <SectionEyebrow icon="📌">Pinned from quests</SectionEyebrow>
            <PhotoCarousel photos={pinnedPhotos as GalleryImage[]} />
          </div>
        )}

        {/* Favorite sidequests */}
        <div className="mt-10 w-full">
          <SectionEyebrow icon="⭐">Favorite sidequests</SectionEyebrow>
          <div className="space-y-2.5 mt-3">
            {/* @ts-ignore */}
            {!isPending && (bookmarkedQuests?.map((bookmark: any) => (
              <FavoriteQuestCard key={bookmark.id} quest={bookmark.side_quests} />
            )))}
          </div>
        </div>
      </div>
    </main>
  );
}