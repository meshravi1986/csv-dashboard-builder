"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function FadeInSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function ChartMockup({ type, className = "" }: { type: "bar" | "line" | "kpi" | "pie"; className?: string }) {
  if (type === "kpi") {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${className}`}>
        <div className="text-xs text-slate-400 font-medium mb-1">Total Revenue</div>
        <div className="text-2xl font-bold text-slate-900">$1,284,500</div>
        <div className="flex items-center gap-1 mt-1">
          <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          <span className="text-xs text-emerald-600 font-medium">+12.5%</span>
          <span className="text-xs text-slate-400">vs last month</span>
        </div>
      </div>
    );
  }

  if (type === "bar") {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${className}`}>
        <div className="text-xs text-slate-400 font-medium mb-3">Revenue by Region</div>
        <div className="flex items-end gap-2 h-24">
          {[70, 45, 90, 55, 80, 60].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-gradient-to-t from-slate-900 to-slate-600 transition-all hover:opacity-80" style={{ height: `${h}%` }} />
              <span className="text-[10px] text-slate-400">R{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "line") {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${className}`}>
        <div className="text-xs text-slate-400 font-medium mb-3">Sales Trend</div>
        <svg viewBox="0 0 200 60" className="w-full h-16">
          <path d="M0 50 Q20 45 40 35 T80 30 T120 20 T160 25 T200 10" fill="none" stroke="#0f172a" strokeWidth="2" />
          <path d="M0 50 Q20 45 40 35 T80 30 T120 20 T160 25 T200 10 L200 60 L0 60 Z" fill="url(#lineGrad)" opacity="0.15" />
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${className}`}>
      <div className="text-xs text-slate-400 font-medium mb-3">Market Share</div>
      <div className="flex items-center justify-center h-24 gap-1">
        {[35, 25, 20, 12, 8].map((pct, i) => {
          const colors = ["bg-slate-900", "bg-slate-600", "bg-slate-400", "bg-slate-300", "bg-slate-200"];
          const angle = (pct / 100) * 360;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`w-4 rounded-full ${colors[i]}`} style={{ height: `${pct * 1.5}px` }} />
              <span className="text-[10px] text-slate-400">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NavBar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-slate-900">CSV Dashboard Builder</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/login")} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign In
            </button>
            <button onClick={() => router.push("/login")} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  const router = useRouter();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-slate-900/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-slate-900/5 blur-3xl" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <FadeInSection delay={100}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-sm text-slate-600 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            AI-Powered Dashboard Builder
          </div>
        </FadeInSection>
        <FadeInSection delay={200}>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-tight">
            Upload CSV.
            <br />
            <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 bg-clip-text text-transparent">
              Get Executive Dashboards.
            </span>
          </h1>
        </FadeInSection>
        <FadeInSection delay={300}>
          <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Turn raw CSV data into polished, interactive dashboards in minutes.
            <span className="text-slate-700 font-medium"> AI suggests — you decide.</span>
          </p>
        </FadeInSection>
        <FadeInSection delay={400}>
          <div className="mt-10 flex items-center justify-center gap-4">
            <button onClick={() => router.push("/login")} className="px-8 py-3 bg-slate-900 text-white text-base font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]">
              Get Started Free
            </button>
            <button onClick={() => router.push("/login")} className="px-8 py-3 border border-slate-300 text-slate-700 text-base font-medium rounded-xl hover:bg-slate-50 transition-all active:scale-[0.98]">
              Sign In
            </button>
          </div>
        </FadeInSection>
        <FadeInSection delay={500}>
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <ChartMockup type="kpi" />
            <ChartMockup type="bar" />
            <ChartMockup type="line" />
            <ChartMockup type="pie" />
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}

