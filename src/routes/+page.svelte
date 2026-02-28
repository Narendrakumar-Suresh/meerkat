<script lang="ts">
  import MonacoEditor from "$lib/components/MonacoEditor.svelte";
  import WelcomeScreen from "$lib/components/WelcomeScreen.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import FileTree from "$lib/components/FileTree.svelte";
  import MenuBar from "$lib/components/MenuBar.svelte";
  import { open, save } from "@tauri-apps/plugin-dialog";
  import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { onMount } from "svelte";
  import { FilePlus, FolderPlus, Save, RefreshCw, PanelLeft, PanelRight, Sun, Moon } from '@lucide/svelte';

  interface Tab {
    id: string;
    path: string | null;
    name: string;
    content: string;
    savedContent: string;
    language: string;
  }

  let tabs = $state<Tab[]>([]);
  let activeTabId = $state<string | null>(null);
  let rootPath = $state<string | null>(null);
  let recentProjects = $state<string[]>([]);
  let fileTree: ReturnType<typeof FileTree>;

  // Sidebar states
  let showLeftSidebar = $state(true);
  let showRightSidebar = $state(false);
  let leftSidebarWidth = $state(250);
  let rightSidebarWidth = $state(250);
  let isDarkMode = $state(true);

  const activeTab = $derived(tabs.find(t => t.id === activeTabId) || null);

  function getLanguageFromPath(path: string | null) {
    if (!path) return "javascript";
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'rs': return 'rust';
      case 'ts': return 'typescript';
      case 'js': return 'javascript';
      case 'json': return 'json';
      case 'svelte': return 'html';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'md': return 'markdown';
      default: return 'javascript';
    }
  }

  async function openFile(path: string, silent = false) {
    try {
      const existingTab = tabs.find(t => t.path === path);
      if (existingTab) {
        activeTabId = existingTab.id;
        return;
      }

      const content = await readTextFile(path);
      const name = path.split(/[/\\]/).pop() || 'Untitled';
      const newTab: Tab = {
        id: crypto.randomUUID(),
        path: path,
        name,
        content,
        savedContent: content,
        language: getLanguageFromPath(path)
      };
      
      tabs = [...tabs, newTab];
      activeTabId = newTab.id;
    } catch (err) {
      if (!silent) console.error("Error opening file:", err);
    }
  }

  async function handleOpen() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Code',
          extensions: ['js', 'ts', 'svelte', 'rs', 'json', 'css', 'html', 'md']
        }]
      });
      if (selected && !Array.isArray(selected)) await openFile(selected);
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }

  async function handleOpenFolder(path?: string) {
    try {
      let selected = path;
      if (!selected) {
        const res = await open({
          directory: true,
          multiple: false,
        });
        if (res && !Array.isArray(res)) selected = res;
      }

      if (selected) {
        rootPath = selected;
        showLeftSidebar = true;
        addToRecentProjects(selected);
      }
    } catch (err) {
      console.error("Folder dialog error:", err);
    }
  }

  function addToRecentProjects(path: string) {
    const filtered = recentProjects.filter(p => p !== path);
    recentProjects = [path, ...filtered].slice(0, 10);
    localStorage.setItem('meerkat-recent-projects', JSON.stringify(recentProjects));
  }

  async function handleSave() {
    if (!activeTab) return;
    try {
      let savePath = activeTab.path;
      if (!savePath) {
        savePath = await save({
          filters: [{
            name: 'Code',
            extensions: ['js', 'ts', 'svelte', 'rs', 'json', 'css', 'html', 'md']
          }]
        });
      }

      if (savePath) {
        await writeTextFile(savePath, activeTab.content);
        activeTab.path = savePath;
        activeTab.savedContent = activeTab.content;
        activeTab.name = savePath.split(/[/\\]/).pop() || 'Untitled';
        activeTab.language = getLanguageFromPath(savePath);
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  }

  function closeTab(id: string, e?: MouseEvent) {
    if (e) e.stopPropagation();
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;
    
    const newTabs = [...tabs];
    newTabs.splice(index, 1);
    
    if (activeTabId === id) {
      if (newTabs.length > 0) {
        activeTabId = newTabs[Math.max(0, index - 1)].id;
      } else {
        activeTabId = null;
      }
    }
    tabs = newTabs;
  }

  function createNewFile() {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      path: null,
      name: 'Untitled',
      content: '',
      savedContent: '',
      language: 'javascript'
    };
    tabs = [...tabs, newTab];
    activeTabId = newTab.id;
  }

  async function handleExit() {
    const win = getCurrentWindow();
    await win.close();
  }

  function cycleTabs(reverse = false) {
    if (tabs.length <= 1) return;
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    let nextIndex;
    if (reverse) {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else {
      nextIndex = (currentIndex + 1) % tabs.length;
    }
    activeTabId = tabs[nextIndex].id;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault();
      cycleTabs(e.shiftKey);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 's': e.preventDefault(); handleSave(); break;
        case 'w': e.preventDefault(); if (activeTabId) closeTab(activeTabId); break;
        case 'o': e.preventDefault(); handleOpen(); break;
        case 'n': e.preventDefault(); createNewFile(); break;
        case 'b': e.preventDefault(); showLeftSidebar = !showLeftSidebar; break;
        case 'r': e.preventDefault(); showRightSidebar = !showRightSidebar; break;
      }
    }
  }

  // Resizing logic
  let isResizingLeft = false;
  let isResizingRight = false;

  function startResizeLeft(e: MouseEvent) {
    isResizingLeft = true;
    window.addEventListener('mousemove', handleResizeLeft);
    window.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'col-resize';
  }

  function startResizeRight(e: MouseEvent) {
    isResizingRight = true;
    window.addEventListener('mousemove', handleResizeRight);
    window.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'col-resize';
  }

  function handleResizeLeft(e: MouseEvent) {
    if (!isResizingLeft) return;
    leftSidebarWidth = Math.max(150, Math.min(e.clientX, 600));
  }

  function handleResizeRight(e: MouseEvent) {
    if (!isResizingRight) return;
    rightSidebarWidth = Math.max(150, Math.min(window.innerWidth - e.clientX, 600));
  }

  function stopResize() {
    isResizingLeft = false; isResizingRight = false;
    window.removeEventListener('mousemove', handleResizeLeft);
    window.removeEventListener('mousemove', handleResizeRight);
    window.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = 'default';
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('meerkat-theme', isDarkMode ? 'dark' : 'light');
  }

  // Persistence
  function saveSession() {
    const session = {
      rootPath,
      openPaths: tabs.map(t => t.path).filter(p => p !== null),
      activePath: activeTab?.path || null
    };
    localStorage.setItem('meerkat-session', JSON.stringify(session));
  }

  onMount(() => {
    const loadSessionData = async () => {
      const savedTheme = localStorage.getItem('meerkat-theme');
      isDarkMode = savedTheme !== 'light';
      document.documentElement.classList.toggle('dark', isDarkMode);

      const savedRecent = localStorage.getItem('meerkat-recent-projects');
      if (savedRecent) recentProjects = JSON.parse(savedRecent);

      const savedSession = localStorage.getItem('meerkat-session');
      if (savedSession) {
        const session = JSON.parse(savedSession);
        rootPath = session.rootPath;
        if (session.openPaths) {
          for (const path of session.openPaths) {
            await openFile(path, true);
          }
        }
        if (session.activePath) {
          const tab = tabs.find(t => t.path === session.activePath);
          if (tab) activeTabId = tab.id;
        }
      }
    };

    loadSessionData();

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  $effect(() => {
    saveSession();
  });
</script>

<div class="app-container" class:dark={isDarkMode}>
  <MenuBar 
    onNew={createNewFile}
    onOpen={handleOpen}
    onSave={handleSave}
    onExit={handleExit}
    onToggleExplorer={() => showLeftSidebar = !showLeftSidebar}
    onToggleAgent={() => showRightSidebar = !showRightSidebar}
    onCloseTab={() => activeTabId && closeTab(activeTabId)}
  />

  <main>
    <div class="app-layout">
      <div class="sidebar-wrapper" style="width: {leftSidebarWidth}px; display: {showLeftSidebar ? 'flex' : 'none'}">
        <Sidebar title="Explorer">
          {#snippet actions()}
            <button class="icon-btn" onclick={() => fileTree?.startCreate('file')} title="New File"><FilePlus size={14}/></button>
            <button class="icon-btn" onclick={() => fileTree?.startCreate('folder')} title="New Folder"><FolderPlus size={14}/></button>
            <button class="icon-btn" onclick={() => rootPath = rootPath} title="Refresh"><RefreshCw size={14}/></button>
          {/snippet}
          <FileTree bind:this={fileTree} {rootPath} onFileSelect={openFile} />
        </Sidebar>
        <div class="resize-handle left" onmousedown={startResizeLeft} role="separator"></div>
      </div>

      <div class="center-content">
        {#if tabs.length > 0}
          <div class="tab-bar">
            <div class="tabs-scroll">
              {#each tabs as tab (tab.id)}
                <button 
                  class="tab" 
                  class:active={activeTabId === tab.id}
                  onclick={() => activeTabId = tab.id}
                >
                  <span class="tab-name" title={tab.path || 'Untitled'}>{tab.name}</span>
                  {#if tab.content !== tab.savedContent}
                    <span class="dirty-indicator">●</span>
                  {:else}
                    <span class="dirty-indicator"></span>
                  {/if}
                  <span 
                    class="close-btn" 
                    role="button" 
                    tabindex="0" 
                    onclick={(e) => closeTab(tab.id, e)}
                    onkeydown={(e) => e.key === 'Enter' && closeTab(tab.id)}
                  >×</span>
                </button>
              {/each}
            </div>
            <div class="tab-actions">
              <button class="icon-btn" onclick={toggleTheme} title="Toggle Theme">
                {#if isDarkMode}<Sun size={14}/>{:else}<Moon size={14}/>{/if}
              </button>
              <button class="icon-btn" onclick={() => showLeftSidebar = !showLeftSidebar} title="Toggle Explorer">
                <PanelLeft size={14}/>
              </button>
              <button class="icon-btn" onclick={() => showRightSidebar = !showRightSidebar} title="Toggle Agent">
                <PanelRight size={14}/>
              </button>
            </div>
          </div>
          <div class="editor-wrapper">
            {#if activeTab}
              {#key activeTab.id}
                <MonacoEditor 
                  bind:value={activeTab.content} 
                  language={activeTab.language} 
                  {isDarkMode}
                />
              {/key}
            {/if}
          </div>
        {:else}
          <WelcomeScreen 
            onNewFile={createNewFile} 
            onOpenFile={handleOpen} 
            onOpenFolder={() => handleOpenFolder()} 
            recentProjects={recentProjects}
            onOpenRecent={handleOpenFolder}
          />
        {/if}
      </div>

      <div class="sidebar-wrapper" style="width: {rightSidebarWidth}px; display: {showRightSidebar ? 'flex' : 'none'}">
        <div class="resize-handle right" onmousedown={startResizeRight} role="separator"></div>
        <Sidebar title="Agent">
          <p class="p-4 opacity-50 text-xs">Agent features are coming soon.</p>
        </Sidebar>
      </div>
    </div>
  </main>
</div>

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background-color: var(--background);
    color: var(--foreground);
    font-family: var(--font-sans);
  }

  .app-container {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    background-color: var(--background);
    color: var(--foreground);
  }

  main { height: calc(100vh - 35px); width: 100vw; flex: 1; }

  .app-layout {
    display: flex;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .center-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    background-color: var(--background);
  }

  .sidebar-wrapper {
    position: relative;
    height: 100%;
    display: flex;
    flex-shrink: 0;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    width: 4px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
    transition: background-color 0.2s;
  }

  .resize-handle:hover { background-color: var(--accent); }
  .resize-handle.left { right: -2px; }
  .resize-handle.right { left: -2px; }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--foreground);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: var(--radius-sm);
    opacity: 0.6;
    transition: all 0.2s;
  }

  .icon-btn:hover:not(:disabled) {
    background-color: var(--accent);
    opacity: 1;
  }

  .icon-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .tab-bar {
    height: 35px;
    background-color: var(--muted);
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-right: 8px;
  }

  .tabs-scroll {
    flex: 1;
    display: flex;
    height: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tabs-scroll::-webkit-scrollbar { display: none; }

  .tab-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 8px;
    border-left: 1px solid var(--border);
  }

  .tab {
    display: flex;
    align-items: center;
    padding: 0 12px;
    min-width: 120px;
    max-width: 200px;
    height: 100%;
    background-color: var(--muted);
    border: none;
    border-right: 1px solid var(--border);
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .tab.active {
    background-color: var(--background);
    color: var(--foreground);
  }

  .tab:hover:not(.active) { background-color: var(--accent); color: var(--accent-foreground); }

  .tab-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }

  .dirty-indicator {
    margin: 0 5px;
    width: 8px;
    height: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: var(--primary);
  }

  .close-btn {
    margin-left: 8px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    font-size: 14px;
    opacity: 0.5;
  }

  .close-btn:hover { background-color: var(--accent); color: var(--foreground); opacity: 1; }

  .editor-wrapper {
    flex: 1;
    overflow: hidden;
    background-color: var(--background);
  }
</style>
