<script lang="ts">
  import MonacoEditor from "$lib/components/MonacoEditor.svelte";
  import WelcomeScreen from "$lib/components/WelcomeScreen.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import FileTree from "$lib/components/FileTree.svelte";
  import MenuBar from "$lib/components/MenuBar.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import TerminalPanel from "$lib/components/TerminalPanel.svelte";
  import SearchPanel from "$lib/components/SearchPanel.svelte";
  import SettingsModal from "$lib/components/SettingsModal.svelte";
  import DiffViewer from "$lib/components/DiffViewer.svelte";
  import { open, save, ask } from "@tauri-apps/plugin-dialog";
  import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { Command } from "@tauri-apps/plugin-shell";
  import { onMount } from "svelte";
  import { FilePlus, FolderPlus, Save, RefreshCw, PanelLeft, PanelRight, Sun, Moon, Search as SearchIcon, File as FileIcon, SplitSquareHorizontal, Settings as SettingsIcon, FileDiff } from '@lucide/svelte';

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
  let leftSidebarMode = $state<'explorer' | 'search'>('explorer');
  let showRightSidebar = $state(false);
  let leftSidebarWidth = $state(250);
  let rightSidebarWidth = $state(250);
  let terminalHeight = $state(200);
  let showTerminal = $state(false);
  let isDarkMode = $state(true);

  // Split Editor state
  let isEditorSplit = $state(false);
  let rightActiveTabId = $state<string | null>(null);
  let activeGroup = $state<'left' | 'right'>('left');

  // Settings
  let autoSave = $state(true);
  let autoSaveDelay = $state(1000); // 1 second
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let wordWrap = $state(false);
  let tabSize = $state(2);
  let insertSpaces = $state(true);
  let fontSize = $state(14);
  let showSettings = $state(false);
  let showDiff = $state(false);
  let cursorPos = $state({ lineNumber: 1, column: 1 });
  let editorScrollToLine = $state<number | null>(null);
  let gitBranch = $state("");

  // Palette state
  let showPalette = $state(false);
  let paletteMode = $state<'command' | 'file'>('file');
  let projectFiles = $state<{name: string, path: string}[]>([]);

  const activeTab = $derived(tabs.find(t => t.id === activeTabId) || null);
  const rightActiveTab = $derived(tabs.find(t => t.id === rightActiveTabId) || null);

  function normalizePath(p: string | null) {
    if (!p) return null;
    return p.replace(/\\/g, '/').toLowerCase();
  }

  async function scanProjectFiles(dir: string): Promise<{name: string, path: string}[]> {
    try {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');
      const entries = await readDir(dir);
      let files: {name: string, path: string}[] = [];
      
      for (const entry of entries) {
        const fullPath = await join(dir, entry.name);
        if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
        if (entry.name === 'node_modules' || entry.name === 'target' || entry.name === 'dist') continue;

        if (entry.isDirectory) {
          const subFiles = await scanProjectFiles(fullPath);
          files = [...files, ...subFiles];
        } else {
          files.push({ name: entry.name, path: fullPath });
        }
      }
      return files;
    } catch (err) {
      console.error("Scan error:", err);
      return [];
    }
  }

  async function fetchGitBranch() {
    if (!rootPath) {
      gitBranch = "";
      return;
    }
    try {
      const output = await Command.create('git', ['branch', '--show-current'], { cwd: rootPath }).execute();
      if (output.code === 0) {
        gitBranch = output.stdout.trim();
      } else {
        gitBranch = "";
      }
    } catch (e) {
      gitBranch = "";
    }
  }

  $effect(() => {
    if (showPalette && paletteMode === 'file' && rootPath) {
      scanProjectFiles(rootPath).then(files => projectFiles = files);
    }
  });

  $effect(() => {
    if (rootPath) {
      fetchGitBranch();
    } else {
      gitBranch = "";
    }
  });

  const commands = $derived([
    { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N', action: createNewFile },
    { id: 'open-file', label: 'Open File...', shortcut: 'Ctrl+O', action: handleOpen },
    { id: 'save-file', label: 'Save File', shortcut: 'Ctrl+S', action: handleSave },
    { id: 'close-tab', label: 'Close Tab', shortcut: 'Ctrl+W', action: () => activeTabId && closeTab(activeTabId) },
    { id: 'toggle-explorer', label: 'Toggle Explorer', shortcut: 'Ctrl+B', action: () => { showLeftSidebar = !showLeftSidebar; leftSidebarMode = 'explorer'; } },
    { id: 'toggle-search', label: 'Search across files', shortcut: 'Ctrl+Shift+F', action: () => { showLeftSidebar = true; leftSidebarMode = 'search'; } },
    { id: 'toggle-agent', label: 'Toggle Agent', shortcut: 'Ctrl+R', action: () => showRightSidebar = !showRightSidebar },
    { id: 'toggle-terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: () => showTerminal = !showTerminal },
    { id: 'toggle-word-wrap', label: 'Toggle Word Wrap', shortcut: 'Alt+Z', action: () => wordWrap = !wordWrap },
    { id: 'split-editor', label: 'Split Editor', action: toggleSplitEditor },
    { id: 'toggle-diff', label: 'Toggle Diff View', action: () => showDiff = !showDiff },
    { id: 'open-settings', label: 'Open Settings', shortcut: 'Ctrl+,', action: () => showSettings = true },
    { id: 'toggle-theme', label: 'Toggle Light/Dark Theme', action: toggleTheme },
    { id: 'exit', label: 'Exit Meerkat', action: handleExit },
  ]);

  function toggleSplitEditor() {
    isEditorSplit = !isEditorSplit;
    if (isEditorSplit && activeTabId) {
      rightActiveTabId = activeTabId;
    }
  }

  function handlePaletteSelect(item: any, type: 'command' | 'file') {
    if (type === 'command') {
      item.action();
    } else {
      openFile(item.path);
    }
  }

  function handleFileRename(oldPath: string, newPath: string) {
    const tab = tabs.find(t => t.path === oldPath);
    if (tab) {
      tab.path = newPath;
      tab.name = newPath.split(/[/\\]/).pop() || 'Untitled';
      tab.language = getLanguageFromPath(newPath);
    }
  }

  function handleFileDelete(path: string) {
    const tabsToClose = tabs.filter(t => t.path === path || (t.path && t.path.startsWith(path + '/')) || (t.path && t.path.startsWith(path + '\\')));
    for (const tab of tabsToClose) {
      closeTab(tab.id);
    }
  }

  async function handleFileChange(path: string) {
    const normalizedTarget = normalizePath(path);
    const tabIndex = tabs.findIndex(t => normalizePath(t.path) === normalizedTarget);
    
    if (tabIndex !== -1) {
      const tab = tabs[tabIndex];
      // Only reload if we don't have unsaved changes OR if we want to force it
      // For now let's force it to fix the "stagnant" issue
      try {
        const content = await readTextFile(path);
        console.log(`[FileSync] Reloading ${path}`);
        tabs[tabIndex] = {
          ...tab,
          content,
          savedContent: content
        };
      } catch (e) {
        console.error("Error reloading file:", path, e);
      }
    }
  }

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
        if (activeGroup === 'left') activeTabId = existingTab.id;
        else rightActiveTabId = existingTab.id;
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
      if (activeGroup === 'left') activeTabId = newTab.id;
      else rightActiveTabId = newTab.id;
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
        leftSidebarMode = 'explorer';
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
    const tabToSave = activeGroup === 'left' ? activeTab : rightActiveTab;
    if (!tabToSave) return;
    try {
      let savePath = tabToSave.path;
      if (!savePath) {
        savePath = await save({
          filters: [{
            name: 'Code',
            extensions: ['js', 'ts', 'svelte', 'rs', 'json', 'css', 'html', 'md']
          }]
        });
      }

      if (savePath) {
        await writeTextFile(savePath, tabToSave.content);
        tabToSave.path = savePath;
        tabToSave.savedContent = tabToSave.content;
        tabToSave.name = savePath.split(/[/\\]/).pop() || 'Untitled';
        tabToSave.language = getLanguageFromPath(savePath);
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  }

  async function closeTab(id: string, e?: MouseEvent) {
    if (e) e.stopPropagation();
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;
    
    const tab = tabs[index];
    if (tab.content !== tab.savedContent) {
      const confirmed = await ask(`Do you want to save the changes you made to ${tab.name}?`, {
        title: 'Unsaved Changes',
        kind: 'warning',
        okLabel: 'Discard',
        cancelLabel: 'Cancel'
      });
      if (!confirmed) return;
    }

    const newTabs = [...tabs];
    newTabs.splice(index, 1);
    
    if (activeTabId === id) {
      if (newTabs.length > 0) activeTabId = newTabs[Math.max(0, index - 1)].id;
      else activeTabId = null;
    }
    if (rightActiveTabId === id) {
      if (newTabs.length > 0) rightActiveTabId = newTabs[Math.max(0, index - 1)].id;
      else rightActiveTabId = null;
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
    if (activeGroup === 'left') activeTabId = newTab.id;
    else rightActiveTabId = newTab.id;
  }

  async function handleExit() {
    const hasUnsaved = tabs.some(t => t.content !== t.savedContent);
    if (hasUnsaved) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to exit?')) {
        return;
      }
    }
    const win = getCurrentWindow();
    await win.close();
  }

  function cycleTabs(reverse = false) {
    if (tabs.length <= 1) return;
    const currentId = activeGroup === 'left' ? activeTabId : rightActiveTabId;
    const currentIndex = tabs.findIndex(t => t.id === currentId);
    let nextIndex;
    if (reverse) {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else {
      nextIndex = (currentIndex + 1) % tabs.length;
    }
    if (activeGroup === 'left') activeTabId = tabs[nextIndex].id;
    else rightActiveTabId = tabs[nextIndex].id;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault();
      cycleTabs(e.shiftKey);
      return;
    }
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault();
      showTerminal = !showTerminal;
      return;
    }
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      showSettings = true;
      return;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      showLeftSidebar = true;
      leftSidebarMode = 'search';
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        paletteMode = e.shiftKey ? 'command' : 'file';
        showPalette = true;
        return;
      }
      switch (e.key.toLowerCase()) {
        case 's': e.preventDefault(); handleSave(); break;
        case 'w': e.preventDefault(); 
          if (activeGroup === 'left' && activeTabId) closeTab(activeTabId);
          else if (activeGroup === 'right' && rightActiveTabId) closeTab(rightActiveTabId);
          break;
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
  let isResizingTerminal = false;

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

  function startResizeTerminal(e: MouseEvent) {
    isResizingTerminal = true;
    window.addEventListener('mousemove', handleResizeTerminal);
    window.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'row-resize';
  }

  function handleResizeLeft(e: MouseEvent) {
    if (!isResizingLeft) return;
    leftSidebarWidth = Math.max(150, Math.min(e.clientX, 600));
  }

  function handleResizeRight(e: MouseEvent) {
    if (!isResizingRight) return;
    rightSidebarWidth = Math.max(150, Math.min(window.innerWidth - e.clientX, 600));
  }

  function handleResizeTerminal(e: MouseEvent) {
    if (!isResizingTerminal) return;
    const newHeight = window.innerHeight - e.clientY - 57;
    terminalHeight = Math.max(100, Math.min(newHeight, window.innerHeight * 0.8));
  }

  function stopResize() {
    isResizingLeft = false; isResizingRight = false; isResizingTerminal = false;
    window.removeEventListener('mousemove', handleResizeLeft);
    window.removeEventListener('mousemove', handleResizeRight);
    window.removeEventListener('mousemove', handleResizeTerminal);
    window.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = 'default';
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('meerkat-theme', isDarkMode ? 'dark' : 'light');
  }

  function saveSession() {
    const session = {
      rootPath,
      openPaths: tabs.map(t => t.path).filter(p => p !== null),
      activePath: activeTab?.path || null,
      rightActivePath: rightActiveTab?.path || null,
      isEditorSplit,
      fontSize, tabSize, insertSpaces, wordWrap
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
        if (session.fontSize) fontSize = session.fontSize;
        if (session.tabSize) tabSize = session.tabSize;
        if (session.insertSpaces !== undefined) insertSpaces = session.insertSpaces;
        if (session.wordWrap !== undefined) wordWrap = session.wordWrap;

        if (session.openPaths) {
          for (const path of session.openPaths) {
            await openFile(path, true);
          }
        }
        if (session.activePath) {
          const tab = tabs.find(t => t.path === session.activePath);
          if (tab) activeTabId = tab.id;
        }
        if (session.isEditorSplit) {
          isEditorSplit = true;
          if (session.rightActivePath) {
            const tab = tabs.find(t => t.path === session.rightActivePath);
            if (tab) rightActiveTabId = tab.id;
          }
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

  $effect(() => {
    if (autoSave && activeTab && activeTab.path && activeTab.content !== activeTab.savedContent) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        handleSave();
      }, autoSaveDelay);
    }
    return () => { if (autoSaveTimer) clearTimeout(autoSaveTimer); };
  });
</script>

<div class="app-container" class:dark={isDarkMode}>
  <MenuBar 
    onNew={createNewFile}
    onOpen={handleOpen}
    onSave={handleSave}
    onExit={handleExit}
    onToggleExplorer={() => { showLeftSidebar = !showLeftSidebar; leftSidebarMode = 'explorer'; }}
    onToggleAgent={() => showRightSidebar = !showRightSidebar}
    onToggleTerminal={() => showTerminal = !showTerminal}
    onCloseTab={() => activeTabId && closeTab(activeTabId)}
    {autoSave}
    onToggleAutoSave={() => autoSave = !autoSave}
    {wordWrap}
    onToggleWordWrap={() => wordWrap = !wordWrap}
    {tabSize}
    {insertSpaces}
    onChangeTabSize={(size) => tabSize = size}
    onToggleInsertSpaces={() => insertSpaces = !insertSpaces}
  />

  <main>
    <div class="app-layout">
      <div class="sidebar-wrapper" style="width: {leftSidebarWidth}px; display: {showLeftSidebar ? 'flex' : 'none'}">
        <div class="activity-bar">
          <button class="activity-btn" class:active={leftSidebarMode === 'explorer'} onclick={() => leftSidebarMode = 'explorer'} title="Explorer">
            <FileIcon size={20} />
          </button>
          <button class="activity-btn" class:active={leftSidebarMode === 'search'} onclick={() => leftSidebarMode = 'search'} title="Search (Ctrl+Shift+F)">
            <SearchIcon size={20} />
          </button>
        </div>
        <Sidebar title={leftSidebarMode === 'explorer' ? "Explorer" : "Search"}>
          {#snippet actions()}
            {#if leftSidebarMode === 'explorer'}
              <button class="icon-btn" onclick={() => fileTree?.startCreate('file')} title="New File"><FilePlus size={14}/></button>
              <button class="icon-btn" onclick={() => fileTree?.startCreate('folder')} title="New Folder"><FolderPlus size={14}/></button>
              <button class="icon-btn" onclick={() => rootPath = rootPath} title="Refresh"><RefreshCw size={14}/></button>
            {/if}
          {/snippet}
          
          {#if leftSidebarMode === 'explorer'}
            <FileTree 
              bind:this={fileTree} 
              {rootPath} 
              onFileSelect={openFile} 
              onRename={handleFileRename}
              onDelete={handleFileDelete}
              onFileChange={handleFileChange}
            />
          {:else}
            <SearchPanel 
              {rootPath} 
              onResultSelect={async (path, line, col) => {
                await openFile(path);
                editorScrollToLine = line;
                cursorPos = { lineNumber: line, column: col };
                setTimeout(() => editorScrollToLine = null, 100);
              }}
              onFileReplaced={async (path) => {
                const normalizedTarget = normalizePath(path);
                const tabIndex = tabs.findIndex(t => normalizePath(t.path) === normalizedTarget);
                if (tabIndex !== -1) {
                  const content = await readTextFile(path);
                  tabs[tabIndex] = {
                    ...tabs[tabIndex],
                    content,
                    savedContent: content
                  };
                }
              }}
            />
          {/if}
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
                  class:active={(activeGroup === 'left' && activeTabId === tab.id) || (activeGroup === 'right' && rightActiveTabId === tab.id)}
                  onclick={() => { 
                    if (activeGroup === 'left') activeTabId = tab.id;
                    else rightActiveTabId = tab.id;
                  }}
                >
                  <span class="tab-name" title={tab.path || 'Untitled'}>{tab.name}</span>
                  {#if tab.content !== tab.savedContent}
                    <span class="dirty-indicator">●</span>
                  {:else}
                    <span class="dirty-indicator"></span>
                  {/if}
                  <span class="close-btn" role="button" tabindex="0" onclick={(e) => closeTab(tab.id, e)} onkeydown={(e) => e.key === 'Enter' && closeTab(tab.id)}>×</span>
                </button>
              {/each}
            </div>
            <div class="tab-actions">
              <button class="icon-btn" class:active={showDiff} onclick={() => showDiff = !showDiff} title="Toggle Diff View"><FileDiff size={14}/></button>
              <button class="icon-btn" onclick={toggleSplitEditor} title="Split Editor"><SplitSquareHorizontal size={14}/></button>
              <button class="icon-btn" onclick={toggleTheme} title="Toggle Theme">{#if isDarkMode}<Sun size={14}/>{:else}<Moon size={14}/>{/if}</button>
              <button class="icon-btn" onclick={() => showSettings = true} title="Settings (Ctrl+,)"><SettingsIcon size={14}/></button>
              <button class="icon-btn" onclick={() => showLeftSidebar = !showLeftSidebar} title="Toggle Explorer"><PanelLeft size={14}/></button>
              <button class="icon-btn" onclick={() => showRightSidebar = !showRightSidebar} title="Toggle Agent"><PanelRight size={14}/></button>
            </div>
          </div>

          <div class="editors-container">
            <div class="editor-wrapper" onclick={() => activeGroup = 'left'} style="border-right: {isEditorSplit ? '1px solid var(--border)' : 'none'}">
              {#if activeTab}
                <div class="editor-group-header" class:active={activeGroup === 'left'}>
                  <Breadcrumbs path={activeTab.path} {rootPath} />
                </div>
                {#if showDiff}
                  <DiffViewer originalValue={activeTab.savedContent} modifiedValue={activeTab.content} language={activeTab.language} {isDarkMode} {fontSize} />
                {:else}
                  {#key activeTab.id}
                    <MonacoEditor bind:value={activeTab.content} language={activeTab.language} {isDarkMode} bind:wordWrap {tabSize} {insertSpaces} {fontSize} scrollToLine={activeGroup === 'left' ? editorScrollToLine : null} onCursorChange={(pos) => { if (activeGroup === 'left') cursorPos = pos; }} />
                  {/key}
                {/if}
              {/if}
            </div>

            {#if isEditorSplit}
              <div class="editor-wrapper" onclick={() => activeGroup = 'right'}>
                {#if rightActiveTab}
                  <div class="editor-group-header" class:active={activeGroup === 'right'}>
                    <Breadcrumbs path={rightActiveTab.path} {rootPath} />
                  </div>
                  {#if showDiff}
                    <DiffViewer originalValue={rightActiveTab.savedContent} modifiedValue={rightActiveTab.content} language={rightActiveTab.language} {isDarkMode} {fontSize} />
                  {:else}
                    {#key rightActiveTab.id}
                      <MonacoEditor bind:value={rightActiveTab.content} language={rightActiveTab.language} {isDarkMode} bind:wordWrap {tabSize} {insertSpaces} {fontSize} scrollToLine={activeGroup === 'right' ? editorScrollToLine : null} onCursorChange={(pos) => { if (activeGroup === 'right') cursorPos = pos; }} />
                    {/key}
                  {/if}
                {:else}
                  <div class="empty-editor" onclick={() => activeGroup = 'right'}>No file selected in split</div>
                {/if}
              </div>
            {/if}
          </div>
        {:else}
          <WelcomeScreen onNewFile={createNewFile} onOpenFile={handleOpen} onOpenFolder={() => handleOpenFolder()} recentProjects={recentProjects} onOpenRecent={handleOpenFolder} />
        {/if}

        {#if showTerminal}
          <div class="resize-handle horizontal" onmousedown={startResizeTerminal} role="separator" aria-orientation="horizontal"></div>
          <div class="terminal-wrapper" style="height: {terminalHeight}px">
            <TerminalPanel onClose={() => showTerminal = false} />
          </div>
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

  <StatusBar lineNumber={cursorPos.lineNumber} column={cursorPos.column} language={(activeGroup === 'left' ? activeTab?.language : rightActiveTab?.language) || "plain text"} indentation={(insertSpaces ? "Spaces: " : "Tabs: ") + tabSize} branch={gitBranch} />

  <CommandPalette bind:show={showPalette} bind:mode={paletteMode} {commands} files={projectFiles} onSelect={handlePaletteSelect} />

  <SettingsModal bind:show={showSettings} bind:fontSize bind:tabSize bind:insertSpaces bind:wordWrap bind:autoSave bind:autoSaveDelay />
</div>

<style>
  :global(body, html) { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background-color: var(--background); color: var(--foreground); font-family: var(--font-sans); }
  .app-container { height: 100vh; width: 100vw; display: flex; flex-direction: column; background-color: var(--background); color: var(--foreground); overflow: hidden; }
  main { height: calc(100vh - 57px); width: 100vw; flex: 1; overflow: hidden; }
  .app-layout { display: flex; height: 100%; width: 100%; overflow: hidden; }
  .center-content { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; background-color: var(--background); position: relative; }
  .sidebar-wrapper { position: relative; height: 100%; display: flex; flex-shrink: 0; }
  .activity-bar { width: 48px; height: 100%; background-color: var(--muted); border-right: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; padding-top: 8px; gap: 12px; }
  .activity-btn { background: transparent; border: none; color: var(--muted-foreground); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: var(--radius-md); opacity: 0.7; transition: all 0.2s; }
  .activity-btn:hover { color: var(--foreground); opacity: 1; }
  .activity-btn.active { color: var(--foreground); opacity: 1; background-color: var(--accent); }
  .resize-handle { position: absolute; top: 0; width: 4px; height: 100%; cursor: col-resize; z-index: 10; transition: background-color 0.2s; }
  .resize-handle:hover { background-color: var(--accent); }
  .resize-handle.left { right: -2px; }
  .resize-handle.right { left: -2px; }
  .resize-handle.horizontal { width: 100%; height: 4px; cursor: row-resize; position: relative; top: auto; left: auto; right: auto; z-index: 10; }
  .terminal-wrapper { display: flex; flex-direction: column; width: 100%; flex-shrink: 0; border-top: 1px solid var(--border); }
  .icon-btn { background: transparent; border: none; color: var(--foreground); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: var(--radius-sm); opacity: 0.6; transition: all 0.2s; }
  .icon-btn:hover:not(:disabled) { background-color: var(--accent); opacity: 1; }
  .icon-btn.active { background-color: var(--accent); opacity: 1; }
  .icon-btn:disabled { opacity: 0.2; cursor: not-allowed; }
  .tab-bar { height: 35px; background-color: var(--muted); display: flex; align-items: center; border-bottom: 1px solid var(--border); padding-right: 8px; }
  .tabs-scroll { flex: 1; display: flex; height: 100%; overflow-x: auto; scrollbar-width: none; }
  .tabs-scroll::-webkit-scrollbar { display: none; }
  .tab-actions { display: flex; align-items: center; gap: 4px; padding-left: 8px; border-left: 1px solid var(--border); }
  .tab { display: flex; align-items: center; padding: 0 12px; min-width: 120px; max-width: 200px; height: 100%; background-color: var(--muted); border: none; border-right: 1px solid var(--border); color: var(--muted-foreground); cursor: pointer; font-size: 12px; transition: all 0.2s; }
  .tab.active { background-color: var(--background); color: var(--foreground); }
  .tab:hover:not(.active) { background-color: var(--accent); color: var(--accent-foreground); }
  .tab-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
  .dirty-indicator { margin: 0 5px; width: 8px; height: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--primary); }
  .close-btn { margin-left: 8px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); font-size: 14px; opacity: 0.5; }
  .close-btn:hover { background-color: var(--accent); color: var(--foreground); opacity: 1; }
  .editors-container { flex: 1; display: flex; overflow: hidden; width: 100%; }
  .editor-wrapper { flex: 1; overflow: hidden; background-color: var(--background); display: flex; flex-direction: column; min-width: 0; }
  .editor-group-header { opacity: 0.5; transition: opacity 0.2s; }
  .editor-group-header.active { opacity: 1; }
  .empty-editor { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted-foreground); font-size: 14px; opacity: 0.5; }
</style>
