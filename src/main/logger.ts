import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

let initialized = false;
let logFilePath = '';

function ts() {
  const d = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function write(level: string, args: any[]) {
  if (!initialized) return;
  try {
    const line = `[${ts()}] [${level}] ` + args.map(a => {
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ''}`;
      if (typeof a === 'object') return JSON.stringify(a);
      return String(a);
    }).join(' ') + '\n';
    fs.appendFileSync(logFilePath, line);
  } catch (err) {
    process.stderr.write('log write error\n');
  }
}

export function initLogger() {
  if (initialized) return;
  try {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    logFilePath = path.join(dir, 'electron.log');

    const original = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    console.log = (...args: any[]) => { write('INFO', args); original.log(...args); };
    console.info = (...args: any[]) => { write('INFO', args); original.info(...args); };
    console.warn = (...args: any[]) => { write('WARN', args); original.warn(...args); };
    console.error = (...args: any[]) => { write('ERROR', args); original.error(...args); };

    process.on('uncaughtException', (err) => { write('UNCAUGHT', [err]); });
    process.on('unhandledRejection', (reason) => { write('UNHANDLED', [reason as any]); });

    app.on('render-process-gone', (_, details) => { write('RENDER_GONE', [details]); });
    app.on('child-process-gone', (_, details) => { write('CHILD_GONE', [details]); });

    initialized = true;
    write('INFO', ['logger initialized', logFilePath]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`logger init failed: ${msg}\n`);
  }
}

export function getLogFilePath() {
  return logFilePath;
}
