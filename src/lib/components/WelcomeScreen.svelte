<script lang="ts">
  import { FilePlus, FolderOpen, History, Keyboard } from '@lucide/svelte';

  let { 
    onOpenFile, onOpenFolder, onNewFile, 
    recentProjects = [], onOpenRecent 
  } = $props<{
    onOpenFile: () => void;
    onOpenFolder: () => void;
    onNewFile: () => void;
    recentProjects?: string[];
    onOpenRecent: (path: string) => void;
  }>();

  function getFolderName(path: string) {
    return path.split(/[/\\]/).pop() || path;
  }
</script>

<div class="welcome-container">
  <div class="hero">
    <img src="/meerkat.png" alt="Meerkat Logo" class="logo" />
    <h1>Meerkat</h1>
    <p class="subtitle">A minimal, polished code editor.</p>
  </div>

  <div class="sections">
    <div class="section">
      <h3>Start</h3>
      <button class="action-btn" onclick={onNewFile}>
        <FilePlus size={18} />
        <span>New File</span>
        <span class="shortcut">Ctrl+N</span>
      </button>
      <button class="action-btn" onclick={onOpenFile}>
        <FolderOpen size={18} />
        <span>Open File</span>
        <span class="shortcut">Ctrl+O</span>
      </button>
      <button class="action-btn" onclick={onOpenFolder}>
        <FolderOpen size={18} />
        <span>Open Folder</span>
      </button>
    </div>

    <div class="section">
      <h3>Recent</h3>
      {#if recentProjects.length > 0}
        <div class="recent-list">
          {#each recentProjects as path}
            <button class="recent-item" onclick={() => onOpenRecent(path)} title={path}>
              <span class="recent-name">{getFolderName(path)}</span>
              <span class="recent-path">{path}</span>
            </button>
          {/each}
        </div>
      {:else}
        <div class="recent-placeholder">
          <History size={16} />
          <span>No recent projects</span>
        </div>
      {/if}
    </div>

    <div class="section">
      <h3>Help</h3>
      <div class="help-item">
        <Keyboard size={16} />
        <span>Keyboard Shortcuts</span>
      </div>
      <div class="shortcuts-list">
        <div class="shortcut-row"><span>Save</span> <kbd>Ctrl + S</kbd></div>
        <div class="shortcut-row"><span>Close Tab</span> <kbd>Ctrl + W</kbd></div>
        <div class="shortcut-row"><span>Explorer</span> <kbd>Ctrl + B</kbd></div>
        <div class="shortcut-row"><span>Agent</span> <kbd>Ctrl + R</kbd></div>
      </div>
    </div>
  </div>
</div>

<style>
  .welcome-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: var(--background);
    color: var(--foreground);
    padding: 20px;
    user-select: none;
    overflow-y: auto;
  }

  .hero {
    text-align: center;
    margin-bottom: 60px;
  }

  .logo {
    width: 64px;
    height: 64px;
    margin: 0 auto 20px;
    display: block;
    object-fit: contain;
  }

  h1 {
    font-size: 32px;
    font-weight: 300;
    margin: 0;
    letter-spacing: 2px;
    color: var(--foreground);
  }

  .subtitle {
    color: var(--muted-foreground);
    font-size: 14px;
    margin-top: 8px;
  }

  .sections {
    display: flex;
    gap: 60px;
    max-width: 1000px;
    width: 100%;
    justify-content: center;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 250px;
  }

  h3 {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted-foreground);
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.7;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: var(--foreground);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    opacity: 0.8;
  }

  .action-btn:hover {
    color: var(--primary);
    opacity: 1;
    transform: translateX(4px);
  }

  .shortcut {
    margin-left: auto;
    font-size: 10px;
    color: var(--muted-foreground);
    opacity: 0.5;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .recent-item {
    background: transparent;
    border: none;
    padding: 8px;
    border-radius: var(--radius-sm);
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: all 0.2s;
  }

  .recent-item:hover {
    background-color: var(--accent);
  }

  .recent-name {
    font-size: 13px;
    color: var(--foreground);
    display: block;
  }

  .recent-path {
    font-size: 10px;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.6;
  }

  .recent-placeholder, .help-item {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted-foreground);
    font-size: 13px;
    opacity: 0.6;
  }

  .shortcuts-list {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .shortcut-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--muted-foreground);
  }

  kbd {
    background-color: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 2px 4px;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--muted-foreground);
  }
</style>
