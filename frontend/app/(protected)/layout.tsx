"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/types";
import { NavBar } from "@/components/layout/nav-bar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser({
        id: session.user.id,
        email: session.user.email!,
        name: session.user.user_metadata.full_name || session.user.email!,
        avatar_url: session.user.user_metadata.avatar_url,
      });
      setLoading(false);
    };
    getUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  const steps = [
    { path: "/upload", label: "Upload", number: 1 },
    { path: "/profile", label: "Profile", number: 2 },
    { path: "/semantic", label: "Semantics", number: 3 },
    { path: "/metrics", label: "Metrics", number: 4 },
    { path: "/dashboard", label: "Dashboard", number: 5 },
  ];

  const currentStepIndex = steps.findIndex((s) =>
    pathname.startsWith(s.path)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar user={user} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.path} className="flex items-center">
                <div
                  className={`flex items-center gap-2 ${
                    index <= currentStepIndex
                      ? "text-slate-900"
                      : "text-slate-300"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index < currentStepIndex
                        ? "bg-slate-900 text-white"
                        : index === currentStepIndex
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {step.number}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 sm:w-20 h-px mx-2 ${
                      index < currentStepIndex
                        ? "bg-slate-900"
                        : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
