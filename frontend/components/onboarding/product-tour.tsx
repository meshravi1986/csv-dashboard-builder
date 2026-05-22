"use client";

import { useState } from "react";

type VisualType = "upload" | "semantics" | "metrics" | "dashboard" | "filters";

interface Slide {
  title: string;
  paragraphs: string[];
  visual: VisualType;
}

const slides: Slide[] = [
  {
    title: "Welcome to CSV Dashboard Builder",
    paragraphs: [
      "Turn any CSV file into a polished executive dashboard in minutes — no coding required.",
      "Here's how the workflow works across 5 simple steps.",
    ],
    visual: "dashboard",
  },
  {
    title: "1. Upload Your Data",
    paragraphs: [
      "Click \"New Dashboard\" and select your CSV or spreadsheet file. The system ingests your data and converts it to an efficient Parquet format behind the scenes.",
      "After upload, you'll land on the Profile page where column names, data types, null counts, and distributions are auto-detected — giving you full visibility into your dataset quality.",
    ],
    visual: "upload",
  },
  {
    title: "2. Set Semantics",
    paragraphs: [
      "Next, head to the \"Edit Workspace\" page. Here each column appears as a card — click any field to toggle its role between Dimension, Measure, Date, or Identifier.",
      "AI pre-suggests roles for you. Accept them with one click or override. Once confirmed, your schema is locked and ready for metrics. This step defines how your data will be analyzed and charted.",
    ],
    visual: "semantics",
  },
  {
    title: "3. Define Metrics (KPIs)",
    paragraphs: [
      "On the Metrics page, create KPIs that power your charts. Pick a field + aggregation (SUM, AVG, COUNT) for a simple metric, or build custom formulas like SUM(Revenue) - SUM(Cost).",
      "Need help? Switch to the AI tab, describe what you need in plain English (e.g. \"profit margin percentage\"), and GPT generates the DuckDB SQL for you with a live preview.",
      "You can also reuse metrics from other datasets — just check compatibility and select what you need.",
    ],
    visual: "metrics",
  },
  {
    title: "4. Generate Your Dashboard",
    paragraphs: [
      "With metrics ready, click \"Generate Dashboard\". The engine auto-creates a polished layout: KPI cards at the top, line/bar/area charts below, and summary tables — all based on your data's semantic structure.",
      "After generation, you can drag-and-drop charts to reorder them, add new charts, or delete ones you don't need. Charts are grouped into KPI, full-width, and half-width sections.",
    ],
    visual: "dashboard",
  },
  {
    title: "5. Filter & Explore",
    paragraphs: [
      "Use the filter bar to slice your data by dimensions (region, category, etc.) and date ranges with preset periods (Last 7 days, This Month, etc.). All charts update instantly.",
      "The final result is a live, interactive dashboard you can revisit anytime from the My Dashboards page.",
    ],
    visual: "filters",
  },
];

