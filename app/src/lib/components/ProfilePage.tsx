"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { toDataURL } from "../utils";
import Link from "next/link";
import { Category, GalleryImage, Quest, UserProfile } from "../types";
import { HypeIndicator } from "./Indicators";
import { User } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import { getFollowerStats, getPinnedImages } from "../functions";
import SectionEyebrow from "./SectionEyebrow";
import useAuth from "../hooks/useAuth";

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

function FollowButton({ following, toggleFollowing } : any) {
  return (
    <button
      onClick={toggleFollowing}
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

export default function ProfilePage({ profileData, userId } : { profileData: any, userId: string }) {
    const { user, isAuthenticated, isUserLoaded } = useAuth();

    const queryClient = useQueryClient();

    const { data: followerStats } = useQuery({
        queryKey: ['follower_stats'],
        queryFn: async () => {
            return await getFollowerStats(userId);
        },
        retry: false,
    });

    const { data: bookmarkedQuests, isPending } = useQuery({
        queryKey: ['favorites'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('favorites')
                .select('*, side_quests(*)')
                .eq('user_id', userId);

            return data;
        },
        retry: false,
        initialData: []
      });

    const { data: pinnedPhotos, isPending: isPhotosPending } = useQuery({
        queryKey: ['pinned_photos'],
        async queryFn() {
            const { data } = await supabase
            .from('gallery')
            .select('*')
            .eq('pinned', true)
            .eq('user_id', userId);
        
            return data;
        },
        retry: false,
        initialData: []
    });

    const { data: points } = useQuery({
        queryKey: ['points'],
        queryFn: async () => {
        
        const { data, error } = await supabase
            .from('scoreboard')
            .select('*')
            .eq('user_id', userId)
        
        if (error) throw error;

        if (!data || data.length == 0) return 0;

        return data[0]?.points ?? 0;
        },
        retry: false,
        enabled: true
    });

    const { data: isFollowing } = useQuery({
        queryKey: ['follower'],
        queryFn: async () => {
            if (!user) return false;

            const { data, error } = await supabase
                .from('followers')
                .select('*')
                .eq('follower_id', user.id)
                .eq('user_id', userId);

            return data && data.length >= 1;
        },
        enabled: isAuthenticated && isUserLoaded,
        initialData: false
    });

    const { mutate: toggleFollowing } = useMutation({
        async mutationFn() {
            if (isFollowing) {
                await supabase.rpc('unfollow_user', { p_user_id: userId });
            } else {
                await supabase.rpc('follow_user', { p_user_id: userId });
            }

            return true;
        },
        async onSuccess() {
            await queryClient.invalidateQueries({ 
                queryKey: ['follower_stats'],
            });

            await queryClient.invalidateQueries({ 
                queryKey: ['follower'],
            });
        }
    });
    
    return (
    <main className="min-h-screen w-screen bg-[#f0e6d2] text-[#4a3f2f]">
        <Link
        href="/"
        className="fixed left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-[#f5ecd9] px-3 py-2 text-xs font-semibold text-[#4a3f2f] shadow-lg hover:brightness-95"
        >
        ← Back to map
        </Link>
        
        <div className="relative mx-auto flex max-w-xl flex-col items-center px-6 pb-16 pt-20">

        <img
            src={profileData.avatar_url}
            className="h-24 w-24 rounded-full border-4 border-[#f5ecd9] object-cover shadow-lg"
        />
        <h1 className="mt-4 text-2xl font-extrabold leading-tight text-[#4a3f2f]">
            {profileData.displayName}
        </h1>
        <h1 className="mt-4 text-xl font-extrabold leading-tight text-[#4a3f2f]">
            @{profileData.handle}
        </h1>
        <h1 className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[#6b5d45]">
            {profileData.bio}
        </h1>

        <FollowButton following={isFollowing} toggleFollowing={toggleFollowing} />

        <div className="mt-5 flex items-center divide-x divide-[#4a3f2f]/10 rounded-full bg-[#f5ecd9] py-3 shadow-md">
            <StatBlock value={points} label="Points" accent />
            <StatBlock value={followerStats?.followers ?? 0} label="Ducklings" />
            <StatBlock value={followerStats?.following ?? 0} label="Admiring" />
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
            {!isPending && (bookmarkedQuests?.map((bookmark: any) => (
                <FavoriteQuestCard key={bookmark.id} quest={bookmark.side_quests} />
            )))}
            </div>
        </div>
        </div>
    </main>
    );
}