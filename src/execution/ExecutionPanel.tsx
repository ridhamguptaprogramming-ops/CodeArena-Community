import { createEffect, createSignal, For, Show } from 'solid-js';
import { 
  Clock, 
  Terminal, 
  Copy, 
  Tv, 
  Settings2,
  AlertCircle,
  Zap,
  Trash2,
  History
} from 'lucide-solid';
import Button from '../ui/Button';
import { cn } from '../utils/cn';

interface ExecutionPanelProps {
  currentFile: any;
  fontSize: number;
  minimapEnabled: boolean;
  wordWrap: boolean;
  input: string;
  executing: boolean;
  progress: number;
  executionStage: string;
  codeStats: { lines: number; words: number };
  showSettings: boolean;
  history: any[];
  onLanguageChange: (lang: string) => void;
  onInputChange: (input: string) => void;
  onFontSizeChange: (size: number) => void;
  onMinimapChange: (enabled: boolean) => void;
  onWordWrapChange: (enabled: boolean) => void;
  onClearOutput: () => void;
  onSelectHistory: (entry: any) => void;
  onVisualize: () => void;
  sidebar?: boolean;
}

const ExecutionPanel = (props: ExecutionPanelProps) => {
  const [activeTab, setActiveTab] = createSignal('output');
  const statusLabel = (status?: string) => status
    ? status.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Idle';
  const durationLabel = (duration?: string | null) => duration
    ? (/^\d+(?:\.\d+)?$/.test(duration) ? `${duration} ms` : /\b(ms|s|sec|seconds?)\b/i.test(duration) ? duration : `${duration}s`)
    : 'Not available';

  createEffect(() => {
    if (props.executing) setActiveTab('output');
  });

  const LANGUAGE_OPTIONS = [
    { value: 'java', label: 'Java' },
    { value: 'python', label: 'Python 3' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'cpp', label: 'C++' },
    { value: 'c', label: 'C' }
  ];

  const copyOutput = async () => {
    const output = [props.currentFile?.output, props.currentFile?.compileError || props.currentFile?.stderr]
      .filter(Boolean)
      .join('\n');
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {}
  };

  return (
    <div class={cn("flex flex-col h-full bg-bg-secondary transition-colors duration-300", props.sidebar ? "w-full" : "w-full overflow-hidden")}>
      <div class="flex-1 overflow-y-auto space-y-8 p-6">
        <Show when={props.showSettings}>
          <section class="animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-secondary mb-4 flex items-center gap-2">
              <Settings2 class="w-3.5 h-3.5" /> Workspace Settings
            </h3>
            <div class="space-y-4 bg-bg-tertiary p-5 rounded-2xl border border-border">
              <div class="space-y-3">
                <div class="flex justify-between text-xs font-bold">
                  <label>Editor Font Size</label>
                  <span class="text-accent-blue">{props.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="24"
                  value={props.fontSize}
                  onInput={(e) => props.onFontSizeChange(parseInt(e.currentTarget.value))}
                  class="w-full accent-accent-blue h-1.5 bg-border rounded-full appearance-none cursor-pointer"
                />
              </div>
              <label class="flex items-center justify-between gap-4 text-xs">
                <span>Show minimap</span>
                <input type="checkbox" checked={props.minimapEnabled} onChange={(event) => props.onMinimapChange(event.currentTarget.checked)} />
              </label>
              <label class="flex items-center justify-between gap-4 text-xs">
                <span>Word wrap</span>
                <input type="checkbox" checked={props.wordWrap} onChange={(event) => props.onWordWrapChange(event.currentTarget.checked)} />
              </label>
              <Button variant="outline" size="sm" class="w-full text-[10px] font-bold uppercase tracking-wider" onClick={props.onClearOutput} leftIcon={<Trash2 class="w-3.5 h-3.5" />}>
                Clear Execution Output
              </Button>
            </div>
          </section>
        </Show>

        <section>
          <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-secondary mb-4 flex items-center gap-2">
            <Zap class="w-3.5 h-3.5" /> Compiler Config
          </h3>
          <div class="space-y-5">
            <div class="space-y-2">
              <label class="text-[11px] font-bold text-foreground">Active Language</label>
              <select
                class="w-full bg-bg-tertiary border border-border rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-accent-blue/10 outline-none transition-all appearance-none cursor-pointer"
                value={props.currentFile?.lang}
                onChange={(e) => props.onLanguageChange(e.currentTarget.value)}
              >
                <For each={LANGUAGE_OPTIONS}>
                  {(lang) => <option value={lang.value}>{lang.label}</option>}
                </For>
              </select>
            </div>

            <div class="space-y-2">
              <label class="text-[11px] font-bold text-foreground">Editor Theme</label>
              <select
                class="w-full bg-bg-tertiary border border-border rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-accent-blue/10 outline-none transition-all appearance-none cursor-pointer"
                disabled
              >
                <option value="dark">CodeArena Dark</option>
              </select>
            </div>



            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <label for="execution-stdin" class="text-[11px] font-bold text-foreground">Standard Input (stdin)</label>
                <div class="flex items-center gap-2">
                  <Show when={props.history.some(entry => Boolean(entry.stdin))}>
                    <select
                      aria-label="Load input from execution history"
                      class="max-w-28 rounded-md border border-border bg-bg-secondary px-2 py-1 text-[10px] text-brand-secondary"
                      value=""
                      onChange={(event) => {
                        const selected = props.history.find(entry => String(entry.id) === event.currentTarget.value);
                        if (selected) props.onInputChange(selected.stdin || '');
                        event.currentTarget.value = '';
                      }}
                    >
                      <option value="">Input history</option>
                      <For each={props.history.filter(entry => Boolean(entry.stdin))}>{(entry) => <option value={entry.id}>{entry.timestamp} · {entry.language}</option>}</For>
                    </select>
                  </Show>
                  <button type="button" class="text-[10px] font-medium text-brand-secondary hover:text-foreground" onClick={() => props.onInputChange('10 20')}>Sample</button>
                  <button type="button" class="text-[10px] font-medium text-brand-secondary hover:text-foreground" onClick={() => props.onInputChange('')}>Clear</button>
                </div>
              </div>
              <textarea
                id="execution-stdin"
                class="w-full bg-bg-tertiary border border-border rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-accent-blue/10 outline-none min-h-[100px] resize-y transition-all placeholder:text-muted"
                value={props.input}
                onInput={(e) => props.onInputChange(e.currentTarget.value)}
                placeholder="Data to feed your application..."
              />
            </div>
          </div>
        </section>

        <section class="flex-1 flex flex-col min-h-0">
          <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-secondary mb-4 flex items-center gap-2">
            <Terminal class="w-3.5 h-3.5" /> Output Streams
          </h3>
          <div class="flex-1 min-h-[250px] bg-bg-tertiary rounded-2xl border border-border flex flex-col overflow-hidden shadow-premium">
            <div class="px-5 py-3 border-b border-border flex items-center justify-between bg-bg-secondary/50">
              <Show when={props.executing} fallback={
                <div class="flex items-center gap-4 text-[10px] font-bold">
                  <Show when={props.currentFile?.executionTime}>
                    <span class="text-brand-secondary flex items-center gap-1.5">
                      <Clock class="w-3.5 h-3.5" /> {durationLabel(props.currentFile.executionTime)}
                    </span>
                  </Show>
                </div>
              }>
                <div class="flex-1 pr-6">
                  <div class="h-1.5 w-full bg-border rounded-full overflow-hidden">
                    <div class="h-full bg-accent-blue transition-all duration-300" style={{ width: `${props.progress}%` }} />
                  </div>
                </div>
              </Show>
              
              <div class="flex items-center gap-2">
                <Button variant="ghost" size="icon" class="h-8 w-8" onClick={copyOutput}>
                  <Copy class="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" class="h-8 w-8" onClick={props.onClearOutput}>
                  <Trash2 class="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" class="h-8 w-8" onClick={props.onVisualize}>
                  <Tv class="w-4 h-4 text-accent-blue" />
                </Button>
              </div>
            </div>

            <div class="flex border-b border-border text-[10px] font-bold uppercase tracking-wider">
              <For each={[
                { id: 'output', label: 'Output' },
                { id: 'errors', label: 'Errors' },
                { id: 'details', label: 'Details' },
                { id: 'history', label: 'History' },
              ]}>
                {(tab) => <button
                  class={cn('px-4 py-2.5 border-b-2 transition-colors', activeTab() === tab.id ? 'border-accent-blue text-foreground' : 'border-transparent text-brand-secondary hover:text-foreground')}
                  onClick={() => setActiveTab(tab.id)}
                >{tab.label}{tab.id === 'history' ? ` (${props.history.length})` : ''}</button>}
              </For>
            </div>

            <div class="flex-1 p-5 overflow-auto scrollbar-thin">
              <Show when={activeTab() === 'output'}>
                <Show when={props.currentFile?.outputTruncated}>
                  <p class="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">Output exceeded the capture limit and was truncated.</p>
                </Show>
                <Show when={props.executing || props.currentFile?.status} fallback={
                  <div class="h-full flex flex-col items-center justify-center text-brand-secondary gap-3 opacity-30">
                    <Terminal class="w-10 h-10" />
                    <span class="text-[10px] uppercase tracking-[0.2em] font-black text-center leading-loose">
                      Ready to run<br/>Press Run
                    </span>
                  </div>
                }>
                  <pre class="font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
                    <Show when={props.executing} fallback={
                      typeof props.currentFile?.output === 'string' && props.currentFile.output.length > 0
                        ? props.currentFile.output
                        : props.currentFile?.exitCode === 0 && props.currentFile?.status === 'ACCEPTED'
                          ? 'Program executed successfully with no output.'
                          : ''
                    }>
                      <span class="flex items-center gap-3 text-accent-blue font-bold animate-pulse">
                        <div class="w-2 h-2 rounded-full bg-current" />
                        {props.executionStage || 'Preparing execution...'}
                      </span>
                    </Show>
                  </pre>
                </Show>
              </Show>

              <Show when={activeTab() === 'errors'}>
                <Show when={props.currentFile?.compileError || props.currentFile?.stderr} fallback={<p class="text-xs text-brand-secondary">No errors reported.</p>}>
                  <div class="space-y-2">
                    <h4 class="text-xs font-bold text-red-400">
                      {props.currentFile?.compileError ? 'Compilation Error' : 'Runtime Error'}
                    </h4>
                    <pre class="font-mono text-[13px] leading-relaxed text-red-300 whitespace-pre-wrap">{props.currentFile?.compileError || props.currentFile?.stderr}</pre>
                  </div>
                </Show>
              </Show>

              <Show when={activeTab() === 'details'}>
                <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <dt class="text-brand-secondary">Status</dt><dd>{statusLabel(props.currentFile?.status)}</dd>
                  <dt class="text-brand-secondary">Execution ID</dt><dd class="truncate" title={props.currentFile?.executionId || undefined}>{props.currentFile?.executionId || 'Not available'}</dd>
                  <dt class="text-brand-secondary">Execution Time</dt><dd>{durationLabel(props.currentFile?.executionTime)}</dd>
                  <dt class="text-brand-secondary">Memory Usage</dt><dd>{props.currentFile?.memoryUsage || 'Not reported by execution service'}</dd>
                  <dt class="text-brand-secondary">Exit Code</dt><dd>{props.currentFile?.exitCode ?? 'Not reported by execution service'}</dd>
                  <dt class="text-brand-secondary">Language</dt><dd>{props.currentFile?.lang || 'Unknown'}</dd>
                </dl>
              </Show>

              <Show when={activeTab() === 'history'}>
                <Show when={props.history.length} fallback={<p class="text-xs text-brand-secondary">No executions in this session.</p>}>
                  <div class="space-y-1">
                    <For each={props.history}>
                      {(entry) => <button
                        class="w-full flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-blue"
                        onClick={() => props.onSelectHistory(entry)}
                      >
                        <span class="min-w-0 text-left"><span class="flex items-center gap-2 truncate text-xs"><History class="h-3.5 w-3.5 shrink-0 text-brand-secondary" />{entry.timestamp} · {entry.language}</span><span class="mt-1 block truncate font-mono text-[9px] text-brand-muted">ID {entry.executionId || entry.id}</span></span>
                        <span class="shrink-0 text-right text-[10px] text-brand-secondary"><span class="block">{statusLabel(entry.result.status)}</span><span class="block">{durationLabel(entry.result.executionTime).replace('Not available', 'Duration n/a')}</span></span>
                      </button>}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>
          </div>
        </section>
      </div>

      <div class="p-5 border-t border-border bg-bg-tertiary flex items-center justify-between shrink-0">
        <div class="flex gap-6 text-[10px] font-bold text-brand-secondary uppercase tracking-widest">
          <span>{props.codeStats.lines} Lines</span>
          <span>{props.codeStats.words} Words</span>
        </div>
        <div class="flex items-center gap-2 text-accent-pink">
           <AlertCircle class="w-3.5 h-3.5" />
           <span class="text-[10px] font-black uppercase tracking-widest">Cloud V2.0</span>
        </div>
      </div>
    </div>
  );
};

export default ExecutionPanel;
