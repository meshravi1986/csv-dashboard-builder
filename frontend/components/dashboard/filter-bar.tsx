"use client";

import { useState, useRef, useEffect } from "react";

interface ActiveFilter {
  field_name: string;
  type: "dimension" | "date";
  values?: string[];
  start?: string;
  end?: string;
}

interface AvailableFilter {
  field_name: string;
  label: string;
  type: "dimension" | "date";
  values?: { label: string; value: string }[];
  cardinality?: number;
  min_date?: string;
  max_date?: string;
  presets?: { label: string; start: string; end: string }[];
}

interface FilterBarProps {
  availableFilters: AvailableFilter[];
  activeFilters: ActiveFilter[];
  onChange: (filters: ActiveFilter[]) => void;
}

function DimensionFilterPopover({
  filter,
  selected,
  onChange,
  onClose,
}: {
  filter: AvailableFilter;
  selected: string[];
  onChange: (values: string[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [tempSelected, setTempSelected] = useState<string[]>(selected);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = (filter.values || []).filter((v) =>
    v.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (value: string) => {
    setTempSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  return (
    <div ref={popoverRef} className="absolute top-full mt-2 left-0 z-50 w-72 bg-white rounded-xl border border-slate-200 shadow-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900">{filter.label}</p>
        <button onClick={() => { setTempSelected([]); }} className="text-xs text-slate-400 hover:text-slate-600">
          Clear
        </button>
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
      />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filtered.map((v) => (
          <label key={v.value} className="flex items-center gap-2 px-1 py-1 hover:bg-slate-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={tempSelected.includes(v.value)}
              onChange={() => toggle(v.value)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-sm text-slate-700">{v.label}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">No matches</p>}
      </div>
      <button
        onClick={() => { onChange(tempSelected); onClose(); }}
        className="w-full py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
      >
        Apply
      </button>
    </div>
  );
}

function DateFilterPopover({
  filter,
  selectedStart,
  selectedEnd,
  onChange,
  onClose,
}: {
  filter: AvailableFilter;
  selectedStart: string;
  selectedEnd: string;
  onChange: (start: string, end: string) => void;
  onClose: () => void;
}) {
  const [tempStart, setTempStart] = useState(selectedStart);
  const [tempEnd, setTempEnd] = useState(selectedEnd);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={popoverRef} className="absolute top-full mt-2 left-0 z-50 w-80 bg-white rounded-xl border border-slate-200 shadow-lg p-3 space-y-3">
      <p className="text-sm font-medium text-slate-900">{filter.label}</p>

      {(filter.presets || []).filter((p) => p.label !== "Custom Range").length > 0 && (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1.5">Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {(filter.presets || [])
              .filter((p) => p.label !== "Custom Range")
              .map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setTempStart(p.start);
                    setTempEnd(p.end);
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  {p.label}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-400">From</label>
          <input
            type="date"
            value={tempStart}
            onChange={(e) => setTempStart(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">To</label>
          <input
            type="date"
            value={tempEnd}
            onChange={(e) => setTempEnd(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { onChange(tempStart, tempEnd); onClose(); }}
          disabled={!tempStart || !tempEnd}
          className="flex-1 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          Apply
        </button>
        <button
          onClick={() => { onChange("", ""); onClose(); }}
          className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function FilterBar({ availableFilters, activeFilters, onChange }: FilterBarProps) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showAddMenu) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [showAddMenu]);

  if (availableFilters.length === 0) return null;

  const activeNames = activeFilters.map((f) => f.field_name);
  const availableToAdd = availableFilters.filter((f) => !activeNames.includes(f.field_name));

  const updateFilter = (fieldName: string, updates: Partial<ActiveFilter>) => {
    onChange(activeFilters.map((f) => (f.field_name === fieldName ? { ...f, ...updates } : f)));
  };

  const removeFilter = (fieldName: string) => {
    onChange(activeFilters.filter((f) => f.field_name !== fieldName));
  };

  const addFilter = (af: AvailableFilter) => {
    const nf: ActiveFilter = { field_name: af.field_name, type: af.type };
    if (af.type === "dimension") {
      nf.values = [];
    } else {
      nf.start = "";
      nf.end = "";
    }
    onChange([...activeFilters, nf]);
    setShowAddMenu(false);
    setOpenFilter(af.field_name);
  };

  const getAvail = (fieldName: string) => availableFilters.find((f) => f.field_name === fieldName);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-1">Filters</span>

        {activeFilters.map((af) => {
          const avail = getAvail(af.field_name);
          if (!avail) return null;

          const label = af.type === "dimension"
            ? `${avail.label} (${(af.values || []).length})`
            : avail.label;

          return (
            <div key={af.field_name} className="relative inline-flex">
              <button
                onClick={() => setOpenFilter(openFilter === af.field_name ? null : af.field_name)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <span>{label}</span>
                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={() => removeFilter(af.field_name)}
                className="ml-0.5 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {openFilter === af.field_name && avail.type === "dimension" && (
                <DimensionFilterPopover
                  filter={avail}
                  selected={af.values || []}
                  onChange={(vals) => updateFilter(af.field_name, { values: vals })}
                  onClose={() => setOpenFilter(null)}
                />
              )}
              {openFilter === af.field_name && avail.type === "date" && (
                <DateFilterPopover
                  filter={avail}
                  selectedStart={af.start || ""}
                  selectedEnd={af.end || ""}
                  onChange={(start, end) => updateFilter(af.field_name, { start, end })}
                  onClose={() => setOpenFilter(null)}
                />
              )}
            </div>
          );
        })}

        {availableToAdd.length > 0 && (
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Filter
            </button>

            {showAddMenu && (
              <div className="absolute top-full mt-2 left-0 z-50 w-56 bg-white rounded-xl border border-slate-200 shadow-lg p-1.5">
                {availableToAdd.map((af) => (
                  <button
                    key={af.field_name}
                    onClick={() => addFilter(af)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    {af.label}
                    <span className="text-xs text-slate-400 ml-2">
                      {af.type === "dimension" ? `${af.cardinality} values` : "date"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeFilters.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-xs text-slate-400 hover:text-slate-600 ml-2"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
