"use client";

import { useState } from "react";
import { api } from "@/services/api";

interface Tab {
  id: string;
  title: string;
  order: number;
}

interface TabBarProps {
  dashboardId: string;
  tabs: Tab[];
  activeTabId: string | null;
  onTabChange: (tabId: string | null) => void;
  onRefresh: () => void;
}

export function TabBar({ dashboardId, tabs, activeTabId, onTabChange, onRefresh }: TabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [adding, setAdding] = useState(false);

  const startRename = (tab: Tab) => {
    setEditingTabId(tab.id);
    setEditValue(tab.title);
  };

  const saveRename = async (tabId: string) => {
    const trimmed = editValue.trim();
    if (trimmed) {
      try {
        await api.renameTab(tabId, trimmed);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
    setEditingTabId(null);
  };

  const handleDelete = async (tabId: string) => {
    if (!confirm("Delete this tab and all its charts?")) return;
    try {
      await api.deleteTab(tabId);
      if (activeTabId === tabId) onTabChange(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      await api.createTab(dashboardId, "Tab " + (tabs.length + 1));
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 pb-0 -mb-4">
      {tabs.map((tab) => (
        <div key={tab.id} className="group relative">
          {editingTabId === tab.id ? (
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveRename(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename(tab.id);
                if (e.key === "Escape") setEditingTabId(null);
              }}
              className="px-3 py-2 text-sm font-medium border-b-2 border-slate-900 bg-transparent outline-none w-28"
              autoFocus
            />
          ) : (
            <button
              onClick={() => onTabChange(tab.id)}
              onDoubleClick={() => startRename(tab)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTabId === tab.id
                  ? "bg-white text-slate-900 border border-b-0 border-slate-200 -mb-px"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {tab.title}
            </button>
          )}
          {activeTabId === tab.id && editingTabId !== tab.id && (
            <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); startRename(tab); }}
                className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
                title="Rename"
              >
                <svg className="w-2.5 h-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(tab.id); }}
                className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-200 flex items-center justify-center"
                title="Delete tab"
              >
                <svg className="w-2.5 h-2.5 text-slate-500 hover:text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={handleAdd}
        disabled={adding}
        className="px-2 py-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
        title="Add tab"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
