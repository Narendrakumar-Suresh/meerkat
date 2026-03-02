<script lang="ts">
  import { Search, Replace, FileText, ChevronRight, ChevronDown, Check } from '@lucide/svelte';
  import { readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
  import { join } from '@tauri-apps/api/path';

  let { rootPath, onResultSelect, onFileReplaced } = $props<{
    rootPath: string | null;
    onResultSelect: (path: string, line: number, column: number) => void;
    onFileReplaced?: (path: string) => void;
  }>();

  let query = $state("");
  let replaceQuery = $state("");
  let showReplace = $state(false);
  let isSearching = $state(false);
  let isReplacing = $state(false);

  interface SearchMatch {
    line: number;
    col: number;
    text: string;
    originalText: string;
    checked: boolean;
  }

  interface SearchResult {
    file: string;
    path: string;
    matches: SearchMatch[];
    isOpen: boolean;
    checked: boolean;
  }

  let searchResults = $state<SearchResult[]>([]);

  async function searchInDir(dir: string, q: string): Promise<SearchResult[]> {
    let results: SearchResult[] = [];
    try {
      const entries = await readDir(dir);
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'target' || entry.name === 'dist') continue;
        
        const fullPath = await join(dir, entry.name);
        
        if (entry.isDirectory) {
          const subResults = await searchInDir(fullPath, q);
          results = [...results, ...subResults];
        } else {
          try {
            const content = await readTextFile(fullPath);
            const lines = content.split('\n');
            const matches: SearchMatch[] = [];
            for (let i = 0; i < lines.length; i++) {
              const col = lines[i].toLowerCase().indexOf(q);
              if (col !== -1) {
                matches.push({ 
                  line: i + 1, 
                  col: col + 1, 
                  text: lines[i].trim(),
                  originalText: lines[i],
                  checked: true
                });
              }
            }
            if (matches.length > 0) {
              results.push({
                file: entry.name,
                path: fullPath,
                matches,
                isOpen: true,
                checked: true
              });
            }
          } catch (e) {
            // Ignore binary files or unreadable files
          }
        }
      }
    } catch (err) {
      console.error("Search error in dir:", dir, err);
    }
    return results;
  }

  async function performSearch() {
    if (!rootPath || !query.trim()) {
      searchResults = [];
      return;
    }
    isSearching = true;
    const q = query.toLowerCase().trim();
    searchResults = await searchInDir(rootPath, q);
    isSearching = false;
  }

  async function performReplace() {
    if (!rootPath || !query.trim() || searchResults.length === 0) return;
    
    isReplacing = true;
    const q = query.toLowerCase().trim();
    
    for (const result of searchResults) {
      if (!result.checked && !result.matches.some(m => m.checked)) continue;
      
      try {
        const content = await readTextFile(result.path);
        const lines = content.split('\n');
        let modified = false;

        for (const match of result.matches) {
          if (match.checked) {
            const lineIdx = match.line - 1;
            // Simple case-insensitive replace for first occurrence on that line
            const col = lines[lineIdx].toLowerCase().indexOf(q);
            if (col !== -1) {
              lines[lineIdx] = lines[lineIdx].substring(0, col) + replaceQuery + lines[lineIdx].substring(col + q.length);
              modified = true;
            }
          }
        }

        if (modified) {
          console.log(`[SearchPanel] Writing changes to ${result.path}`);
          await writeTextFile(result.path, lines.join('\n'));
          onFileReplaced?.(result.path);
        }
      } catch (err) {
        console.error("Replace error in file:", result.path, err);
      }
    }
    
    isReplacing = false;
    // Re-run search to update results
    await performSearch();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      performSearch();
    }
  }

  function toggleResult(index: number) {
    searchResults[index].isOpen = !searchResults[index].isOpen;
  }

  function toggleFileCheck(index: number) {
    const newVal = !searchResults[index].checked;
    searchResults[index].checked = newVal;
    searchResults[index].matches.forEach(m => m.checked = newVal);
  }

  function toggleMatchCheck(fileIndex: number, matchIndex: number) {
    searchResults[fileIndex].matches[matchIndex].checked = !searchResults[fileIndex].matches[matchIndex].checked;
    // Update file checkbox based on matches
    const allChecked = searchResults[fileIndex].matches.every(m => m.checked);
    const someChecked = searchResults[fileIndex].matches.some(m => m.checked);
    searchResults[fileIndex].checked = allChecked || someChecked;
  }
</script>

