<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Terminal } from "xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import "xterm/css/xterm.css";
  import {
    X,
    Plus,
    SplitSquareHorizontal,
    Trash2,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Play,
  } from "@lucide/svelte";
  import { Command, Child } from "@tauri-apps/plugin-shell";

  let { onClose } = $props<{ onClose: () => void }>();

  interface TermInstance {
    id: string;
    term: Terminal;
    fitAddon: FitAddon;
    container?: HTMLDivElement;
    title: string;
    child?: Child;
    status: "connecting" | "connected" | "error";
    errorMsg?: string;
  }

  interface TermGroup {
    id: string;
    instances: TermInstance[];
    activeInstanceId: string;
  }

  let termGroups = $state<TermGroup[]>([]);
  let activeGroupId = $state<string | null>(null);
  let termCounter = 1;
  let resizeObserver: ResizeObserver;

  async function spawnShell(instance: TermInstance) {
    const { term } = instance;
    instance.status = "connecting";

    try {
      console.log(`[Terminal] Spawning powershell for ${instance.id}`);
      const command = Command.create("powershell", ["-NoLogo"]);

      command.stdout.on("data", (data) => {
        term.write(data);
        if (instance.status !== "connected") instance.status = "connected";
      });

      command.stderr.on("data", (data) => {
        term.write(`\x1b[31m${data}\x1b[0m`);
      });

      command.on("error", (error) => {
        console.error("[Terminal] Runtime error:", error);
        instance.status = "error";
        instance.errorMsg = String(error);
        term.writeln(`\r\n\x1b[31mError: ${error}\x1b[0m`);
      });

      const child = await command.spawn();
      instance.child = child;
      instance.status = "connected";

      let currentLine = "";
      term.onData((data) => {
        if (!instance.child) return;
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          if (char === "\r" || char === "\n") {
            const cmdToSend = currentLine + "\r\n";
            console.log(
              `[Terminal] Sending command: ${JSON.stringify(cmdToSend)}`,
            );
            instance.child
              .write(cmdToSend)
              .catch((e) => console.error("[Terminal] Write failed:", e));
            term.write("\r\n");
            currentLine = "";
            // Handle Windows \r\n explicitly
            if (char === "\r" && data[i + 1] === "\n") i++;
          } else if (char === "\x7F" || char === "\b") {
            // Backspace
            if (currentLine.length > 0) {
              currentLine = currentLine.slice(0, -1);
              term.write("\b \b");
            }
          } else {
            currentLine += char;
            term.write(char);
          }
        }
      });

      console.log(`[Terminal] ${instance.id} connected.`);
    } catch (e) {
      console.error("[Terminal] Spawn failed:", e);
      instance.status = "error";
      instance.errorMsg = String(e);
      term.writeln(`\r\n\x1b[31mFailed to spawn powershell: ${e}\x1b[0m`);
      term.writeln(
        `\x1b[33mTry restarting the app if you just updated permissions.\x1b[0m`,
      );
    }
  }

  async function addTerminal() {
    const term = new Terminal({
      theme: {
        background: "#0A0A0A",
        foreground: "#D4D4D4",
        cursor: "#AEAFAD",
      },
      fontFamily: "monospace",
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
      convertEol: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const instance: TermInstance = {
      id: crypto.randomUUID(),
      term,
      fitAddon,
      title: `Terminal ${termCounter++}`,
      status: "connecting",
    };

    const newGroup: TermGroup = {
      id: crypto.randomUUID(),
      instances: [instance],
      activeInstanceId: instance.id,
    };

    termGroups = [...termGroups, newGroup];
    activeGroupId = newGroup.id;

    // Shell spawning is handled by the effect once the container is bound
  }

  function killGroup(groupId: string) {
    const groupIdx = termGroups.findIndex((g) => g.id === groupId);
    if (groupIdx === -1) return;

    termGroups[groupIdx].instances.forEach((inst) => {
      inst.child?.kill();
      inst.term.dispose();
    });

    const newGroups = [...termGroups];
    newGroups.splice(groupIdx, 1);

    if (newGroups.length === 0) {
      onClose();
    } else {
      termGroups = newGroups;
      if (activeGroupId === groupId) {
        activeGroupId = newGroups[Math.max(0, groupIdx - 1)].id;
      }
    }
  }

  async function testConnectivity() {
    try {
      const command = Command.create("powershell", [
        "echo",
        "Meerkat Connection Test",
      ]);
      const output = await command.execute();
      alert(`Connection Test Success!\nOutput: ${output.stdout}`);
    } catch (e) {
      alert(`Connection Test Failed: ${e}`);
    }
  }

  onMount(() => {
    resizeObserver = new ResizeObserver(() => {
      termGroups.forEach((g) => {
        g.instances.forEach((inst) => {
          if (inst.container && inst.container.clientWidth > 0) {
            try {
              inst.fitAddon.fit();
            } catch (e) {}
          }
        });
      });
    });

    addTerminal();

    return () => {
      resizeObserver.disconnect();
      termGroups.forEach((g) =>
        g.instances.forEach((inst) => {
          inst.child?.kill();
          inst.term.dispose();
        }),
      );
    };
  });

  // Effect to mount terminals when their containers become available
  $effect(() => {
    termGroups.forEach((group) => {
      group.instances.forEach((inst) => {
        if (inst.container && !inst.term.element) {
          inst.term.open(inst.container);
          inst.fitAddon.fit();
          inst.term.focus();
          spawnShell(inst);
          if (resizeObserver) resizeObserver.observe(inst.container);
        }
      });
    });
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="terminal-panel"
  onclick={() => {
    const group = termGroups.find((g) => g.id === activeGroupId);
    const inst = group?.instances.find((i) => i.id === group.activeInstanceId);
    inst?.term.focus();
  }}
>
  <div class="terminal-header">
    <div class="terminal-tabs">
      {#each termGroups as group}
        {@const activeInst = group.instances.find(
          (i) => i.id === group.activeInstanceId,
        )}
        <button
          class="term-tab"
          class:active={activeGroupId === group.id}
          onclick={() => {
            activeGroupId = group.id;
            activeInst?.term.focus();
          }}
        >
          <div class="tab-content">
            {#if activeInst?.status === "connecting"}
              <Loader2 size={10} class="spin-icon" />
            {:else if activeInst?.status === "error"}
              <AlertCircle size={10} class="error-icon" />
            {:else}
              <CheckCircle2 size={10} class="success-icon" />
            {/if}
            <span>{activeInst?.title || "Terminal"}</span>
          </div>
        </button>
      {/each}
    </div>
    <div class="terminal-actions">
      <button
        class="icon-btn"
        title="Test Connection"
        onclick={testConnectivity}><Play size={14} /></button
      >
      <button class="icon-btn" title="New Terminal" onclick={addTerminal}
        ><Plus size={14} /></button
      >
      <button
        class="icon-btn"
        title="Kill Terminal"
        onclick={() => activeGroupId && killGroup(activeGroupId)}
        ><Trash2 size={14} /></button
      >
      <div class="divider"></div>
      <button class="icon-btn" title="Close Panel" onclick={onClose}
        ><X size={14} /></button
      >
    </div>
  </div>

  <div class="terminal-grid">
    {#each termGroups as group}
      <div class="terminal-group-container">
        {#each group.instances as inst}
          <div
            class="terminal-content"
            style="display: {group.activeInstanceId === inst.id
              ? 'block'
              : 'none'};"
            bind:this={inst.container}
          ></div>
        {/each}
      </div>
      {#if group !== termGroups[termGroups.length - 1]}
        <div class="group-divider"></div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .terminal-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--background);
    border-top: 1px solid var(--border);
  }

  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 35px;
    background-color: var(--muted);
    border-bottom: 1px solid var(--border);
    padding-right: 8px;
  }

  .terminal-tabs {
    display: flex;
    height: 100%;
  }

  .term-tab {
    display: flex;
    align-items: center;
    padding: 0 12px;
    font-size: 11px;
    color: var(--muted-foreground);
    border: none;
    border-right: 1px solid var(--border);
    background: transparent;
    cursor: pointer;
  }

  .tab-content {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .term-tab:hover {
    background-color: var(--sidebar-accent);
  }
  .term-tab.active {
    background-color: var(--background);
    color: var(--foreground);
    border-bottom: 1px solid var(--primary);
  }

  .terminal-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

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

  .icon-btn:hover {
    background-color: var(--accent);
    opacity: 1;
  }

  .divider {
    width: 1px;
    height: 16px;
    background-color: var(--border);
    margin: 0 4px;
  }

  .terminal-grid {
    flex: 1;
    display: flex;
    overflow: hidden;
    background-color: #0a0a0a;
  }

  .terminal-group-container {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  .terminal-content {
    flex: 1;
    height: 100%;
    width: 100%;
    overflow: hidden;
    padding: 8px;
  }

  .group-divider {
    width: 1px;
    background-color: var(--border);
    height: 100%;
  }

  .error-icon {
    color: #f87171;
  }
  .success-icon {
    color: #4ade80;
    opacity: 0.7;
  }

  .spin-icon {
    animation: spin 1s linear infinite;
    opacity: 0.7;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
