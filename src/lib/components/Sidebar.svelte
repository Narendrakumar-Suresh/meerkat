<script lang="ts">
  let { title = "Sidebar", children, actions } = $props<{
    title?: string;
    children?: any;
    actions?: any;
  }>();
</script>

<div class="sidebar">
  <div class="sidebar-header">
    <span class="title">{title}</span>
    <div class="actions">
      {@render actions?.()}
    </div>
  </div>
  <div class="sidebar-content">
    {@render children?.()}
  </div>
</div>

<style>
  .sidebar {
    width: 100%;
    height: 100%;
    background-color: var(--sidebar);
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--sidebar-border);
  }

  .sidebar-header {
    height: 35px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    background-color: var(--sidebar);
    border-bottom: 1px solid var(--sidebar-border);
  }

  .title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--sidebar-foreground);
    opacity: 0.7;
    font-weight: 600;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .sidebar-content {
    flex: 1;
    overflow: auto;
    color: var(--sidebar-foreground);
    font-size: 13px;
  }
</style>
