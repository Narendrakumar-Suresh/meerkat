# Minimal Editor — Phase Roadmap (COMPLETED v1)

**Goal:** a small, polished personal code editor using **Tauri + Svelte + Monaco**, dark custom theme, file open/save, tabs, and left/right sidebars (structural). No Tailwind. Use `lucide-svelte` for icons. Keep each phase *tiny*: **max 2 deliverables** per phase. Each phase ends with clear acceptance criteria.

---

## Phase list (each phase → *two things max*)

### Phase 0 — Project scaffold & dev run (DONE)
1. Create Vite+Svelte project + Tauri init.
2. Verify `npm run dev` / `npx tauri dev` builds and window launches.

### Phase 1 — Monaco editor + dark custom theme (DONE)
1. Embed `monaco-editor` in `MonacoEditor.svelte`.
2. Define and apply a **custom dark theme** (`editor.background` ≈ `#0A0A0A`, no blue accents).

### Phase 2 — Open & Save files (Tauri bridge) (DONE)
1. Implement `open file` (file picker → load content into editor).
2. Implement `save file` (editor content → write to disk).

### Phase 3 — Tabs (multiple files) + Dirty state (DONE)
1. Add tab model + UI (open files create tabs, switch between tabs).
2. Track `isDirty` per tab and show indicator (●) when unsaved.

### Phase 4 — Welcome page + Empty state polish (DONE)
1. Implement a polished welcome screen (Open File / Open Folder / Recent projects placeholders).
2. Add single-file keyboard bindings: Ctrl+S (save), Ctrl+W (close tab).

### Phase 5 — Left & right sidebar skeletons + toggles (DONE)
1. Add left sidebar component (placeholder) and right sidebar component (placeholder).
2. Add toggles (menu buttons / keyboard) to show/hide each sidebar (e.g. `Ctrl+B` toggle left, `Ctrl+R` toggle right).

### Phase 6 — Open Folder + file tree (left sidebar) (DONE)
1. Implement `Open Folder` (store root path in state).
2. Render a simple file tree; clicking a file opens in a tab (reuse tab if already open).

### Phase 7 — Menu bar + global shortcuts (DONE)
1. Add a simple menu bar under native title (File / Edit / View / Help) with essential items (New, Open, Save, Exit).
2. Implement global keyboard shortcuts for common flows: Ctrl+Tab / Ctrl+Shift+Tab (cycle tabs), Ctrl+P (open file palette placeholder), Ctrl+W.

### Phase 8 — Visual polish & settings (DONE)
1. Add editor font + spacing polish (JetBrains Mono, consistent padding, subtle borders).
2. Small Settings panel to change the *accent color* (CSS variable) and persist preference.
   * *Note: Integrated custom OKLCH theme and unified titlebar.*

### Phase 9 — State persistence & recent projects (DONE)
1. Persist last opened workspace + open tabs to disk/localStorage.
2. Show recent projects in Welcome screen and allow quick reopen.

---

### Phase 10 — Agent & LSP (future)
**STATIONED - User decided to stop at Phase 9.**
1. Add a pluggable placeholder for an Agent panel (right sidebar) and an API hook for accepting automated patches.
2. (Optional) Prototype connecting a local LSP via a small bridge — keep this separate, opt-in.
