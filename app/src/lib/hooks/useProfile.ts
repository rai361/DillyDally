"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAuth from "./useAuth";
import { supabase } from "../supabase/client";
import { getFollowerStats, getUserProfile, updateUserAvatar } from "../functions";
import { useEffect } from "react";

export default function useProfile() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: profile, isPending } = useQuery({
        queryKey: ['profile'],
        queryFn: getUserProfile,
        enabled: !!user,
        retry: false
    });

    const { data: followerStats } = useQuery({
        queryKey: ['follower_stats'],
        queryFn: () => getFollowerStats(user!.id),
        retry: false,
        enabled: !!user
    });

    const updateProfile = async (profile: any) => {
        if (!user) return;
    
        const { data: userData, error: updateError } = await supabase
            .from('users')
            .upsert(profile)
            .eq('user_id', user?.id);
    
        if (updateError) throw updateError;
    
        return userData;
    }

    const { mutate: setName } = useMutation({
        mutationFn: (name: string) => updateProfile({ user_id: user?.id, display_name: name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        }
    });

    const { mutate: setBio } = useMutation({
        mutationFn: (bio: string) => updateProfile({ user_id: user?.id, bio }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        }
    });
    
    const { mutate: setAvatar } = useMutation({
        // mutationFn: async (file: File) => {
        //     if (!user) return;

        //     return updateUserAvatar(user.id, file);
        // },
        mutationFn: async (image: string) => {
            if (!user) return;

            const { data, error } = await supabase
                .from('users')
                .upsert({ user_id: user?.id, avatar_url: image })
                .eq('user_id', user.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        }
    });

    useEffect(() => {
        if (!user) return;

        if (isPending) return;

        if (!profile) {
            supabase
                .from("users")
                .insert({ user_id: user.id })
                .then(() => {
                    queryClient.invalidateQueries({ queryKey: ['profile'] });
                });
        }
    }, [profile, user, isPending]);

    return {
        profile: user && {
            bio: profile?.bio,
            followers: followerStats?.followers ?? 0,
            following: followerStats?.following ?? 0,
            avatarUrl: profile?.avatar_url,
            displayName: profile?.display_name ?? user.user_metadata?.displayName ?? user.user_metadata?.full_name
        },
        setAvatar,
        setName,
        setBio
    };
}