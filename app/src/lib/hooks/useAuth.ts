"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import { User } from "@supabase/supabase-js";
import { isAdmin } from "../auth";

interface UserState {
    isAuthenticated: boolean,
    user: User | null,
    isAdmin: boolean
}

const NULL_USER_STATE: UserState = { 
    isAuthenticated: false,
    user: null,
    isAdmin: false
};

export default function useAuth() {
    const [userState, setUserState] = useState<UserState>(NULL_USER_STATE);
    
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && session.user) {
                const user = session.user;
                
                setUserState({
                    user,
                    isAdmin: isAdmin(user),
                    isAuthenticated: true,
                });
            } else {
                setUserState(NULL_USER_STATE);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return userState;
}