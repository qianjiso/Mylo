import { ipcMain } from 'electron';
import { logError, LogContext } from '../logger';

export interface RendererLogPayload {
  code?: string;
  message: string;
  context?: LogContext;
  stack?: string;
  source?: string;
}

export function registerLoggingIpc(): void {
  ipcMain.handle('renderer-report-error', async (_event, payload: RendererLogPayload) => {
    const { code, message, context, stack, source } = payload || {};
    const mergedContext: LogContext = {
      ...(context || {}),
      source: source || 'renderer',
      stack,
    };
    logError(code || 'RENDERER_ERROR', message || 'renderer error', undefined, mergedContext);
  });
}

