<script lang="ts">
  let { 
    lineNumber = 1, 
    column = 1, 
    language = "Plain Text",
    encoding = "UTF-8",
    indentation = "Spaces: 2"
  } = $props<{
    lineNumber?: number;
    column?: number;
    language?: string;
    encoding?: string;
    indentation?: string;
  }>();
</script>

<div class="status-bar">
  <div class="status-left">
    <div class="status-item">
      <span>Ln {lineNumber}, Col {column}</span>
    </div>
  </div>
  
  <div class="status-right">
    <div class="status-item clickable">
      <span>{indentation}</span>
    </div>
    <div class="status-item clickable">
      <span>{encoding}</span>
    </div>
    <div class="status-item clickable">
      <span class="capitalize">{language}</span>
    </div>
  </div>
</div>

<style>
  .status-bar {
    height: 22px;
    background-color: var(--background);
    color: var(--muted-foreground);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-size: 11px;
    user-select: none;
    border-top: 1px solid rgba(128, 128, 128, 0.15);
    opacity: 0.9;
  }

  .status-left, .status-right {
    display: flex;
    align-items: center;
    height: 100%;
  }

  .status-item {
    display: flex;
    align-items: center;
    padding: 0 8px;
    height: 100%;
    transition: all 0.2s;
  }

  .status-item.clickable:hover {
    background-color: var(--accent);
    color: var(--foreground);
    cursor: pointer;
  }

  .capitalize {
    text-transform: capitalize;
  }
</style>
