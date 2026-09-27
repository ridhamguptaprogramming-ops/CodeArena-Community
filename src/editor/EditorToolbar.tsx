import { For, Show, JSX } from 'solid-js';
import { A } from '@solidjs/router';
import {
  Play,
  Plus,
  X,
  Code2,
  Zap,
  Settings,
  PanelLeft,
  Tv,
  Sun,
  Moon
} from 'lucide-solid';
import Button from '../ui/Button';
import { cn } from '../utils/cn';
import { useTheme } from '../utils/theme-signal';

interface EditorToolbarProps {
  files: any[];
  activeFileId: number;
  onSetActiveFile: (id: number) => void;
  onAddFile: () => void;
  onDeleteFile: (id: number, e: MouseEvent) => void;
  onRun: () => void;
  onFormat: () => void;
  onToggleFullscreen: () => void;
  onVisualize: () => void;
  executing: boolean;
  progress: number;
  onToggleSettings: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  children?: JSX.Element;
}

const EditorToolbar = (props: EditorToolbarProps) => {
  const { uiTheme, toggleTheme } = useTheme();
  return (
    <div class="h-14 border-b border-border bg-bg-secondary/80 backdrop-blur-xl flex items-center justify-between px-4 z-50 transition-colors duration-300">
      <div class="flex items-center gap-4 flex-1 overflow-hidden">
        <A href="/" class="flex items-center gap-2 group mr-4 shrink-0">
          <div class="w-8 h-8 flex items-center justify-center bg-foreground text-background rounded-lg shadow-premium transition-transform group-hover:rotate-12">
            <Zap class="w-4 h-4 fill-current" />
          </div>
          <span class="font-bold tracking-tight text-sm hidden sm:block">CodeArena</span>
        </A>

        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          <For each={props.files}>
            {(file) => (
              <div
                class={cn(
                  'group relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border border-transparent',
                  props.activeFileId === file.id 
                    ? 'bg-foreground text-background shadow-premium'
                    : 'text-brand-secondary hover:bg-foreground/5 hover:text-foreground'
                )}
                onClick={() => props.onSetActiveFile(file.id)}
              >
                <Code2 class={cn("w-3.5 h-3.5", props.activeFileId === file.id ? "text-background" : "text-brand-secondary")} />
                <span class="max-w-[120px] truncate">{file.name}</span>
                <Show when={props.files.length > 1}>
                  <button 
                    class="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onDeleteFile(file.id, e);
                    }}
                  >
                    <X class="w-3 h-3" />
                  </button>
                </Show>
              </div>
            )}
          </For>
          <button 
            onClick={props.onAddFile}
            class="p-1.5 rounded-xl hover:bg-foreground/5 text-brand-secondary transition-colors ml-1"
          >
            <Plus class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2 ml-4">
        <Button variant="ghost" size="sm" class="hidden md:inline-flex" onClick={props.onFormat} aria-label="Format code">Format</Button>
        <Button variant="ghost" size="icon" class="h-8 w-8" onClick={props.onToggleFullscreen} aria-label="Toggle editor fullscreen">⛶</Button>
        <div class="flex items-center bg-bg-tertiary rounded-xl p-1 border border-border">
          <Button 
            variant="brand" 
            size="sm" 
            onClick={props.onRun}
            disabled={props.executing}
            class="h-8 px-4 font-bold"
            leftIcon={props.executing ? undefined : <Play class="w-3.5 h-3.5 fill-current" />}
            loading={props.executing}
          >
            {props.executing ? 'Running...' : 'Run'}
          </Button>
          <div class="w-px h-4 bg-border mx-2" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={props.onVisualize}
            class="h-8 px-3 text-[11px] font-bold tracking-tight uppercase"
            leftIcon={<Tv class="w-3.5 h-3.5" />}
          >
            Visualizer
          </Button>
        </div>

        <div class="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            class="h-8 w-8 text-brand-secondary hover:text-foreground" 
            onClick={toggleTheme}
          >
            <Show when={uiTheme() === 'light'} fallback={<Sun class="w-3.5 h-3.5" />}>
               <Moon class="w-3.5 h-3.5" />
            </Show>
          </Button>

          <Button variant="ghost" size="icon" class="h-8 w-8" onClick={props.onToggleSidebar}>
            <PanelLeft class={cn("w-4 h-4", props.sidebarOpen ? "text-foreground" : "text-brand-secondary")} />
          </Button>
          {props.children}
        </div>
      </div>
    </div>
  );
};

export default EditorToolbar;
