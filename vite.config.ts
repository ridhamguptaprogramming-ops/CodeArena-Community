import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  plugins: [
    solidPlugin(),
    (monacoEditorPlugin as any).default ? (monacoEditorPlugin as any).default({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html', 'css']
    }) : (monacoEditorPlugin as any)({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html', 'css']
    })
  ],
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
});
