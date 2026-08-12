"use client";

import Link from "next/link";
import useProfile from "../hooks/useProfile";

export function AccountPopup() {
  const { profile } = useProfile();

  return (
      <Link
        href="/dashboard"
        className="absolute right-4 top-4 z-500 flex items-center gap-2 rounded-full bg-[#f5ecd9] px-2.5 py-2 shadow-lg transition hover:brightness-95"
      >
        {/* @ts-ignore */}
        {profile?.avatarUrl ? (
            <img
              // @ts-ignore
              src={profile.avatarUrl}
              className="flex h-7 w-7 items-center justify-center rounded-full"
            />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#a1602a] text-sm readable-font font-bold text-[#f5ecd9]">
            U
          </span>
        )}
        <span className={`pr-1 text-sm readable-font font-semibold text-[#4a3f2f]`}>{profile?.displayName ?? "Account"}</span>
      </Link>
  )
}