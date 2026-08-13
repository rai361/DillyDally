"use client";

import { useGoogleOneTapLogin } from "@react-oauth/google";
import { handleGoogleCredential } from "../auth/google";

export default function GoogleOneTap() {
    useGoogleOneTapLogin({
        onSuccess: handleGoogleCredential,
        // disabled: false,
        auto_select: false,
        // This sounds important!
        use_fedcm_for_prompt: true,
    });

    return null;
}