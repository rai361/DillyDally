"use client";

import { handleGoogleCredential } from "@/lib/auth/google";
import { GoogleLogin } from "@react-oauth/google";

// Fragmented into it's own component because 
// it might be expanded in the future
export default function LoginWithGoogle() {
  return (
    <GoogleLogin
      onSuccess={handleGoogleCredential}
    />
  )
}