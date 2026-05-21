"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/types";

interface NavBarProps {
  user: AuthUser;
}

export function NavBar({ user }: NavBarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => router.push("/dashboards")}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="font-semibold text-slate-900">
              CSV Dashboard Builder
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboards")}
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Dashboards
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{user.name}</span>
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              )}
              <button
                onClick={handleLogout}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
