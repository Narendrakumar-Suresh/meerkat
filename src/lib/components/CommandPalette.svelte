<script lang="ts">
  import { Search, Command, FileText } from '@lucide/svelte';

  interface CommandItem {
    id: string;
    label: string;
    description?: string;
    shortcut?: string;
    action: () => void;
    icon?: any;
  }

  let { 
    show = $bindable(false), 
    commands = [], 
    files = [],
    mode = $bindable<'command' | 'file'>('command'),
    onSelect
  } = $props<{
    show: boolean;
    commands: CommandItem[];
    files: { name: string, path: string }[];
    mode: 'command' | 'file';
    onSelect?: (item: any, type: 'command' | 'file') => void;
  }>();

  let query = $state("");
  let selectedIndex = $state(0);
  let inputElement: HTMLInputElement;

  let filteredItems = $derived.by(() => {
    const q = query.toLowerCase().trim();
    if (mode === 'command') {
      return commands.filter(c => c.label.toLowerCase().includes(q));
    } else {
      return files.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }
  });

  $effect(() => {
    if (show) {
      setTimeout(() => inputElement?.focus(), 50);
      selectedIndex = 0;
      query = "";
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % Math.max(1, filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredItems.length) % Math.max(1, filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      show = false;
    }
  }

  function handleSelect(item: any) {
    if (!item) return;
    onSelect?.(item, mode);
    show = false;
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={() => show = false}>
    <div class="palette" onclick={(e) => e.stopPropagation()}>
      <div class="input-wrapper">
        {#if mode === 'command'}
          <Command size={16} class="mode-icon" />
        {:else}
          <Search size={16} class="mode-icon" />
        {/if}
        <input 
          bind:this={inputElement}
          bind:value={query} 
          placeholder={mode === 'command' ? "Type a command..." : "Search files..."}
          onkeydown={handleKeydown}
        />
      </div>

      <div class="results">
        {#each filteredItems as item, i}
          <button 
            class="result-item" 
            class:selected={i === selectedIndex}
            onclick={() => handleSelect(item)}
            onmouseenter={() => selectedIndex = i}
          >
            <div class="item-info">
              {#if mode === 'command'}
                <span class="item-label">{item.label}</span>
              {:else}
                <FileText size={14} class="file-icon" />
                <div class="file-details">
                  <span class="item-label">{item.name}</span>
                  <span class="item-path">{item.path}</span>
                </div>
              {/if}
            </div>
            {#if mode === 'command' && item.shortcut}
              <span class="shortcut">{item.shortcut}</span>
            {/if}
          </button>
        {/each}
        {#if filteredItems.length === 0}
          <div class="no-results">No results found</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 2000;
    display: flex;
    justify-content: center;
    padding-top: 10vh;
  }

  .palette {
    width: 600px;
    max-height: 400px;
    background-color: var(--popover);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }

  .mode-icon { opacity: 0.5; color: var(--foreground); }

  input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--foreground);
    font-size: 14px;
    outline: none;
  }

  .results {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .result-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--foreground);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
  }

  .result-item.selected {
    background-color: var(--accent);
    color: var(--accent-foreground);
  }

  .item-info {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
  }

  .item-label {
    font-size: 13px;
  }

  .file-details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .item-path {
    font-size: 11px;
    opacity: 0.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-icon { opacity: 0.6; flex-shrink: 0; }

  .shortcut {
    font-size: 10px;
    opacity: 0.5;
    background-color: var(--muted);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .no-results {
    padding: 20px;
    text-align: center;
    font-size: 12px;
    opacity: 0.5;
  }
</style>