function SlideVisual({ type }: { type: VisualType }) {
  const cls = "w-full h-40 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden";
  switch (type) {
    case "upload":
      return (
        <div className={cls}>
          <svg className="w-full h-full" viewBox="0 0 400 160" fill="none">
            <rect x="50" y="40" width="300" height="12" rx="6" className="fill-slate-200" />
            <rect x="50" y="60" width="200" height="12" rx="6" className="fill-slate-200" />
            <rect x="50" y="80" width="280" height="12" rx="6" className="fill-slate-200" />
            <rect x="50" y="100" width="160" height="12" rx="6" className="fill-slate-200" />
            <path d="M290 110l15-15 15 15" className="stroke-slate-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M305 95v30" className="stroke-slate-400" strokeWidth="2" strokeLinecap="round" />
            <rect x="150" y="20" width="100" height="20" rx="10" className="fill-slate-900" />
            <text x="200" y="34" textAnchor="middle" className="fill-white text-[10px] font-medium">Upload CSV</text>
          </svg>
        </div>
      );
    case "semantics":
      return (
        <div className={cls}>
          <svg className="w-full h-full" viewBox="0 0 400 160" fill="none">
            <rect x="30" y="20" width="340" height="120" rx="8" className="fill-white stroke-slate-200" strokeWidth="1" />
            <rect x="50" y="35" width="80" height="24" rx="6" className="fill-slate-900" />
            <text x="90" y="51" textAnchor="middle" className="fill-white text-[10px] font-medium">Revenue</text>
            <rect x="140" y="35" width="70" height="24" rx="6" className="fill-blue-100 stroke-blue-300" strokeWidth="1" />
            <text x="175" y="51" textAnchor="middle" className="fill-blue-700 text-[10px] font-medium">Measure</text>
            <rect x="50" y="68" width="80" height="24" rx="6" className="fill-slate-900" />
            <text x="90" y="84" textAnchor="middle" className="fill-white text-[10px] font-medium">Date</text>
            <rect x="140" y="68" width="70" height="24" rx="6" className="fill-green-100 stroke-green-300" strokeWidth="1" />
            <text x="175" y="84" textAnchor="middle" className="fill-green-700 text-[10px] font-medium">Date</text>
            <rect x="50" y="101" width="80" height="24" rx="6" className="fill-slate-900" />
            <text x="90" y="117" textAnchor="middle" className="fill-white text-[10px] font-medium">Region</text>
            <rect x="140" y="101" width="70" height="24" rx="6" className="fill-purple-100 stroke-purple-300" strokeWidth="1" />
            <text x="175" y="117" textAnchor="middle" className="fill-purple-700 text-[10px] font-medium">Dimension</text>
            <path d="M260 47h80M260 80h80M260 113h80" className="stroke-slate-200" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );
    case "metrics":
      return (
        <div className={cls}>
          <svg className="w-full h-full" viewBox="0 0 400 160" fill="none">
            <rect x="30" y="20" width="340" height="120" rx="8" className="fill-white stroke-slate-200" strokeWidth="1" />
            <rect x="45" y="32" width="140" height="22" rx="6" className="fill-slate-100" />
            <text x="115" y="47" textAnchor="middle" className="fill-slate-600 text-[10px]">Field: Revenue</text>
            <rect x="195" y="32" width="80" height="22" rx="6" className="fill-slate-100" />
            <text x="235" y="47" textAnchor="middle" className="fill-slate-600 text-[10px]">Agg: SUM</text>
            <rect x="285" y="32" width="70" height="22" rx="6" className="fill-emerald-100 stroke-emerald-300" strokeWidth="1" />
            <text x="320" y="47" textAnchor="middle" className="fill-emerald-700 text-[10px] font-medium">Add +</text>
            <text x="200" y="76" textAnchor="middle" className="fill-slate-400 text-[11px]">=</text>
            <rect x="100" y="84" width="200" height="30" rx="8" className="fill-slate-900" />
            <text x="200" y="104" textAnchor="middle" className="fill-white text-[11px] font-medium">SUM(Revenue) - SUM(Cost)</text>
            <rect x="45" y="125" width="120" height="14" rx="4" className="fill-amber-100" />
            <text x="105" y="135" textAnchor="middle" className="fill-amber-700 text-[8px]">AI: &quot;profit margin&quot;</text>
          </svg>
        </div>
      );
    case "dashboard":
      return (
        <div className={cls}>
          <svg className="w-full h-full" viewBox="0 0 400 160" fill="none">
            <rect x="20" y="15" width="360" height="130" rx="8" className="fill-white stroke-slate-200" strokeWidth="1" />
            <rect x="35" y="28" width="70" height="30" rx="6" className="fill-slate-900" />
            <text x="70" y="47" textAnchor="middle" className="fill-white text-[9px] font-medium">$12.4K</text>
            <text x="70" y="56" textAnchor="middle" className="fill-slate-400 text-[7px]">Revenue</text>
            <rect x="115" y="28" width="70" height="30" rx="6" className="fill-slate-900" />
            <text x="150" y="47" textAnchor="middle" className="fill-white text-[9px] font-medium">3,842</text>
            <text x="150" y="56" textAnchor="middle" className="fill-slate-400 text-[7px]">Orders</text>
            <rect x="195" y="28" width="70" height="30" rx="6" className="fill-slate-900" />
            <text x="230" y="47" textAnchor="middle" className="fill-white text-[9px] font-medium">94.2%</text>
            <text x="230" y="56" textAnchor="middle" className="fill-slate-400 text-[7px]">Conversion</text>
            <rect x="275" y="28" width="90" height="30" rx="6" className="fill-slate-100" />
            {/* mini bar chart */}
            <rect x="285" y="37" width="8" height="14" rx="2" className="fill-slate-300" />
            <rect x="297" y="33" width="8" height="18" rx="2" className="fill-slate-400" />
            <rect x="309" y="39" width="8" height="12" rx="2" className="fill-slate-300" />
            <rect x="321" y="35" width="8" height="16" rx="2" className="fill-slate-400" />
            <rect x="333" y="31" width="8" height="20" rx="2" className="fill-slate-900" />
            <rect x="345" y="36" width="8" height="15" rx="2" className="fill-slate-300" />
            {/* line chart area */}
            <rect x="35" y="72" width="155" height="55" rx="6" className="fill-slate-50 stroke-slate-200" strokeWidth="1" />
            <polyline points="50,112 70,100 90,108 110,85 130,95 150,78 170,88" className="stroke-slate-900 stroke-2 fill-none" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="200" y="72" width="165" height="55" rx="6" className="fill-slate-50 stroke-slate-200" strokeWidth="1" />
            <rect x="215" y="82" width="12" height="28" rx="2" className="fill-slate-900" />
            <rect x="235" y="92" width="12" height="18" rx="2" className="fill-slate-400" />
            <rect x="255" y="78" width="12" height="32" rx="2" className="fill-slate-900" />
            <rect x="275" y="96" width="12" height="14" rx="2" className="fill-slate-400" />
            <rect x="295" y="88" width="12" height="22" rx="2" className="fill-slate-900" />
            <rect x="315" y="102" width="12" height="8" rx="2" className="fill-slate-400" />
            <rect x="335" y="85" width="12" height="25" rx="2" className="fill-slate-900" />
          </svg>
        </div>
      );
    case "filters":
      return (
        <div className={cls}>
          <svg className="w-full h-full" viewBox="0 0 400 160" fill="none">
            <rect x="30" y="15" width="340" height="130" rx="8" className="fill-white stroke-slate-200" strokeWidth="1" />
            <rect x="40" y="28" width="80" height="24" rx="6" className="fill-slate-100" />
            <text x="80" y="44" textAnchor="middle" className="fill-slate-600 text-[9px]">Region ▼</text>
            <rect x="130" y="28" width="90" height="24" rx="6" className="fill-slate-100" />
            <text x="175" y="44" textAnchor="middle" className="fill-slate-600 text-[9px]">Category ▼</text>
            <rect x="230" y="28" width="100" height="24" rx="6" className="fill-slate-100" />
            <text x="280" y="44" textAnchor="middle" className="fill-slate-600 text-[9px]">Date Range ▼</text>
            {/* chips */}
            <rect x="40" y="60" width="50" height="20" rx="10" className="fill-slate-900" />
            <text x="65" y="74" textAnchor="middle" className="fill-white text-[8px]">West</text>
            <rect x="98" y="60" width="60" height="20" rx="10" className="fill-slate-200" />
            <text x="128" y="74" textAnchor="middle" className="fill-slate-600 text-[8px]">Electronics</text>
            <rect x="166" y="60" width="70" height="20" rx="10" className="fill-slate-200" />
            <text x="201" y="74" textAnchor="middle" className="fill-slate-600 text-[8px]">Last 30 days</text>
            {/* results */}
            <rect x="290" y="60" width="70" height="20" rx="6" className="fill-emerald-100" />
            <text x="325" y="74" textAnchor="middle" className="fill-emerald-700 text-[8px]">Apply</text>
            {/* bar chart mini */}
            <rect x="40" y="95" width="300" height="40" rx="6" className="fill-slate-50 stroke-slate-200" strokeWidth="1" />
            <rect x="60" y="105" width="20" height="20" rx="2" className="fill-slate-900" />
            <rect x="95" y="112" width="20" height="13" rx="2" className="fill-slate-300" />
            <rect x="130" y="108" width="20" height="17" rx="2" className="fill-slate-400" />
            <rect x="165" y="102" width="20" height="23" rx="2" className="fill-slate-900" />
            <rect x="200" y="115" width="20" height="10" rx="2" className="fill-slate-300" />
            <rect x="235" y="110" width="20" height="15" rx="2" className="fill-slate-400" />
            <rect x="270" y="103" width="20" height="22" rx="2" className="fill-slate-900" />
          </svg>
        </div>
      );
  }
}

