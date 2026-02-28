<script lang="ts">
  import { File, Folder, ChevronRight, ChevronDown, Loader2, Edit2 } from '@lucide/svelte';
  import { readDir, mkdir, writeFile, rename } from '@tauri-apps/plugin-fs';
  import { join, dirname } from '@tauri-apps/api/path';

  interface TreeItem {
    name: string;
    path: string;
    isDirectory: boolean;
    isOpen: boolean;
    children: TreeItem[];
    isLoading: boolean;
  }

  let { rootPath, onFileSelect } = $props<{
    rootPath: string | null;
    onFileSelect: (path: string) => void;
  }>();

  let tree = $state<TreeItem[]>([]);
  let renamingPath = $state<string | null>(null);
  let renameValue = $state("");
  let creatingInPath = $state<{path: string, type: 'file' | 'folder'} | null>(null);
  let newValue = $state("");

  async function fetchChildren(path: string): Promise<TreeItem[]> {
    try {
      const entries = await readDir(path);
      const items: TreeItem[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
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

  async function refresh() {
    if (rootPath) {
      tree = await fetchChildren(rootPath);
    }
  }

  $effect(() => {
    if (rootPath) refresh();
    else tree = [];
  });

  async function handleToggle(item: TreeItem, e: MouseEvent) {
    e.stopPropagation();
    if (!item.isDirectory) {
      onFileSelect(item.path);
      return;
    }
    item.isOpen = !item.isOpen;
    if (item.isOpen && item.children.length === 0) {
      item.isLoading = true;
      item.children = await fetchChildren(item.path);
      item.isLoading = false;
    }
  }

  function startRename(item: TreeItem, e: MouseEvent) {
    e.stopPropagation();
    renamingPath = item.path;
    renameValue = item.name;
  }

  async function completeRename() {
    if (!renamingPath || !renameValue.trim()) {
      renamingPath = null;
      return;
    }
    try {
      const dir = await dirname(renamingPath);
      const newPath = await join(dir, renameValue.trim());
      await rename(renamingPath, newPath);
      renamingPath = null;
      refresh();
    } catch (err) {
      console.error("Rename error:", err);
    }
  }

  export async function startCreate(type: 'file' | 'folder', targetPath?: string) {
    const base = targetPath || rootPath;
    if (!base) return;
    creatingInPath = { path: base, type };
    newValue = "";
  }

  async function completeCreate() {
    if (!creatingInPath || !newValue.trim()) {
      creatingInPath = null;
      return;
    }
    try {
      const target = await join(creatingInPath.path, newValue.trim());
      if (creatingInPath.type === 'file') {
        await writeFile(target, new Uint8Array());
      } else {
        await mkdir(target);
      }
      creatingInPath = null;
      refresh();
    } catch (err) {
      console.error("Create error:", err);
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

  async function onDrop(e: DragEvent, targetPath: string, isDirectory: boolean) {
    e.preventDefault();
    const sourcePath = e.dataTransfer?.getData("text/plain") || draggedPath;
    if (!sourcePath || sourcePath === targetPath) return;

    try {
      const fileName = sourcePath.split(/[/\\]/).pop()!;
      const destDir = isDirectory ? targetPath : await dirname(targetPath);
      const newPath = await join(destDir, fileName);
      await rename(sourcePath, newPath);
      refresh();
    } catch (err) {
      console.error("Move error:", err);
    }
    draggedPath = null;
  }

  function focus(node: HTMLInputElement) {
    node.focus();
    if (renamingPath) node.select();
  }
</script>

<div class="file-tree" ondragover={(e) => e.preventDefault()} role="tree" tabindex="-1">
  {#if rootPath}
    <div class="tree-container">
      {#if creatingInPath && creatingInPath.path === rootPath}
        <div class="tree-row input-row">
          <span class="chevron-spacer"></span>
          <input 
            bind:value={newValue} 
            onblur={completeCreate}
            onkeydown={(e) => e.key === 'Enter' && completeCreate()}
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
</div>

{#snippet treeNode(item: TreeItem, depth: number)}
  <div 
    class="tree-row" 
    class:renaming={renamingPath === item.path}
    style="padding-left: {depth * 12 + 12}px"
    onclick={(e) => handleToggle(item, e)}
    onkeydown={(e) => e.key === 'Enter' && handleToggle(item, e as any)}
    role="treeitem"
    aria-expanded={item.isDirectory ? item.isOpen : undefined}
    tabindex="0"
    draggable="true"
    ondragstart={(e) => onDragStart(e, item.path)}
    ondrop={(e) => onDrop(e, item.path, item.isDirectory)}
    ondragover={(e) => e.preventDefault()}
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
          onblur={completeRename}
          onkeydown={(e) => e.key === 'Enter' && completeRename()}
          onclick={(e) => e.stopPropagation()}
          use:focus
        />
      {:else}
        <span class="name" title={item.path}>{item.name}</span>
        <div class="row-actions">
          <button onclick={(e) => startRename(item, e)} title="Rename"><Edit2 size={12}/></button>
        </div>
      {/if}
    </div>
  </div>

  {#if item.isDirectory && item.isOpen}
    <div class="subtree" role="group">
      {#if creatingInPath && creatingInPath.path === item.path}
        <div class="tree-row input-row" style="padding-left: {(depth + 1) * 12 + 12}px">
          <span class="chevron-spacer"></span>
          <input 
            bind:value={newValue} 
            onblur={completeCreate}
            onkeydown={(e) => e.key === 'Enter' && completeCreate()}
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
  }

  .tree-container { padding: 8px 0; }

  .tree-row {
    height: 24px;
    display: flex;
    align-items: center;
    cursor: pointer;
    outline: none;
    position: relative;
  }

  .tree-row:hover { background-color: var(--sidebar-accent); color: var(--sidebar-accent-foreground); }
  .tree-row:hover .row-actions { display: flex; }

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
  }

  .row-actions {
    display: none;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
  }

  .row-actions button {
    background: transparent;
    border: none;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 2px;
    border-radius: 2px;
  }

  .row-actions button:hover { background: var(--accent); color: var(--foreground); }

  .empty-tree { padding: 40px 20px; font-size: 12px; text-align: center; opacity: 0.5; }
  .spin-icon { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .subtree { display: block; }
</style>
