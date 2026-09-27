import { apiClient } from './api-client';

export type ExecutionStatus =
  | 'ACCEPTED'
  | 'COMPILATION_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'INVALID_REQUEST'
  | 'SERVICE_UNAVAILABLE'
  | 'SYSTEM_ERROR';

export interface ExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  compileError: string;
  exitCode: number | null;
  executionTime: string | null;
  memoryUsage: string | null;
  outputTruncated: boolean;
  message: string;
}

type ProgressHandler = (progress: number) => void;

/** These values describe the execution contract sent to the configured backend. */
const LANGUAGE_CONFIG: Record<string, {
  language: string;
  filename: string;
  runtime: string;
}> = {
  java: { language: 'java', filename: 'Main.java', runtime: 'java17' },
  python: { language: 'python3', filename: 'main.py', runtime: 'python3' },
  javascript: { language: 'javascript', filename: 'main.js', runtime: 'node' },
  cpp: { language: 'cpp', filename: 'main.cpp', runtime: 'cpp17' },
  c: { language: 'c', filename: 'main.c', runtime: 'c17' },
};

const getApiUrl = () => import.meta.env.VITE_API_URL?.trim();
const makeId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeStatus = (status: unknown): ExecutionStatus | null => {
  const value = String(status || '').trim().toUpperCase().replace(/[ -]+/g, '_');
  if (['ACCEPTED', 'SUCCESS', 'COMPLETED', 'OK'].includes(value)) return 'ACCEPTED';
  if (['COMPILATION_ERROR', 'COMPILE_ERROR', 'COMPILATION_FAILED'].includes(value)) return 'COMPILATION_ERROR';
  if (['RUNTIME_ERROR', 'RUNTIME_FAILED'].includes(value)) return 'RUNTIME_ERROR';
  if (['TIME_LIMIT_EXCEEDED', 'TIMEOUT', 'TIMED_OUT'].includes(value)) return 'TIME_LIMIT_EXCEEDED';
  if (['MEMORY_LIMIT_EXCEEDED', 'OUT_OF_MEMORY'].includes(value)) return 'MEMORY_LIMIT_EXCEEDED';
  if (['INVALID_REQUEST', 'BAD_REQUEST', 'VALIDATION_ERROR'].includes(value)) return 'INVALID_REQUEST';
  if (['SERVICE_UNAVAILABLE', 'UNAVAILABLE'].includes(value)) return 'SERVICE_UNAVAILABLE';
  if (['SYSTEM_ERROR', 'FAILED', 'ERROR'].includes(value)) return 'SYSTEM_ERROR';
  return null;
};

const resultError = (executionId: string, status: ExecutionStatus, message: string): ExecutionResult => ({
  executionId, status, stdout: '', stderr: message, compileError: '', exitCode: null,
  executionTime: null, memoryUsage: null, outputTruncated: false, message,
});

const asOptionalString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

class ExecutionService {
  private readonly timeoutMs = 30000;

