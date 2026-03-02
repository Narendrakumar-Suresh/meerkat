<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as monaco from 'monaco-editor';
  import { X, ChevronDown, ChevronUp, Replace, ReplaceAll, Search, ArrowRight } from '@lucide/svelte';
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
    isDarkMode = true,
    wordWrap = $bindable(false),
    tabSize = 2,
    insertSpaces = true,
    fontSize = 14,
    scrollToLine = null,
    onCursorChange
  } = $props<{
    value?: string;
    language?: string;
    isDarkMode?: boolean;
    wordWrap?: boolean;
    tabSize?: number;
    insertSpaces?: boolean;
    fontSize?: number;
    scrollToLine?: number | null;
    onCursorChange?: (pos: { lineNumber: number, column: number }) => void;
  }>();

  // Find & Replace state
  let showFind = $state(false);
  let showReplace = $state(false);
  let showGoToLine = $state(false);
  let findText = $state("");
  let replaceText = $state("");
  let goToLineText = $state("");
  let matchCase = $state(false);
  let wholeWord = $state(false);
  let useRegex = $state(false);
  let resultsCount = $state({ current: 0, total: 0 });

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

  function handleFind() {
    if (!editor) return;
    const controller = editor.getContribution('editor.contrib.findController') as any;
    if (controller) {
      controller.getState().change({ searchString: findText, isRevealed: true }, true);
      editor.getAction('actions.find').run();
    }
  }

  function findNext() {
    editor.trigger('findNext', 'editor.action.nextMatchFindAction', {});
  }

  function findPrev() {
    editor.trigger('findPrev', 'editor.action.previousMatchFindAction', {});
  }

  function replaceOne() {
    editor.trigger('replace', 'editor.action.replaceOne', { replaceString: replaceText });
  }

  function replaceAll() {
    editor.trigger('replaceAll', 'editor.action.replaceAll', { replaceString: replaceText });
  }

  function closeFind() {
    showFind = false;
    showReplace = false;
    editor.focus();
  }

  function goToLine() {
    const line = parseInt(goToLineText);
    if (!isNaN(line) && editor) {
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.revealLineInCenter(line);
      editor.focus();
      showGoToLine = false;
    }
  }

  function closeGoToLine() {
    showGoToLine = false;
    editor.focus();
  }

  onMount(() => {
    if (typeof window !== 'undefined' && !self.MonacoEnvironment) {
      self.MonacoEnvironment = {
        getWorker(_, label) {
          if (label === 'json') return new jsonWorker();
          if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
          if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
          if (label === 'typescript' || label === 'javascript') return new tsWorker();
          return new editorWorker();
        },
      };
    }

    updateTheme();

    editor = monaco.editor.create(editorElement, {
      value,
      language,
      theme: MEERKAT_DARK_THEME,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: fontSize,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: false,
      padding: { top: 10, bottom: 10 },
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'always'
      },
      wordWrap: wordWrap ? 'on' : 'off',
      tabSize: tabSize,
      insertSpaces: insertSpaces
    });

    // Custom Keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      const selection = editor.getModel()?.getValueInRange(editor.getSelection()!);
      if (selection) findText = selection;
      showFind = true;
      showReplace = false;
      showGoToLine = false;
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      const selection = editor.getModel()?.getValueInRange(editor.getSelection()!);
      if (selection) findText = selection;
      showFind = true;
      showReplace = true;
      showGoToLine = false;
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      showGoToLine = true;
      showFind = false;
      showReplace = false;
    });

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
      wordWrap = !wordWrap;
    });

    editor.addCommand(monaco.KeyCode.Escape, () => {
      showFind = false;
      showReplace = false;
      showGoToLine = false;
      editor.focus();
    });

    editor.onDidChangeModelContent(() => {
      value = editor.getValue();
    });

    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.({
        lineNumber: e.position.lineNumber,
        column: e.position.column
      });
    });
  });

  $effect(() => {
    if (editor && isDarkMode !== undefined) {
      updateTheme();
    }
  });

  $effect(() => {
    if (editor && value !== editor.getValue()) {
      editor.setValue(value || "");
    }
  });

  $effect(() => {
    if (editor && language) {
      monaco.editor.setModelLanguage(editor.getModel()!, language);
    }
  });

  $effect(() => {
    if (editor && wordWrap !== undefined) {
      editor.updateOptions({ wordWrap: wordWrap ? 'on' : 'off' });
    }
  });

  $effect(() => {
    if (editor && (tabSize !== undefined || insertSpaces !== undefined)) {
      editor.updateOptions({ 
        tabSize: tabSize,
        insertSpaces: insertSpaces
      });
    }
  });

  $effect(() => {
    if (editor && fontSize !== undefined) {
      editor.updateOptions({ fontSize: fontSize });
    }
  });

  $effect(() => {
    if (editor && scrollToLine !== undefined && scrollToLine !== null) {
      editor.revealLineInCenter(scrollToLine);
      editor.setPosition({ lineNumber: scrollToLine, column: 1 });
      editor.focus();
    }
  });

  onDestroy(() => {
    editor?.dispose();
  });
