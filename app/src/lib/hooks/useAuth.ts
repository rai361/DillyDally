"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import { User } from "@supabase/supabase-js";
import { isAdmin } from "../auth";
import { useQuery } from "@tanstack/react-query";
import { getFollowerStats } from "..";

interface UserState {
    user: User | null;
    isAdmin: boolean;
    // avatarUrl: string | null;
    fullName: string | null;
    displayName: string | null;
}

const NULL_USER_STATE = { 
    user: null,
    isAdmin: false,
    // avatarUrl: null,
    fullName: null,
    displayName: null
};

export default function useAuth() {
    const [userInfo, setUserInfo] = useState<UserState>(NULL_USER_STATE);

    const { data: profile } = useQuery({
        queryKey: ['profile'],
        async queryFn() {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', userInfo.user?.id)
                .single();

            if (error) throw error;

            return data;
        },
        enabled: !!userInfo.user,
        retry: false
    });

    const { data: followerStats } = useQuery({
        queryKey: ['follower_stats'],
        queryFn: () => getFollowerStats(userInfo.user!.id),
        retry: false,
        enabled: !!userInfo.user
    });
    
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && session.user) {
                const user = session.user;
                
                setUserInfo({
                    user,
                    isAdmin: isAdmin(user),
                    // avatarUrl: user.app_metadata?.avatar_url,
                    fullName: user.user_metadata?.full_name,
                    displayName: user.user_metadata?.full_name
                });
            } else {
                setUserInfo(NULL_USER_STATE);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    if (userInfo.user) {
        return { 
            user: userInfo.user, 
            profile: {
                ...userInfo,
                bio: profile?.bio,
                followers: followerStats?.followers ?? 0,
                following: followerStats?.following ?? 0,
                avatarUrl: profile?.avatar_url
            }
        };
    } else {
        return {
            user: null,
            profile: {
                ...userInfo,
                bio: null,
                followers: 0,
                following: 0
            }
        };
    }
}