  async execute(sourceCode: string, language: string, stdin: string, onProgress?: ProgressHandler): Promise<ExecutionResult> {
    const executionId = makeId();
    const config = LANGUAGE_CONFIG[language];
    if (!config) return resultError(executionId, 'INVALID_REQUEST', `Unsupported language: ${language}`);

    const apiUrl = getApiUrl();
    if (!apiUrl || /your-execution-service\.example/i.test(apiUrl)) {
      return resultError(executionId, 'SERVICE_UNAVAILABLE', 'Execution service is not configured. Set VITE_API_URL to a running execution API.');
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.timeoutMs);
    onProgress?.(10);

    try {
      const payload = {
        executionId,
        sourceCode,
        stdin,
        language: config.language,
        filename: config.filename,
        runtime: config.runtime,
        executionMode: 'RUN',
        // Preserve compatibility with the existing API DTO aliases.
        src: sourceCode,
        lang: config.language,
      };

      onProgress?.(35);
      const response = await apiClient.post('/submit', payload, {
        signal: controller.signal,
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        const detail = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? '');
        const apiError = response.data;
        const errorCode = String(apiError?.error?.code || '').toUpperCase();
        const status = response.status === 400 || response.status === 422
          ? 'INVALID_REQUEST'
          : response.status === 503 || response.status === 502 || response.status === 404 || response.status >= 500
            ? 'SERVICE_UNAVAILABLE'
            : 'SYSTEM_ERROR';
        const message = apiError?.error?.message
          || apiError?.message
          || (errorCode ? `${errorCode.replace(/_/g, ' ')}.` : '')
          || detail
          || (status === 'INVALID_REQUEST' ? 'Invalid execution request.' : 'Execution service unavailable.');
        return resultError(executionId, status, message);
      }

      onProgress?.(70);
      const body = response.data;
      const data = body?.data ?? body;
      const outputValue = data?.output ?? body?.output;
      const stdoutValue = typeof data?.stdout === 'string'
        ? data.stdout
        : typeof outputValue === 'string'
          ? outputValue
          : typeof outputValue?.stdout === 'string'
            ? outputValue.stdout
            : typeof body?.stdout === 'string' ? body.stdout : undefined;
      const stderrValue = data?.stderr ?? data?.error ?? body?.stderr ?? body?.error;
      const stdoutPresent = typeof stdoutValue === 'string';
      const stdout = stdoutPresent ? stdoutValue : '';
      const stderr = typeof stderrValue === 'string' ? stderrValue : '';
      const compileError = asOptionalString(data?.compileError ?? body?.compileError) || '';
      const responseExecutionId = asOptionalString(data?.executionId ?? body?.executionId) || executionId;
      const status = normalizeStatus(data?.status ?? body?.status);
      const exitCode = typeof data?.exitCode === 'number'
        ? data.exitCode
        : typeof body?.exitCode === 'number' ? body.exitCode : null;
      const finalStatus = status
        ?? (body?.success === true ? 'ACCEPTED' : null)
        ?? (exitCode === 0 ? 'ACCEPTED' : exitCode !== null ? 'RUNTIME_ERROR' : null);

      if (!finalStatus) {
        return resultError(executionId, 'SYSTEM_ERROR', 'Execution service returned no process status or exit code.');
      }

      if (!stdoutPresent) {
        const message = 'Execution service response is missing the stdout field.';
        return {
          executionId: responseExecutionId,
          status: 'SYSTEM_ERROR',
          stdout: '',
          stderr: stderr ? `${stderr}\n${message}` : message,
          compileError,
          exitCode,
          executionTime: asOptionalString(data?.executionTime ?? data?.time ?? body?.executionTime ?? body?.time),
          memoryUsage: asOptionalString(data?.memoryUsage ?? data?.memory ?? body?.memoryUsage ?? body?.memory),
          outputTruncated: Boolean(data?.outputTruncated ?? body?.outputTruncated),
          message,
        };
      }

      const message = asOptionalString(data?.message ?? body?.message)
        || (finalStatus === 'ACCEPTED'
          ? (stdout.trim() === '' && exitCode === 0 ? 'Program executed successfully with no output.' : 'Execution completed.')
          : finalStatus.replace(/_/g, ' '));

      onProgress?.(100);
      return {
        executionId: responseExecutionId,
        status: finalStatus,
        stdout,
        stderr,
        compileError: compileError || (finalStatus === 'COMPILATION_ERROR' ? stderr : ''),
        exitCode,
        executionTime: asOptionalString(data?.executionTime ?? data?.time ?? body?.executionTime ?? body?.time),
        memoryUsage: asOptionalString(data?.memoryUsage ?? data?.memory ?? body?.memoryUsage ?? body?.memory),
        outputTruncated: Boolean(data?.outputTruncated ?? body?.outputTruncated),
        message,
      };
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return resultError(executionId, 'TIME_LIMIT_EXCEEDED', 'Execution service did not respond within 30 seconds.');
      }
      const message = error instanceof Error ? error.message : 'Unknown execution service error.';
      return resultError(executionId, 'SERVICE_UNAVAILABLE', `Execution service unavailable: ${message}`);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
}

export const executionService = new ExecutionService();