</script>

<div class="editor-wrapper">
  {#if showFind}
    <div class="find-replace-panel" class:with-replace={showReplace}>
      <div class="panel-row">
        <div class="input-group">
          <Search size={14} class="search-icon" />
          <input 
            type="text" 
            placeholder="Find" 
            bind:value={findText} 
            oninput={handleFind}
            onkeydown={(e) => e.key === 'Enter' && findNext()}
            autofocus
          />
        </div>
        <div class="controls">
          <button class="icon-btn" onclick={findPrev} title="Previous Match"><ChevronUp size={16}/></button>
          <button class="icon-btn" onclick={findNext} title="Next Match"><ChevronDown size={16}/></button>
          <div class="divider"></div>
          <button class="icon-btn" onclick={closeFind} title="Close"><X size={16}/></button>
        </div>
      </div>
      {#if showReplace}
        <div class="panel-row replace-row">
          <div class="input-group">
            <Replace size={14} class="search-icon" />
            <input 
              type="text" 
              placeholder="Replace" 
              bind:value={replaceText}
              onkeydown={(e) => e.key === 'Enter' && replaceOne()}
            />
          </div>
          <div class="controls">
            <button class="icon-btn" onclick={replaceOne} title="Replace"><Replace size={16}/></button>
            <button class="icon-btn" onclick={replaceAll} title="Replace All"><ReplaceAll size={16}/></button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if showGoToLine}
    <div class="find-replace-panel go-to-line">
      <div class="panel-row">
        <div class="input-group">
          <ArrowRight size={14} class="search-icon" />
          <input 
            type="text" 
            placeholder="Go to line..." 
            bind:value={goToLineText} 
            onkeydown={(e) => e.key === 'Enter' && goToLine()}
            autofocus
          />
        </div>
        <div class="controls">
          <button class="icon-btn" onclick={goToLine} title="Go"><ArrowRight size={16}/></button>
          <div class="divider"></div>
          <button class="icon-btn" onclick={closeGoToLine} title="Close"><X size={16}/></button>
        </div>
      </div>
    </div>
  {/if}

  <div bind:this={editorElement} class="editor-container"></div>
</div>

<style>
  .editor-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .editor-container {
    flex: 1;
    width: 100%;
    height: 100%;
  }

  .find-replace-panel {
    position: absolute;
    top: 10px;
    right: 20px;
    z-index: 100;
    background-color: var(--popover);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 320px;
  }

  .panel-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .input-group {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 8px;
    opacity: 0.5;
  }

  input {
    width: 100%;
    background-color: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--foreground);
    padding: 4px 8px 4px 28px;
    font-size: 12px;
    outline: none;
  }

  input:focus {
    border-color: var(--primary);
  }

  .controls {
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
    opacity: 0.7;
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
</style>
