<script lang="ts">
  import { X } from '@lucide/svelte';

  let { 
    show = $bindable(false),
    fontSize = $bindable(14),
    tabSize = $bindable(2),
    insertSpaces = $bindable(true),
    wordWrap = $bindable(false),
    autoSave = $bindable(true),
    autoSaveDelay = $bindable(1000)
  } = $props<{
    show: boolean;
    fontSize: number;
    tabSize: number;
    insertSpaces: boolean;
    wordWrap: boolean;
    autoSave: boolean;
    autoSaveDelay: number;
  }>();

</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={() => show = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>Settings</h3>
        <button class="close-btn" onclick={() => show = false}><X size={16}/></button>
      </div>
      <div class="modal-content">
        <div class="setting-group">
          <h4>Editor</h4>
          
          <div class="setting-item">
            <label for="font-size">Font Size (px)</label>
            <input type="number" id="font-size" bind:value={fontSize} min="8" max="48" />
          </div>

          <div class="setting-item">
            <label for="tab-size">Tab Size</label>
            <input type="number" id="tab-size" bind:value={tabSize} min="2" max="8" step="2" />
          </div>

          <div class="setting-item checkbox-item">
            <input type="checkbox" id="insert-spaces" bind:checked={insertSpaces} />
            <label for="insert-spaces">Insert Spaces</label>
          </div>

          <div class="setting-item checkbox-item">
            <input type="checkbox" id="word-wrap" bind:checked={wordWrap} />
            <label for="word-wrap">Word Wrap</label>
          </div>
        </div>

        <div class="setting-group">
          <h4>Files</h4>
          
          <div class="setting-item checkbox-item">
            <input type="checkbox" id="auto-save" bind:checked={autoSave} />
            <label for="auto-save">Auto Save</label>
          </div>

          <div class="setting-item">
            <label for="auto-save-delay">Auto Save Delay (ms)</label>
            <input type="number" id="auto-save-delay" bind:value={autoSaveDelay} min="100" max="10000" disabled={!autoSave} />
          </div>
        </div>
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
    z-index: 3000;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .modal {
    width: 400px;
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background-color: var(--muted);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--muted-foreground);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: var(--radius-sm);
  }

  .close-btn:hover {
    background-color: var(--sidebar-accent);
    color: var(--foreground);
  }

  .modal-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-height: 60vh;
    overflow-y: auto;
  }

  .setting-group h4 {
    margin: 0 0 12px 0;
    font-size: 12px;
    text-transform: uppercase;
    opacity: 0.5;
    letter-spacing: 0.5px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 13px;
  }

  .setting-item.checkbox-item {
    justify-content: flex-start;
    gap: 8px;
  }

  input[type="number"] {
    background-color: var(--background);
    border: 1px solid var(--border);
    color: var(--foreground);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    width: 80px;
    font-size: 12px;
    outline: none;
  }

  input[type="number"]:focus {
    border-color: var(--primary);
  }

  input[type="number"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input[type="checkbox"] {
    accent-color: var(--primary);
  }
</style>