<div class="search-panel">
  <div class="search-header">
    <button class="toggle-replace" onclick={() => showReplace = !showReplace} title="Toggle Replace">
      <ChevronRight size={14} style="transform: rotate({showReplace ? 90 : 0}deg); transition: transform 0.2s;" />
    </button>
    <div class="input-stack">
      <div class="search-input-container">
        <input 
          type="text" 
          placeholder="Search..." 
          bind:value={query}
          onkeydown={handleKeydown}
        />
      </div>
      {#if showReplace}
        <div class="search-input-container">
          <input 
            type="text" 
            placeholder="Replace..." 
            bind:value={replaceQuery}
          />
          <button class="action-btn" onclick={performReplace} disabled={isReplacing || searchResults.length === 0} title="Replace All">
            <Replace size={14} />
          </button>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="results-container">
    {#if isSearching}
      <div class="status-msg">Searching...</div>
    {:else if isReplacing}
      <div class="status-msg">Replacing...</div>
    {:else if query && searchResults.length === 0}
      <div class="status-msg">No results found</div>
    {:else}
      {#each searchResults as result, i}
        <div class="result-file">
          <div class="file-header">
            {#if showReplace}
              <input type="checkbox" checked={result.checked} onchange={() => toggleFileCheck(i)} class="checkbox" />
            {/if}
            <button class="toggle-btn" onclick={() => toggleResult(i)}>
              <span class="chevron">
                {#if result.isOpen}<ChevronDown size={14}/>{:else}<ChevronRight size={14}/>{/if}
              </span>
              <FileText size={14} class="file-icon" />
              <span class="file-name" title={result.path}>{result.file}</span>
              <span class="match-count">{result.matches.length}</span>
            </button>
          </div>
          
          {#if result.isOpen}
            <div class="matches">
              {#each result.matches as match, j}
                <div class="match-item-wrapper">
                  {#if showReplace}
                    <input type="checkbox" checked={match.checked} onchange={() => toggleMatchCheck(i, j)} class="checkbox match-checkbox" />
                  {/if}
                  <button 
                    class="match-item" 
                    onclick={() => onResultSelect(result.path, match.line, match.col)}
                  >
                    <span class="line-num">{match.line}</span>
                    <span class="match-text">{match.text}</span>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .search-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--sidebar);
    color: var(--sidebar-foreground);
  }

  .search-header {
    display: flex;
    align-items: flex-start;
    padding: 12px 8px;
    border-bottom: 1px solid var(--border);
    gap: 4px;
  }

  .toggle-replace {
    background: transparent;
    border: none;
    color: var(--muted-foreground);
    padding: 6px 4px;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }

  .toggle-replace:hover {
    background-color: var(--sidebar-accent);
    color: var(--foreground);
  }

  .input-stack {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .search-input-container {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  input[type="text"] {
    flex: 1;
    background-color: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--foreground);
    padding: 4px 8px;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
  }

  input[type="text"]:focus {
    border-color: var(--primary);
  }

  .action-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--foreground);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }
  
  .action-btn:hover:not(:disabled) {
    background-color: var(--accent);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .results-container {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 12px;
    padding-top: 8px;
  }

  .status-msg {
    padding: 20px;
    text-align: center;
    font-size: 12px;
    opacity: 0.5;
  }

  .result-file {
    margin-bottom: 2px;
  }

  .file-header {
    width: 100%;
    display: flex;
    align-items: center;
    padding: 4px 8px;
    background: transparent;
  }

  .toggle-btn {
    flex: 1;
    display: flex;
    align-items: center;
    background: transparent;
    border: none;
    color: var(--sidebar-foreground);
    cursor: pointer;
    text-align: left;
    padding: 2px 0;
    overflow: hidden;
  }

  .file-header:hover .toggle-btn {
    color: var(--foreground);
  }

  .checkbox {
    margin-right: 6px;
    accent-color: var(--primary);
  }

  .match-checkbox {
    margin-left: 22px;
  }

  .chevron {
    width: 16px;
    display: flex;
    align-items: center;
    opacity: 0.5;
  }

  .file-icon {
    opacity: 0.7;
    margin-right: 6px;
  }

  .file-name {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .match-count {
    font-size: 10px;
    background-color: var(--muted);
    padding: 2px 6px;
    border-radius: 10px;
    opacity: 0.8;
  }

  .matches {
    display: flex;
    flex-direction: column;
  }

  .match-item-wrapper {
    display: flex;
    align-items: flex-start;
    width: 100%;
  }

  .match-item {
    flex: 1;
    display: flex;
    align-items: flex-start;
    padding: 2px 8px 2px 14px;
    background: transparent;
    border: none;
    color: var(--sidebar-foreground);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-mono);
    overflow: hidden;
  }

  .match-item:hover {
    background-color: var(--sidebar-accent);
  }

  .line-num {
    color: var(--muted-foreground);
    font-size: 11px;
    min-width: 30px;
    margin-right: 8px;
    text-align: right;
  }

  .match-text {
    flex: 1;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.9;
  }
</style>
