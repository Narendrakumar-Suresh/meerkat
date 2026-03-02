<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as monaco from 'monaco-editor';

  let { 
    originalValue = "", 
    modifiedValue = "", 
    language = "javascript",
    isDarkMode = true,
    fontSize = 14
  } = $props<{
    originalValue: string;
    modifiedValue: string;
    language: string;
    isDarkMode: boolean;
    fontSize: number;
  }>();

  let diffEditorElement: HTMLDivElement;
  let diffEditor: monaco.editor.IStandaloneDiffEditor;

  const THEME_NAME = 'meerkat-dark-diff';

  function updateTheme() {
    monaco.editor.defineTheme(THEME_NAME, {
      base: isDarkMode ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': isDarkMode ? '#0A0A0A' : '#FFFFFF',
      }
    });
    monaco.editor.setTheme(THEME_NAME);
  }

  onMount(() => {
    updateTheme();

    diffEditor = monaco.editor.createDiffEditor(diffEditorElement, {
      originalEditable: false,
      readOnly: false,
      automaticLayout: true,
      theme: THEME_NAME,
      fontSize: fontSize,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      minimap: { enabled: false },
      renderSideBySide: true
    });

    const originalModel = monaco.editor.createModel(originalValue, language);
    const modifiedModel = monaco.editor.createModel(modifiedValue, language);

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel
    });
  });

  $effect(() => {
    if (diffEditor && isDarkMode !== undefined) {
      updateTheme();
    }
  });

  $effect(() => {
    if (diffEditor && fontSize) {
      diffEditor.updateOptions({ fontSize });
    }
  });

  onDestroy(() => {
    diffEditor?.dispose();
  });
</script>

<div class="diff-container" bind:this={diffEditorElement}></div>

<style>
  .diff-container {
    width: 100%;
    height: 100%;
  }
</style>
