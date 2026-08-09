"use client";

import { GoogleLogin } from "@react-oauth/google";
import { handleGoogleCredential } from "../auth/google";

// Fragmented into it's own component because 
// it might be expanded in the future
export default function LoginWithGoogle() {
  return (
    <GoogleLogin
      onSuccess={handleGoogleCredential}
    />
  )
}