interface ProductTourProps {
  onClose: () => void;
  mandatory?: boolean;
  userId?: string;
}

export default function ProductTour({ onClose, mandatory, userId }: ProductTourProps) {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const [closing, setClosing] = useState(false);
  const storageKey = `tour_completed_${userId || ""}`;

  const handleClose = () => {
    localStorage.setItem(storageKey, "true");
    if (dontShow) localStorage.setItem("tour_dismissed", "true");
    setClosing(true);
    setTimeout(onClose, 200);
  };

  const isLast = step === slides.length - 1;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${closing ? "opacity-0" : "opacity-100"}`}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl mx-4 transition-all duration-200 ${closing ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
      >
        <div className="p-6 pb-4">
          <SlideVisual type={slides[step].visual} />
        </div>

        <div className="px-8 pb-6 h-[230px] flex flex-col">
          <h2 className="text-xl font-semibold text-slate-900 text-center mb-3">
            {slides[step].title}
          </h2>
          <div className="space-y-2">
            {slides[step].paragraphs.map((p, i) => (
              <p key={i} className="text-sm text-slate-500 leading-relaxed">{p}</p>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 px-8 pb-6">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${i === step ? "w-8 bg-slate-900" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between px-8 pb-6 border-t border-slate-100 pt-4">
          {!mandatory && (
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              Don&apos;t show again
            </label>
          )}
          {mandatory && <div />}
          <div className="flex items-center gap-2">
            {!isLast && !mandatory && (
              <button
                onClick={handleClose}
                className="px-3 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Skip
              </button>
            )}
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? handleClose() : setStep((s) => s + 1))}
              className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              {isLast ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