function DifferentiationSection() {
  return (
    <section className="py-24 bg-white border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-sm text-slate-600 mb-6">
              Our Approach
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              AI-Powered, <span className="text-slate-500">Human-Controlled</span>
            </h2>
            <p className="mt-4 text-lg text-slate-500 leading-relaxed">
              Most AI analytics tools are a black box — you get charts but can't explain why. We take a different approach.
            </p>
          </div>
        </FadeInSection>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
          <FadeInSection delay={100}>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 mt-1">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">AI Suggests, You Decide</h3>
                  <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                    AI generates semantic field roles, metric formulas, and chart layouts. But nothing is final until you approve it. Every AI suggestion is presented for your review, giving you full control over the outcome.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 mt-1">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Deterministic Charts</h3>
                  <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                    Chart types are determined by field roles — dates + measures produce line charts, dimensions + measures produce bar charts, etc. AI never chooses chart types arbitrarily. What you see is based on rules, not randomness.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 mt-1">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Your Data Stays Private</h3>
                  <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                    AI only processes field metadata (column names, data types) — never your actual row data. All aggregations run locally via DuckDB. Your sensitive data never leaves your control.
                  </p>
                </div>
              </div>
            </div>
          </FadeInSection>
          <FadeInSection delay={200}>
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 lg:p-8">
              <div className="text-sm font-medium text-slate-900 mb-4">How AI + Determinism Works Together</div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">1</div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">Upload CSV</div>
                    <div className="text-xs text-slate-500 mt-0.5">Your raw data is analyzed for field types and distributions</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">2</div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">AI Suggests Semantics</div>
                    <div className="text-xs text-slate-500 mt-0.5">Column roles (dimension/measure/date) are suggested by AI — you confirm or override</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-500 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">3</div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">Rules Generate Charts</div>
                    <div className="text-xs text-slate-500 mt-0.5">Deterministic rules map field roles to chart types — same data always produces the same charts</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-400 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">4</div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">AI Enhances</div>
                    <div className="text-xs text-slate-500 mt-0.5">Titles, color schemes, and metric formulas get AI polish — but the chart structure stays deterministic</div>
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    { num: "01", title: "Upload Your CSV", desc: "Drag and drop any CSV file. We automatically profile your data — detecting field types, distributions, and patterns." },
    { num: "02", title: "Confirm Semantics", desc: "AI suggests field roles (dimensions, measures, dates). You review, adjust, and approve in one click." },
    { num: "03", title: "Define Your Metrics", desc: "Create metrics with simple formulas, custom aggregations, or natural language with AI-generated SQL previews." },
    { num: "04", title: "Get Your Dashboard", desc: "A polished executive dashboard is generated instantly. Reorder charts, apply filters, tweak colors — no coding required." },
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-600 mb-6">
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              From CSV to Dashboard in 4 Steps
            </h2>
          </div>
        </FadeInSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <FadeInSection key={step.num} delay={i * 100}>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 h-full hover:shadow-lg hover:border-slate-300 transition-all duration-300 group">
                <div className="text-3xl font-bold text-slate-200 group-hover:text-slate-900 transition-colors duration-300">{step.num}</div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    title: "Smart CSV Profiling",
    desc: "Automatic column detection, data type inference, null analysis, and distribution stats — no manual schema setup.",
    icon: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0",
  },
  {
    title: "AI Semantic Suggestions",
    desc: "Column roles (dimension/measure/date) suggested by AI based on column names and data patterns. Review and confirm in one click.",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  {
    title: "Multi-Mode Metrics",
    desc: "Simple aggregations, custom formulas with per-field operators, or natural language AI metric generation with live SQL preview.",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  },
  {
    title: "Drag-and-Drop Reordering",
    desc: "KPI cards, full-width charts, and half-width charts in independent sortable groups. Reorder intuitively with drag handles.",
    icon: "M4 6h16M4 10h16M4 14h16M4 18h16",
  },
  {
    title: "Global Filtering",
    desc: "Add dimension or date filters that apply to all charts simultaneously. Presets for common date ranges. Clears without server re-fetch.",
    icon: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
  },
  {
    title: "Dashboard Versioning",
    desc: "Refresh data without rebuilding: upload a new CSV with matching columns to create a new version. Layout, metrics, and chart types are preserved.",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  },
  {
    title: "Color Palette Customization",
    desc: "Six built-in color schemes (Slate, Ocean, Forest, Sunset, Violet, Rainbow). Switch instantly, persisted in localStorage.",
    icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
  },
  {
    title: "Reusable Metrics Library",
    desc: "Define a metric once and reuse it across any dataset that has the required fields. Build a library of business KPIs over time.",
    icon: "M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M3 10v11M21 10v11",
  },
];

function FeaturesSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-sm text-slate-600 mb-6">
              Features
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Everything You Need for Data Storytelling
            </h2>
          </div>
        </FadeInSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feat, i) => (
            <FadeInSection key={feat.title} delay={i * 50}>
              <div className="group p-6 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 hover:shadow-md transition-all duration-300 h-full">
                <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-slate-900 flex items-center justify-center transition-colors duration-300">
                  <svg className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feat.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">{feat.title}</h3>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{feat.desc}</p>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function SampleDashboardsSection() {
  const dashboards = [
    { title: "Sales Executive Dashboard", charts: ["Total Revenue (KPI)", "Revenue by Region (Bar)", "Sales Trend (Line)", "Top Products (Bar)"] },
    { title: "Marketing Performance", charts: ["Campaign ROI (KPI)", "Channel Performance (Bar)", "Conversion Rate (Line)", "Audience Segments (Pie)"] },
    { title: "Financial Overview", charts: ["Net Income (KPI)", "Revenue vs Expenses (Bar)", "Cash Flow (Line)", "Expense Breakdown (Pie)"] },
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-600 mb-6">
              Sample Dashboards
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Polished Dashboards in Minutes
            </h2>
            <p className="mt-4 text-lg text-slate-500">Here's what you can expect from your uploaded data</p>
          </div>
        </FadeInSection>

        <div className="grid md:grid-cols-3 gap-6">
          {dashboards.map((db, i) => (
            <FadeInSection key={db.title} delay={i * 150}>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-300 group">
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ChartMockup type="kpi" className="!p-3" />
                    <ChartMockup type="bar" className="!p-3" />
                    <div className="col-span-2">
                      <ChartMockup type="line" className="!p-3" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {db.charts.map((c) => (
                      <span key={c} className="px-2 py-0.5 bg-slate-100 text-[10px] text-slate-500 rounded-md">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="px-5 pb-4">
                  <h3 className="text-sm font-semibold text-slate-900">{db.title}</h3>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const router = useRouter();
  return (
    <section className="py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <FadeInSection>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Ready to Turn Your Data Into Dashboards?
          </h2>
          <p className="mt-4 text-lg text-slate-300 max-w-2xl mx-auto">
            No sign-up hassle. Just upload your CSV and get a polished executive dashboard in minutes.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <button onClick={() => router.push("/login")} className="px-8 py-3 bg-white text-slate-900 text-base font-medium rounded-xl hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]">
              Get Started Free
            </button>
            <button onClick={() => router.push("/login")} className="px-8 py-3 border border-slate-500 text-slate-300 text-base font-medium rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98]">
              Sign In
            </button>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm text-slate-400 font-medium">CSV Dashboard Builder</span>
          </div>
          <p className="text-xs text-slate-600">
            Built with Next.js, FastAPI, DuckDB, and Supabase
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboards");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <HeroSection />
      <DifferentiationSection />
      <HowItWorksSection />
      <FeaturesSection />
      <SampleDashboardsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
