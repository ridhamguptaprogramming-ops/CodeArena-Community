import { createSignal, createEffect, Show, onMount, onCleanup, For, Index } from 'solid-js';
import type * as monaco from 'monaco-editor';
import { executionService } from '../services/execution';
import { storageService } from '../services/storage.service';
import MonacoWrapper from '../editor/MonacoWrapper';
import EditorToolbar from '../editor/EditorToolbar';
import ExecutionPanel from '../execution/ExecutionPanel';
import { 
  FileCode, 
  ChevronRight, 
  Settings, 
  Search, 
  FolderTree, 
  Info,
  Terminal,
  Activity,
  Cpu,
  Layers,
  History,
  Box
} from 'lucide-solid';
import { cn } from '../utils/cn';
import { useTheme } from '../utils/theme-signal';

const DEFAULT_CODES: Record<string, string> = {
  python: 'def main():\n    print("Welcome to CodeArena")\n\nif __name__ == "__main__":\n    main()',
  javascript: 'console.log("Welcome to CodeArena");',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Performance redefined." << std::endl;\n    return 0;\n}',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Object oriented learning.");\n    }\n}',
  c: '#include <stdio.h>\n\nint main() {\n    printf("Classic C Sandbox.\\n");\n    return 0;\n}'
};

const LANGUAGE_OPTIONS = [
  { value: 'java', label: 'Java', ext: '.java' },
  { value: 'python', label: 'Python 3', ext: '.py' },
  { value: 'javascript', label: 'JavaScript', ext: '.js' },
  { value: 'cpp', label: 'C++', ext: '.cpp' },
  { value: 'c', label: 'C', ext: '.c' }
];

