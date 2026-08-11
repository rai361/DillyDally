"use client";

import { useGoogleOneTapLogin } from "@react-oauth/google";
import { handleGoogleCredential } from "@/lib/auth/google";
import useAuth from "@/lib/hooks/useAuth";

export default function GoogleOneTap() {
    const { user } = useAuth();

    useGoogleOneTapLogin({
        onSuccess: handleGoogleCredential,
        // disabled: false,
        auto_select: false,
        // This sounds important!
        use_fedcm_for_prompt: true,
        disabled: !!user
    });

    return null;
}