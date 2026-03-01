<script lang="ts">
  import { onMount } from 'svelte';
  import { File, Folder, ChevronRight, ChevronDown, Loader2, Edit2, Trash2, FolderPlus, FilePlus, Scissors, ClipboardPaste } from '@lucide/svelte';
  import { readDir, mkdir, writeTextFile, rename, remove, watch } from '@tauri-apps/plugin-fs';
  import { join, dirname, basename } from '@tauri-apps/api/path';

  interface TreeItem {
    name: string;
    path: string;
    isDirectory: boolean;
    isOpen: boolean;
    children: TreeItem[];
    isLoading: boolean;
  }

  let { rootPath, onFileSelect, onRename, onDelete } = $props<{
    rootPath: string | null;
    onFileSelect: (path: string) => void;
    onRename?: (oldPath: string, newPath: string) => void;
    onDelete?: (path: string) => void;
  }>();

  let tree = $state<TreeItem[]>([]);
  let renamingPath = $state<string | null>(null);
  let renameValue = $state("");
  let creatingInPath = $state<{path: string, type: 'file' | 'folder'} | null>(null);
  let newValue = $state("");
  let selectedPath = $state<string | null>(null);
  let contextMenu = $state<{ x: number, y: number, item: TreeItem | null } | null>(null);
  
  // Cut/Paste state
  let clipboardPath = $state<string | null>(null);
  
  let isActionInProgress = false;
  let unwatch: (() => void) | null = null;

  async function setupWatcher(path: string) {
    if (unwatch) { unwatch(); unwatch = null; }
    try {
      const stop = await watch(path, (event) => {
        if (isActionInProgress) return;
        const type = JSON.stringify(event).toLowerCase();
        if (type.includes('create') || type.includes('remove') || type.includes('rename')) {
          refresh();
        }
      }, { recursive: true });
      unwatch = stop;
    } catch (err) {
      console.error("[FileTree] Watch error:", err);
    }
  }

  async function fetchChildren(path: string): Promise<TreeItem[]> {
    try {
      const entries = await readDir(path);
      const items: TreeItem[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.gitignore') continue;
        const fullPath = await join(path, entry.name);
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory,
          isOpen: false,
          children: [],
          isLoading: false
        });
      }
      return items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      console.error("[FileTree] Error reading directory:", path, err);
      return [];
    }
  }

  async function syncOpenStates(oldItems: TreeItem[], newItems: TreeItem[]) {
    for (const newItem of newItems) {
      const oldItem = oldItems.find(i => i.path === newItem.path);
      if (oldItem) {
        newItem.isOpen = oldItem.isOpen;
        if (newItem.isOpen && newItem.isDirectory) {
          newItem.children = await fetchChildren(newItem.path);
          await syncOpenStates(oldItem.children, newItem.children);
        }
      }
    }
  }

  async function refresh() {
    if (!rootPath) return;
    const newTree = await fetchChildren(rootPath);
    await syncOpenStates(tree, newTree);
    tree = newTree;
  }

  $effect(() => {
    if (rootPath) {
      refresh();
      setupWatcher(rootPath);
    } else {
      tree = [];
      if (unwatch) { unwatch(); unwatch = null; }
    }
    return () => { if (unwatch) { unwatch(); unwatch = null; } };
  });

  async function handleToggle(item: TreeItem, e?: MouseEvent | KeyboardEvent) {
    e?.stopPropagation();
    selectedPath = item.path;
    if (!item.isDirectory) {
      onFileSelect(item.path);
      return;
    }
    item.isOpen = !item.isOpen;
    if (item.isOpen && (item.children.length === 0 || item.isLoading)) {
      item.isLoading = true;
      item.children = await fetchChildren(item.path);
      item.isLoading = false;
    }
  }

  function handleContextMenu(e: MouseEvent, item: TreeItem | null) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, item };
    if (item) selectedPath = item.path;
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function startRename(item: TreeItem, e?: MouseEvent) {
    e?.stopPropagation();
    renamingPath = item.path;
    renameValue = item.name;
    isActionInProgress = false;
    closeContextMenu();
  }

  async function commitRename() {
    if (!renamingPath || isActionInProgress) return;
    const name = renameValue.trim();
    const oldPath = renamingPath;
    
    if (!name) {
      renamingPath = null;
      return;
    }

    isActionInProgress = true;
    try {
      const oldName = await basename(oldPath);
      if (name !== oldName) {
        const dir = await dirname(oldPath);
        const newPath = await join(dir, name);
        await rename(oldPath, newPath);
        onRename?.(oldPath, newPath);
      }
    } catch (err) {
      console.error("Rename error:", err);
    } finally {
      renamingPath = null;
      isActionInProgress = false;
      await refresh();
    }
  }

  export async function startCreate(type: 'file' | 'folder', targetPath?: string) {
    let base = targetPath || selectedPath || rootPath;
    if (!base) return;
    
    const findItem = (items: TreeItem[], path: string): TreeItem | null => {
      for (const item of items) {
        if (item.path === path) return item;
        const found = findItem(item.children, path);
        if (found) return found;
      }
      return null;
    };

    let item = findItem(tree, base);
    if (base !== rootPath && item && !item.isDirectory) {
      base = await dirname(base);
      item = findItem(tree, base);
    }

    if (item && item.isDirectory) {
      item.isOpen = true;
      if (item.children.length === 0) {
        item.isLoading = true;
        item.children = await fetchChildren(item.path);
        item.isLoading = false;
      }
    }

    creatingInPath = { path: base, type };
    newValue = "";
    closeContextMenu();
  }

  async function commitCreate() {
    if (!creatingInPath || isActionInProgress) return;
    const name = newValue.trim();
    const { path: base, type } = creatingInPath;

    if (!name) {
      creatingInPath = null;
      return;
    }

    isActionInProgress = true;
    try {
      const target = await join(base, name);
      if (type === 'file') {
        await writeTextFile(target, "");
      } else {
        await mkdir(target);
      }
    } catch (err) {
      console.error("Create error:", err);
    } finally {
      creatingInPath = null;
      newValue = "";
      isActionInProgress = false;
      await refresh();
    }
  }

  async function handleDelete(item: TreeItem) {
    isActionInProgress = true;
    try {
      await remove(item.path, { recursive: true });
      onDelete?.(item.path);
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      closeContextMenu();
      isActionInProgress = false;
      await refresh();
    }
  }

  function handleCut(item: TreeItem) {
    clipboardPath = item.path;
    closeContextMenu();
  }

  async function handlePaste(targetItem: TreeItem | null) {
    if (!clipboardPath) return;
    
    const sourcePath = clipboardPath;
    const isRoot = !targetItem;
    const targetPath = isRoot ? rootPath! : targetItem!.path;
    const isDir = isRoot || targetItem!.isDirectory;
    const destDir = isDir ? targetPath : await dirname(targetPath);
    
    if (sourcePath === destDir) {
      clipboardPath = null;
      closeContextMenu();
      return;
    }

    isActionInProgress = true;
    try {
      const fileName = await basename(sourcePath);
      const newPath = await join(destDir, fileName);
      if (sourcePath !== newPath) {
        await rename(sourcePath, newPath);
        onRename?.(sourcePath, newPath);
      }
    } catch (err) {
      console.error("Paste error:", err);
    } finally {
      clipboardPath = null;
      isActionInProgress = false;
      closeContextMenu();
      await refresh();
    }
  }

  let draggedPath = $state<string | null>(null);

  function onDragStart(e: DragEvent, path: string) {
    draggedPath = path;
    if (e.dataTransfer) {
      e.dataTransfer.setData("text/plain", path);
      e.dataTransfer.effectAllowed = "move";
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  }

  async function onDrop(e: DragEvent, targetPath: string, isDirectory: boolean) {
    e.preventDefault();
    e.stopPropagation();
    
    const sourcePath = draggedPath || e.dataTransfer?.getData("text/plain");
    if (!sourcePath || sourcePath === targetPath) {
      draggedPath = null;
      return;
    }

    isActionInProgress = true;
    try {
      const fileName = await basename(sourcePath);
      const destDir = isDirectory ? targetPath : await dirname(targetPath);
      const sourceDir = await dirname(sourcePath);
      
      if (destDir !== sourceDir) {
        const newPath = await join(destDir, fileName);
        await rename(sourcePath, newPath);
        onRename?.(sourcePath, newPath);
      }
    } catch (err) {
      console.error("Move error:", err);
    } finally {
      draggedPath = null;
      isActionInProgress = false;
      await refresh();
    }
  }

  function focus(node: HTMLInputElement) {
    node.focus();
    if (renamingPath) node.select();
  }

  onMount(() => {
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="file-tree" 
  oncontextmenu={(e) => handleContextMenu(e, null)} 
  ondragover={onDragOver}
  ondrop={(e) => rootPath && onDrop(e, rootPath, true)}
  role="tree" 
  tabindex="-1"
>
  {#if rootPath}
    <div class="tree-container">
      {#if creatingInPath && creatingInPath.path === rootPath}
        <div class="tree-row input-row">
          <span class="chevron-spacer"></span>
          <input 
            bind:value={newValue} 
            onblur={() => { if (!isActionInProgress) creatingInPath = null; }}
            onkeydown={(e) => { 
              if (e.key === 'Enter') { e.preventDefault(); commitCreate(); }
              else if (e.key === 'Escape') { e.preventDefault(); creatingInPath = null; }
            }}
            use:focus
          />
        </div>
      {/if}
      {#each tree as item (item.path)}
        {@render treeNode(item, 0)}
      {/each}
    </div>
  {:else}
    <div class="empty-tree">No folder opened</div>
  {/if}

  {#if contextMenu}
    <div class="context-menu" style="top: {contextMenu.y}px; left: {contextMenu.x}px">
      {#if !contextMenu.item || contextMenu.item.isDirectory}
        <button onclick={() => startCreate('file')}><FilePlus size={14}/> New File</button>
        <button onclick={() => startCreate('folder')}><FolderPlus size={14}/> New Folder</button>
        <div class="divider"></div>
      {/if}
      
      {#if contextMenu.item}
        <button onclick={() => handleCut(contextMenu!.item!)}><Scissors size={14}/> Cut</button>
      {/if}
      
      <button disabled={!clipboardPath} onclick={() => handlePaste(contextMenu!.item)}><ClipboardPaste size={14}/> Paste</button>
      
      {#if contextMenu.item}
        <div class="divider"></div>
        <button onclick={() => startRename(contextMenu!.item!)}><Edit2 size={14}/> Rename</button>
        <button class="delete" onclick={() => handleDelete(contextMenu!.item!)}><Trash2 size={14}/> Delete</button>
      {/if}
    </div>
  {/if}
</div>

{#snippet treeNode(item: TreeItem, depth: number)}
  <div 
    class="tree-row" 
    class:renaming={renamingPath === item.path}
    class:selected={selectedPath === item.path}
    class:is-cut={clipboardPath === item.path}
    style="padding-left: {depth * 12 + 12}px"
    onclick={(e) => handleToggle(item, e)}
    oncontextmenu={(e) => handleContextMenu(e, item)}
    onkeydown={(e) => e.key === 'Enter' && handleToggle(item, e)}
    role="treeitem"
    aria-expanded={item.isDirectory ? item.isOpen : undefined}
    aria-selected={selectedPath === item.path}
    tabindex="0"
    draggable="true"
    ondragstart={(e) => onDragStart(e, item.path)}
    ondrop={(e) => onDrop(e, item.path, item.isDirectory)}
    ondragover={onDragOver}
  >
    <div class="row-content">
      {#if item.isDirectory}
        <span class="chevron">
          {#if item.isLoading}
            <Loader2 size={12} class="spin-icon" />
          {:else if item.isOpen}
            <ChevronDown size={14} />
          {:else}
            <ChevronRight size={14} />
          {/if}
        </span>
        <Folder size={14} class="folder-icon" />
      {:else}
        <span class="chevron-spacer"></span>
        <File size={14} class="file-icon" />
      {/if}
      
      {#if renamingPath === item.path}
        <input 
          class="rename-input"
          bind:value={renameValue}
          onblur={() => { if (!isActionInProgress) renamingPath = null; }}
          onkeydown={(e) => { 
            if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
            else if (e.key === 'Escape') { e.preventDefault(); renamingPath = null; }
          }}
          onclick={(e) => e.stopPropagation()}
          use:focus
        />
      {:else}
        <span class="name" title={item.path}>{item.name}</span>
      {/if}
    </div>
  </div>

  {#if item.isDirectory && item.isOpen}
    <div class="subtree" role="group">
      {#if creatingInPath && creatingInPath.path === item.path}
        <div class="tree-row input-row" style="padding-left: {(depth + 1) * 12 + 12}px">
          <span class="chevron-spacer"></span>
          <Folder size={14} class="folder-icon" style="opacity: 0.5" />
          <input 
            bind:value={newValue} 
            onblur={() => { if (!isActionInProgress) creatingInPath = null; }}
            onkeydown={(e) => { 
              if (e.key === 'Enter') { e.preventDefault(); commitCreate(); }
              else if (e.key === 'Escape') { e.preventDefault(); creatingInPath = null; }
            }}
            use:focus
          />
        </div>
      {/if}
      {#each item.children as child (child.path)}
        {@render treeNode(child, depth + 1)}
      {/each}
    </div>
  {/if}
{/snippet}

<style>
  .file-tree {
    height: 100%;
    overflow: auto;
    background-color: var(--sidebar);
    color: var(--sidebar-foreground);
    user-select: none;
    position: relative;
  }

  .tree-container { padding: 8px 0; min-height: 100%; }

  .tree-row {
    height: 24px;
    display: flex;
    align-items: center;
    cursor: pointer;
    outline: none;
    position: relative;
    border: 1px solid transparent;
  }

  .tree-row:hover { background-color: var(--sidebar-accent); color: var(--sidebar-accent-foreground); }
  .tree-row.selected { background-color: var(--accent); color: var(--accent-foreground); }
  .tree-row.is-cut { opacity: 0.5; filter: grayscale(0.5); }

  .row-content {
    display: flex;
    align-items: center;
    width: 100%;
    overflow: hidden;
    padding-right: 8px;
  }

  .chevron {
    width: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 4px;
    flex-shrink: 0;
    opacity: 0.5;
  }

  .chevron-spacer { width: 20px; flex-shrink: 0; }

  :global(.folder-icon) { color: var(--color-chart-2); margin-right: 6px; flex-shrink: 0; }
  :global(.file-icon) { color: var(--sidebar-foreground); opacity: 0.6; margin-right: 6px; flex-shrink: 0; }

  .name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }

  .rename-input, .input-row input {
    background: var(--background);
    border: 1px solid var(--primary);
    color: var(--foreground);
    font-size: 12px;
    padding: 0 4px;
    width: 100%;
    outline: none;
    border-radius: 2px;
    height: 20px;
  }

  .empty-tree { padding: 40px 20px; font-size: 12px; text-align: center; opacity: 0.5; }
  .spin-icon { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .subtree { display: block; }

  .context-menu {
    position: fixed;
    background: var(--popover);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: 4px;
    z-index: 1000;
    min-width: 160px;
  }

  .context-menu button {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--popover-foreground);
    padding: 6px 12px;
    font-size: 12px;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }

  .context-menu button:hover { background: var(--accent); color: var(--accent-foreground); }
  .context-menu button:disabled { opacity: 0.3; cursor: default; }
  .context-menu button.delete:hover { background: #e81123; color: white; }

  .divider { height: 1px; background: var(--border); margin: 4px 0; }
</style>
