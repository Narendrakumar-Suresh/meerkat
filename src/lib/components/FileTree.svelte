<script lang="ts">
  import { File, Folder, ChevronRight, ChevronDown, Loader2 } from '@lucide/svelte';
  import { readDir } from '@tauri-apps/plugin-fs';
  import { join } from '@tauri-apps/api/path';

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

  // The entire tree is a single reactive state
  let tree = $state<TreeItem[]>([]);

  async function fetchChildren(path: string): Promise<TreeItem[]> {
    try {
      console.log("[FileTree] Fetching:", path);
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

  // Handle root path changes
  $effect(() => {
    if (rootPath) {
      console.log("[FileTree] Root path changed:", rootPath);
      fetchChildren(rootPath).then(res => {
        tree = res;
      });
    } else {
      tree = [];
    }
  });

  async function handleToggle(item: TreeItem, e: MouseEvent) {
    e.stopPropagation();
    
    if (!item.isDirectory) {
      console.log("[FileTree] Opening file:", item.path);
      onFileSelect(item.path);
      return;
    }

    item.isOpen = !item.isOpen;
    console.log("[FileTree] Toggling folder:", item.path, "isOpen:", item.isOpen);

    if (item.isOpen && item.children.length === 0) {
      item.isLoading = true;
      item.children = await fetchChildren(item.path);
      item.isLoading = false;
    }
  }
</script>

<div class="file-tree">
  {#if rootPath}
    <div class="tree-container">
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
    style="padding-left: {depth * 12 + 12}px"
    onclick={(e) => handleToggle(item, e)}
    onkeydown={(e) => e.key === 'Enter' && handleToggle(item, e as any)}
    role="button"
    tabindex="0"
  >
    <div class="row-content">
      {#if item.isDirectory}
        <span class="chevron">
          {#if item.isLoading}
            <Loader2 size={12} class="spin" />
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
      <span class="name" title={item.path}>{item.name}</span>
    </div>
  </div>

  {#if item.isDirectory && item.isOpen}
    <div class="subtree">
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

  .tree-container {
    padding: 8px 0;
  }

  .tree-row {
    height: 24px;
    display: flex;
    align-items: center;
    cursor: pointer;
    outline: none;
  }

  .tree-row:hover {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
  }

  .row-content {
    display: flex;
    align-items: center;
    width: 100%;
    overflow: hidden;
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

  .chevron-spacer {
    width: 20px;
    flex-shrink: 0;
  }

  :global(.folder-icon) {
    color: var(--color-chart-2); /* Using a chart color for folder variety or we can use oklch directly */
    margin-right: 6px;
    flex-shrink: 0;
  }

  :global(.file-icon) {
    color: var(--sidebar-foreground);
    opacity: 0.6;
    margin-right: 6px;
    flex-shrink: 0;
  }

  .name {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-tree {
    padding: 40px 20px;
    font-size: 12px;
    text-align: center;
    opacity: 0.5;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .subtree {
    display: block;
  }
</style>
