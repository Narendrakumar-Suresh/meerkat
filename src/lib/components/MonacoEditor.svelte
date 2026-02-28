<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as monaco from 'monaco-editor';
  import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
  import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
  import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
  import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
  import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

  let editorElement: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor;

  const MEERKAT_DARK_THEME = 'meerkat-dark';

  let { 
    value = $bindable(`function hello() {\n\tconsole.log("Hello Meerkat!");\n}`),
    language = "javascript",
    isDarkMode = true
  } = $props();

  function updateTheme() {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
    const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

    monaco.editor.defineTheme(MEERKAT_DARK_THEME, {
      base: isDarkMode ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'operator', foreground: 'ff79c6' }
      ],
      colors: {
        'editor.background': isDarkMode ? '#0A0A0A' : '#FFFFFF',
        'editor.foreground': isDarkMode ? '#D4D4D4' : '#141414',
        'editorCursor.foreground': isDarkMode ? '#AEAFAD' : '#000000',
        'editor.lineHighlightBackground': isDarkMode ? '#1A1A1A' : '#F0F0F0',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': isDarkMode ? '#264F78' : '#ADD6FF',
        'scrollbar.shadow': '#00000000',
        'scrollbarSlider.background': isDarkMode ? '#ffffff10' : '#00000010',
        'scrollbarSlider.hoverBackground': isDarkMode ? '#ffffff20' : '#00000020',
        'scrollbarSlider.activeBackground': isDarkMode ? '#ffffff30' : '#00000030',
      }
    });
    monaco.editor.setTheme(MEERKAT_DARK_THEME);
  }

  onMount(() => {
    // ... MonacoEnvironment config ...
    self.MonacoEnvironment = {
      getWorker(_, label) {
        let worker;
        if (label === 'json') worker = new jsonWorker();
        else if (label === 'css' || label === 'scss' || label === 'less') worker = new cssWorker();
        else if (label === 'html' || label === 'handlebars' || label === 'razor') worker = new htmlWorker();
        else if (label === 'typescript' || label === 'javascript') worker = new tsWorker();
        else worker = new editorWorker();
        return worker;
      },
    };

    updateTheme();

    editor = monaco.editor.create(editorElement, {
      value,
      language,
      theme: MEERKAT_DARK_THEME,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: false,
      padding: { top: 10, bottom: 10 }
    });

    editor.onDidChangeModelContent(() => {
      value = editor.getValue();
    });
  });

  $effect(() => {
    if (editor && isDarkMode !== undefined) {
      updateTheme();
    }
  });

  $effect(() => {
    if (editor && value !== editor.getValue()) {
      editor.setValue(value);
    }
  });

  $effect(() => {
    if (editor && language) {
      monaco.editor.setModelLanguage(editor.getModel()!, language);
    }
  });

  onDestroy(() => {
    editor?.dispose();
  });
</script>

<div bind:this={editorElement} class="editor-container"></div>

<style>
  .editor-container {
    width: 100%;
    height: 100%;
  }
</style>
