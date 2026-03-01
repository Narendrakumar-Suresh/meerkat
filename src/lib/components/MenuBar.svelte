<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { Minus, Square, X, Check, ChevronRight } from '@lucide/svelte';

  let { 
    onNew, onOpen, onSave, onExit,
    onToggleExplorer, onToggleAgent,
    onCloseTab,
    autoSave = false, onToggleAutoSave,
    wordWrap = false, onToggleWordWrap,
    tabSize = 2, insertSpaces = true,
    onChangeTabSize, onToggleInsertSpaces
  } = $props<{
    onNew: () => void;
    onOpen: () => void;
    onSave: () => void;
    onExit: () => void;
    onToggleExplorer: () => void;
    onToggleAgent: () => void;
    onCloseTab: () => void;
    autoSave?: boolean;
    onToggleAutoSave?: () => void;
    wordWrap?: boolean;
    onToggleWordWrap?: () => void;
    tabSize?: number;
    insertSpaces?: boolean;
    onChangeTabSize?: (size: number) => void;
    onToggleInsertSpaces?: () => void;
  }>();

  let activeMenu = $state<string | null>(null);
  let activeSubMenu = $state<string | null>(null);
  const appWindow = getCurrentWindow();

  function toggleMenu(menu: string, e: MouseEvent) {
    e.stopPropagation();
    activeMenu = activeMenu === menu ? null : menu;
    activeSubMenu = null;
  }

  function handleAction(action: () => void, e: MouseEvent) {
    e.stopPropagation();
    action();
    activeMenu = null;
    activeSubMenu = null;
  }

  onMount(() => {
    const closeMenu = () => {
      activeMenu = null;
      activeSubMenu = null;
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  });
</script>

<div class="top-bar-container">
  <div class="drag-region" data-tauri-drag-region></div>

  <div class="left-section">
    <div class="brand">
      <img src="/meerkat.png" alt="M" class="logo" />
      <span class="title">meerkat</span>
    </div>

    <div class="menu-bar">
      <!-- File Menu -->
      <div class="menu-item" class:active={activeMenu === 'file'}>
        <button class="menu-btn" onclick={(e) => toggleMenu('file', e)}>File</button>
        {#if activeMenu === 'file'}
          <div class="dropdown">
            <button onclick={(e) => handleAction(onNew, e)}>New File <span class="shortcut">Ctrl+N</span></button>
            <button onclick={(e) => handleAction(onOpen, e)}>Open File <span class="shortcut">Ctrl+O</span></button>
            <button onclick={(e) => handleAction(onSave, e)}>Save <span class="shortcut">Ctrl+S</span></button>
            <div class="divider"></div>
            <button onclick={(e) => onToggleAutoSave?.()}>
              <span>Auto Save</span>
              {#if autoSave}<Check size={14} class="check-icon" />{/if}
            </button>
            <div class="divider"></div>
            <button onclick={(e) => handleAction(onCloseTab, e)}>Close Tab <span class="shortcut">Ctrl+W</span></button>
            <div class="divider"></div>
            <button onclick={(e) => handleAction(onExit, e)}>Exit</button>
          </div>
        {/if}
      </div>

      <!-- Edit Menu -->
      <div class="menu-item" class:active={activeMenu === 'edit'}>
        <button class="menu-btn" onclick={(e) => toggleMenu('edit', e)}>Edit</button>
        {#if activeMenu === 'edit'}
          <div class="dropdown">
            <button disabled>Undo <span class="shortcut">Ctrl+Z</span></button>
            <button disabled>Redo <span class="shortcut">Ctrl+Y</span></button>
            <div class="divider"></div>
            <div class="menu-item-with-sub" onmouseenter={() => activeSubMenu = 'indentation'} onmouseleave={() => activeSubMenu = null}>
              <button class="has-sub">
                Indentation <ChevronRight size={12} />
              </button>
              {#if activeSubMenu === 'indentation'}
                <div class="sub-dropdown">
                  <button onclick={() => onToggleInsertSpaces?.()}>
                    <span>Insert Spaces</span>
                    {#if insertSpaces}<Check size={14} class="check-icon" />{/if}
                  </button>
                  <div class="divider"></div>
                  <button onclick={() => onChangeTabSize?.(2)}>
                    <span>Tab Size: 2</span>
                    {#if tabSize === 2}<Check size={14} class="check-icon" />{/if}
                  </button>
                  <button onclick={() => onChangeTabSize?.(4)}>
                    <span>Tab Size: 4</span>
                    {#if tabSize === 4}<Check size={14} class="check-icon" />{/if}
                  </button>
                  <button onclick={() => onChangeTabSize?.(8)}>
                    <span>Tab Size: 8</span>
                    {#if tabSize === 8}<Check size={14} class="check-icon" />{/if}
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- View Menu -->
      <div class="menu-item" class:active={activeMenu === 'view'}>
        <button class="menu-btn" onclick={(e) => toggleMenu('view', e)}>View</button>
        {#if activeMenu === 'view'}
          <div class="dropdown">
            <button onclick={(e) => handleAction(onToggleExplorer, e)}>Toggle Explorer <span class="shortcut">Ctrl+B</span></button>
            <button onclick={(e) => handleAction(onToggleAgent, e)}>Toggle Agent <span class="shortcut">Ctrl+R</span></button>
            <div class="divider"></div>
            <button onclick={() => onToggleWordWrap?.()}>
              <span>Word Wrap</span>
              {#if wordWrap}<Check size={14} class="check-icon" />{/if}
              <span class="shortcut">Alt+Z</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="window-controls">
    <button class="control-btn" onclick={async () => await appWindow.minimize()} title="Minimize">
      <Minus size={14} />
    </button>
    <button class="control-btn" onclick={async () => await appWindow.toggleMaximize()} title="Maximize">
      <Square size={12} />
    </button>
    <button class="control-btn close" onclick={() => onExit()} title="Close">
      <X size={14} />
    </button>
  </div>
</div>

<style>
  .top-bar-container {
    height: 35px;
    background-color: var(--background);
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    user-select: none;
    position: relative;
    z-index: 100;
  }

  .drag-region {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
  }

  .left-section {
    display: flex;
    align-items: center;
    padding-left: 12px;
    gap: 12px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: 8px;
  }

  .logo { width: 18px; height: 18px; object-fit: contain; }
  .title { font-size: 12px; font-weight: 500; opacity: 0.9; }

  .menu-bar { display: flex; align-items: center; }
  .menu-item { position: relative; }
  .menu-btn {
    background: transparent;
    border: none;
    color: var(--foreground);
    font-size: 12px;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    opacity: 0.7;
  }
  .menu-btn:hover, .menu-item.active .menu-btn { background-color: var(--accent); opacity: 1; }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    background-color: var(--popover);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    min-width: 200px;
    padding: 4px 0;
    display: flex;
    flex-direction: column;
    z-index: 1000;
  }

  .dropdown button {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--popover-foreground);
    text-align: left;
    padding: 6px 12px;
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
  }

  .dropdown button:hover:not(:disabled) { background-color: var(--accent); }
  .dropdown button:disabled { opacity: 0.3; cursor: default; }

  .menu-item-with-sub { position: relative; width: 100%; }
  .has-sub { width: 100%; }

  .sub-dropdown {
    position: absolute;
    top: 0;
    left: 100%;
    background-color: var(--popover);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    min-width: 160px;
    padding: 4px 0;
    z-index: 1001;
  }

  .shortcut { font-size: 10px; opacity: 0.5; margin-left: 20px; }
  .check-icon { color: var(--primary); }
  .divider { height: 1px; background-color: var(--border); margin: 4px 0; }

  .window-controls { display: flex; height: 100%; }
  .control-btn {
    width: 45px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--foreground);
    opacity: 0.7;
    cursor: pointer;
  }
  .control-btn:hover { background-color: var(--accent); opacity: 1; }
  .control-btn.close:hover { background-color: #e81123; color: white; }
</style>
