"use client";

import { Button } from "@/components/ui/button";

export type KeyboardShortcutsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SHORTCUTS = [
  { key: "+ / =", desc: "Zoom in on graph" },
  { key: "-", desc: "Zoom out of graph" },
  { key: "0", desc: "Reset zoom & center graph" },
  { key: "G", desc: "Toggle background grid lines" },
  { key: "L", desc: "Toggle node text labels" },
  { key: "C", desc: "Toggle 3D isometric cubes vs flat nodes" },
  { key: "M", desc: "Toggle subtle pulse motion" },
  { key: "T", desc: "Toggle between 3D Graph and Accessible Table" },
  { key: "Esc", desc: "Deselect node / close inspector" },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-[#090d14] p-5 font-mono text-xs text-zinc-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="font-bold text-zinc-100 flex items-center gap-2">
            <span>⌨</span> Keyboard Shortcuts
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        </div>

        <div className="divide-y divide-zinc-900 py-3">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2">
              <kbd className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-cyan-400">
                {s.key}
              </kbd>
              <span className="text-zinc-400">{s.desc}</span>
            </div>
          ))}
        </div>

        <div className="pt-2">
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="w-full h-8 border-zinc-800 font-mono text-xs text-zinc-300"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
