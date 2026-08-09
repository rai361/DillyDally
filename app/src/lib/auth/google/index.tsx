import { CredentialResponse, useGoogleOneTapLogin } from "@react-oauth/google";
import { supabase } from "../../supabase/client";

export async function handleGoogleCredential(response: CredentialResponse) {
    if (!response.credential) return;

    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
        // Future implementation of a nonce
        // nonce,
    });
    
    // TODO: handle this error somehow
    if (error) throw error;
}