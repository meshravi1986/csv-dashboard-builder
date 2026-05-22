"use client";

import { useEffect, useState } from "react";

const slides = [
  {
    title: "Welcome to CSV Dashboard Builder",
    desc: "Turn your CSV files into interactive dashboards in minutes. No coding required.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    title: "1. Upload Your Data",
    desc: "Upload CSV or spreadsheet files. We'll automatically detect your schema and data types.",
    icon: "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3",
  },
  {
    title: "2. Profile & Semantics",
    desc: "Review your data profile, set column semantics (dimensions, measures, dates), and define your KPIs.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    title: "3. Build Dashboards",
    desc: "Auto-generate charts with AI-powered metrics. Drag to reorder, apply filters, and share insights instantly.",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  },
  {
    title: "4. Filter & Explore",
    desc: "Use dynamic filters to slice data by dimensions and date ranges. Everything updates in real time.",
    icon: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
  },
];

export default function ProductTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    if (dontShow) localStorage.setItem("tour_dismissed", "true");
    setClosing(true);
    setTimeout(onClose, 200);
  };

  const isLast = step === slides.length - 1;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${closing ? "opacity-0" : "opacity-100"}`}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 p-8 transition-all duration-200 ${closing ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
      >
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 text-white mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={slides[step].icon} />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-slate-900 text-center mb-2">{slides[step].title}</h2>
        <p className="text-sm text-slate-500 text-center leading-relaxed mb-8">{slides[step].desc}</p>

        <div className="flex items-center justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-slate-900" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            Don&apos;t show again
          </label>
          <div className="flex items-center gap-2">
            {!isLast && (
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
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              {isLast ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
