<script lang="ts">
  import { ChevronRight, File, Folder } from '@lucide/svelte';

  let { path, rootPath } = $props<{
    path: string | null;
    rootPath: string | null;
  }>();

  let parts = $derived.by(() => {
    if (!path) return [];
    
    // Normalize path to use same separators
    const normalizedPath = path.replace(/\\/g, '/');
    const normalizedRoot = rootPath ? rootPath.replace(/\\/g, '/') : null;
    
    let relativePath = normalizedPath;
    if (normalizedRoot && normalizedPath.startsWith(normalizedRoot)) {
      relativePath = normalizedPath.slice(normalizedRoot.length);
    }
    
    return relativePath.split('/').filter(p => p !== "");
  });
</script>

<div class="breadcrumbs">
  {#if path}
    <div class="breadcrumb-item">
      <Folder size={12} class="folder-icon" />
      <span>{rootPath ? rootPath.split(/[/\\]/).pop() : 'root'}</span>
    </div>
    
    {#each parts as part, i}
      <ChevronRight size={12} class="separator" />
      <div class="breadcrumb-item">
        {#if i === parts.length - 1}
          <File size={12} class="file-icon" />
        {:else}
          <Folder size={12} class="folder-icon" />
        {/if}
        <span>{part}</span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .breadcrumbs {
    height: 28px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    background-color: var(--background);
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    color: var(--muted-foreground);
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: none;
  }

  .breadcrumbs::-webkit-scrollbar { display: none; }

  .breadcrumb-item {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0.8;
    transition: opacity 0.2s;
  }

  .breadcrumb-item:hover {
    opacity: 1;
    color: var(--foreground);
    cursor: pointer;
  }

  .separator {
    margin: 0 4px;
    opacity: 0.4;
  }

  :global(.folder-icon) { color: var(--color-chart-2); }
  :global(.file-icon) { color: var(--muted-foreground); }
</style>
