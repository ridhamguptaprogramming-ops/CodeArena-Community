import { onMount, createEffect, onCleanup, JSX } from 'solid-js';
import * as monaco from 'monaco-editor';

interface MonacoWrapperProps {
  value?: string;
  language?: string;
  theme?: string;
  fontSize?: number;
  minimap?: boolean;
  wordWrap?: 'on' | 'off';
  onCodeChange?: (code: string) => void;
  onEditorReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
}

const MonacoWrapper = (props: MonacoWrapperProps) => {
  let editorContainer: HTMLDivElement | undefined;
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;
  let resizeObserver: ResizeObserver | undefined;

  onMount(() => {
    if (!editorContainer) return;

    const config: monaco.editor.IStandaloneEditorConstructionOptions = {
      value: props.value || "",
      language: props.language || 'python',
      theme: props.theme || 'vs-dark',
      automaticLayout: true,
      fontSize: props.fontSize || 16,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      minimap: { enabled: props.minimap ?? true },
      wordWrap: props.wordWrap || 'off',
      scrollBeyondLastLine: false,
      padding: { top: 16, bottom: 16 },
      lineNumbersMinChars: 3,
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: true },
      ...props.options
    };

    editor = monaco.editor.create(editorContainer, config);

    editor.onDidChangeModelContent(() => {
      props.onCodeChange?.(editor!.getValue());
    });

    if (props.onEditorReady) {
      props.onEditorReady(editor);
    }

    resizeObserver = new ResizeObserver(() => {
      editor?.layout();
    });
    resizeObserver.observe(editorContainer);
  });

  createEffect(() => {
    if (editor && props.value !== undefined && props.value !== editor.getValue()) {
      editor.setValue(props.value);
    }
  });

  createEffect(() => {
    if (editor && props.language) {
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, props.language);
    }
  });

  createEffect(() => {
    if (editor && props.theme) {
      monaco.editor.setTheme(props.theme);
    }
  });

  createEffect(() => {
    if (editor && props.fontSize) {
      editor.updateOptions({ fontSize: props.fontSize });
    }
  });

  createEffect(() => {
    if (editor) {
      editor.updateOptions({
        minimap: { enabled: props.minimap ?? true },
        wordWrap: props.wordWrap || 'off',
      });
    }
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
    editor?.dispose();
  });

  return (
    <div
      ref={editorContainer}
      class="w-full h-full min-h-0"
    ></div>
  );
};

export default MonacoWrapper;