const EditorPage = () => {
  const [files, setFiles] = createSignal(storageService.getFiles().length > 0 ? storageService.getFiles() : [
    { id: 1, name: 'Main.java', lang: 'java', code: DEFAULT_CODES.java, output: '', executionTime: null }
  ]);
  const [activeFileId, setActiveFileId] = createSignal<number>(files()[0].id);
  const [input, setInput] = createSignal('');
  const [executing, setExecuting] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [fontSize, setFontSize] = createSignal(storageService.getFontSize());
  const [minimapEnabled, setMinimapEnabled] = createSignal(true);
  const [wordWrap, setWordWrap] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [codeStats, setCodeStats] = createSignal({ lines: 0, words: 0 });
  const [executionStage, setExecutionStage] = createSignal('');
  const [executionHistory, setExecutionHistory] = createSignal<any[]>(
    (() => {
      try {
        return JSON.parse(sessionStorage.getItem('codearena_execution_history') || '[]');
      } catch {
        return [];
      }
    })()
  );
  let monacoEditor: monaco.editor.IStandaloneCodeEditor | undefined;
  const { uiTheme } = useTheme();
  let editorWorkspace: HTMLElement | undefined;

  const currentFile = () => files().find(f => f.id === activeFileId()) || files()[0];

  createEffect(() => storageService.saveFiles(files()));
  createEffect(() => storageService.saveFontSize(fontSize()));
  createEffect(() => {
    try {
      sessionStorage.setItem('codearena_execution_history', JSON.stringify(executionHistory()));
    } catch {}
  });
  


  createEffect(() => {
    const file = currentFile();
    if (file) {
      const code = file.code || "";
      const lines = code.split('\n').length;
      const words = code.split(/\s+/).filter((w: string) => w.length > 0).length;
      setCodeStats({ lines, words });
    }
  });

  onMount(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        runCode();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        storageService.saveFiles(files());
        setExecutionStage('Workspace saved locally');
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    onCleanup(() => window.removeEventListener('keydown', handleShortcuts));
  });

  const runCode = async () => {
    if (executing()) return;
    const file = currentFile();
    const fileId = file.id;
    const sourceCode = monacoEditor?.getValue() ?? file.code;
    const language = file.lang;
    const standardInput = input();

    setFiles(prev => prev.map(item => item.id === fileId ? {
      ...item,
      code: sourceCode,
      output: '',
      stderr: '',
      compileError: '',
      status: 'RUNNING',
      outputTruncated: false,
      executionTime: null,
      exitCode: null,
      memoryUsage: null,
    } : item));

    if (!sourceCode.trim()) {
      setFiles(prev => prev.map(item => item.id === fileId ? {
        ...item,
        output: '',
        stderr: 'Source code is empty. Add code before running.',
        message: 'Source code is empty. Add code before running.',
        status: 'SYSTEM_ERROR',
      } : item));
      setExecutionStage('Source code is empty');
      return;
    }

    setExecuting(true);
    setProgress(10);
    setExecutionStage('Preparing...');

    try {
      const result = await executionService.execute(
        sourceCode,
        language,
        standardInput,
        (p: number) => {
          setProgress(p);
          if (p < 100) setExecutionStage('Submitting to execution service...');
          if (p >= 100) setExecutionStage('Completed');
        }
      );
      setExecutionStage(result.status === 'ACCEPTED' ? 'Completed' : result.status.replace(/_/g, ' '));
      setFiles(prev => prev.map(item => item.id === fileId ? {
        ...item,
        output: result.stdout,
        stderr: result.stderr,
        compileError: result.compileError,
        status: result.status,
        executionId: result.executionId,
        executionTime: result.executionTime,
        exitCode: result.exitCode,
        memoryUsage: result.memoryUsage,
        outputTruncated: result.outputTruncated,
        message: result.message,
      } : item));
      const historyEntry = {
        id: result.executionId,
        executionId: result.executionId,
        timestamp: new Date().toLocaleTimeString(),
        language,
        sourceCode,
        stdin: standardInput,
        result,
      };
      setExecutionHistory(prev => [historyEntry, ...prev].slice(0, 20));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown execution error.';
      setFiles(prev => prev.map(item => item.id === fileId ? {
        ...item,
        output: '',
        stderr: message,
        status: 'SYSTEM_ERROR',
      } : item));
      setExecutionStage('Execution failed');
    } finally {
      setExecuting(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === editorWorkspace) await document.exitFullscreen();
      else await editorWorkspace?.requestFullscreen();
    } catch {
      setExecutionStage('Fullscreen is unavailable in this browser');
    }
  };

  const visualizeCode = () => {
    storageService.saveActiveFileForVisualization({
      code: currentFile().code,
      lang: currentFile().lang
    });
    window.location.href = '/visualize';
  };

  const handleLanguageChange = (lang: string) => {
    const existingBuffer = files().find(file => file.lang === lang);
    if (existingBuffer) {
      setActiveFileId(existingBuffer.id);
      return;
    }

    const option = LANGUAGE_OPTIONS.find(item => item.value === lang);
    const id = Date.now();
    setFiles(prev => [...prev, {
      id,
      name: `${lang === 'java' ? 'Main' : 'main'}${option?.ext || '.txt'}`,
      lang,
      code: DEFAULT_CODES[lang] || '',
      output: '',
      executionTime: null,
    }]);
    setActiveFileId(id);
  };

  return (
    <div class="h-screen flex flex-col bg-background text-foreground overflow-hidden selection:bg-accent-blue/20 transition-colors duration-300">
      <div class="noise opacity-[0.03]" />
      
      <EditorToolbar
        files={files()}
        activeFileId={activeFileId()}
        onSetActiveFile={setActiveFileId}
        onAddFile={() => {
          const id = Date.now();
          const lang = currentFile().lang;
          const ext = LANGUAGE_OPTIONS.find(l => l.value === lang)?.ext || '.txt';
          setFiles([...files(), { id, name: `Untitled${ext}`, lang, code: DEFAULT_CODES[lang] || '', output: '' }]);
          setActiveFileId(id);
        }}
        onDeleteFile={(id) => {
          if (files().length > 1) {
            const remaining = files().filter(f => f.id !== id);
            setFiles(remaining);
            if (activeFileId() === id) setActiveFileId(remaining[0].id);
          }
        }}
        onRun={runCode}
        onFormat={() => { void monacoEditor?.getAction('editor.action.formatDocument')?.run(); }}
        onToggleFullscreen={toggleFullscreen}
        onVisualize={visualizeCode}
        executing={executing()}
        progress={progress()}
        onToggleSettings={() => setShowSettings(!showSettings())}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen())}
        sidebarOpen={sidebarOpen()}
      >
      </EditorToolbar>

      <div class="flex-1 flex overflow-hidden">


        {/* Sidebar Explorer */}
        <Show when={sidebarOpen()}>
          <aside class="w-72 border-r border-border bg-bg-secondary flex flex-col shrink-0 animate-in fade-in slide-in-from-left-4 duration-500">
            <div class="px-6 py-5 border-b border-border flex items-center justify-between bg-bg-tertiary">
              <span class="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-secondary">Explorer</span>
              <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-1">
              <Index each={files()}>
                {(f) => (
                  <div
                    class={cn(
                      "group flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-300",
                      f().id === activeFileId() ? "bg-foreground text-background shadow-premium" : "hover:bg-foreground/5 text-brand-secondary hover:text-foreground"
                    )}
                    onClick={() => setActiveFileId(f().id)}
                  >
                    <FileCode class={cn("w-4 h-4", f().id === activeFileId() ? "text-background" : "text-brand-secondary")} />
                    <input 
                      value={f().name} 
                      onInput={(e) => {
                        const newName = e.currentTarget.value;
                        setFiles(prev => prev.map(file => file.id === f().id ? { ...file, name: newName } : file));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                           e.currentTarget.blur();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      class="bg-transparent border-none outline-none w-full truncate flex-1 text-inherit placeholder-muted/50"
                      placeholder="Filename..."
                    />
                    <Show when={f().id === activeFileId()}>
                        <div class="w-1 h-1 rounded-full bg-background/40" />
                    </Show>
                  </div>
                )}
              </Index>
            </div>
          </aside>
        </Show>

        {/* Main Editor Zone */}
        <main ref={editorWorkspace} class="flex-1 flex flex-col relative min-w-0 bg-bg-secondary">
          <div class="flex-1 flex flex-col min-h-0 relative">
             <MonacoWrapper
                value={currentFile().code}
                language={currentFile().lang}
                theme={uiTheme() === 'dark' ? 'vs-dark' : 'github-light'}
                fontSize={fontSize()}
                minimap={minimapEnabled()}
                wordWrap={wordWrap() ? 'on' : 'off'}
                onCodeChange={(code) => {
                  setFiles(prev => prev.map(f => f.id === activeFileId() ? { ...f, code } : f));
                }}
                onEditorReady={(editor) => { monacoEditor = editor; }}
              />
          </div>
          
          {/* Status Bar */}
          <div class="h-8 border-t border-border bg-bg-tertiary px-6 flex items-center justify-between text-[10px] text-brand-secondary font-bold uppercase tracking-widest shrink-0">
            <div class="flex items-center gap-6">
              <span class="flex items-center gap-2 text-emerald-500"><div class="w-1 h-1 rounded-full bg-current" /> Editor Ready</span>
              <span>UTF-8</span>
            </div>
            <div class="flex items-center gap-6">
              <span>{codeStats().lines} Lines</span>
              <span class="text-background bg-foreground px-2 py-0.5 rounded-sm">{currentFile().lang}</span>
            </div>
          </div>
        </main>

        {/* Action Panel */}
        <Show when={showSettings() || executing() || Boolean(currentFile()?.status)}>
           <aside class="w-96 border-l border-border bg-bg-secondary shrink-0 animate-in fade-in slide-in-from-right-4 duration-500">
              <ExecutionPanel
                sidebar
                currentFile={currentFile()}
                fontSize={fontSize()}
                minimapEnabled={minimapEnabled()}
                wordWrap={wordWrap()}
                input={input()}
                executing={executing()}
                progress={progress()}
                executionStage={executionStage()}
                codeStats={codeStats()}
                showSettings={showSettings()}
                history={executionHistory()}
                onLanguageChange={handleLanguageChange}
                onInputChange={setInput}
                onFontSizeChange={setFontSize}
                onMinimapChange={setMinimapEnabled}
                onWordWrapChange={setWordWrap}
                onClearOutput={() => {
                  const fileId = activeFileId();
                  setFiles(prev => prev.map(item => item.id === fileId ? {
                    ...item,
                    output: '',
                    stderr: '',
                    compileError: '',
                    status: '',
                    executionId: '',
                    executionTime: null,
                    exitCode: null,
                    memoryUsage: null,
                    outputTruncated: false,
                  } : item));
                  setExecutionStage('');
                }}
                onSelectHistory={(entry) => {
                  const fileId = activeFileId();
                  const option = LANGUAGE_OPTIONS.find(item => item.value === entry.language);
                  setInput(entry.stdin || '');
                  setFiles(prev => prev.map(item => item.id === fileId ? {
                    ...item,
                    lang: entry.language,
                    name: entry.language === 'java'
                      ? 'Main.java'
                      : `main${option?.ext || '.txt'}`,
                    code: entry.sourceCode,
                    output: entry.result.stdout,
                    stderr: entry.result.stderr,
                    compileError: entry.result.compileError,
                    status: entry.result.status,
                    executionId: entry.result.executionId || entry.executionId || entry.id,
                    executionTime: entry.result.executionTime,
                    exitCode: entry.result.exitCode,
                    memoryUsage: entry.result.memoryUsage,
                    outputTruncated: entry.result.outputTruncated,
                    message: entry.result.message,
                  } : item));
                  setExecutionStage('Completed');
                }}
                onVisualize={visualizeCode}
              />
           </aside>
        </Show>
      </div>
    </div>
  );
};

export default EditorPage;
