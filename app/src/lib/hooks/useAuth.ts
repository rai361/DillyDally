"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import { User } from "@supabase/supabase-js";
import { isAdmin } from "../auth";

interface UserState {
    isAuthenticated: boolean;
    user: User | null;
    isAdmin: boolean;
    isUserLoaded: boolean;
}

export default function useAuth() {
    const [userState, setUserState] = useState<UserState>({ 
        isAuthenticated: false,
        user: null,
        isAdmin: false,
        isUserLoaded: false
    });
    
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && session.user) {
                const user = session.user;
                
                setUserState({
                    user,
                    isAdmin: isAdmin(user),
                    isAuthenticated: true,
                    isUserLoaded: true
                });
            } else {
                setUserState({ 
                    isAuthenticated: false,
                    user: null,
                    isAdmin: false,
                    isUserLoaded: true
                });
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return userState;
}