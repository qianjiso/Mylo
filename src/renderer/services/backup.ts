import type { ExportOptions, ImportOptions, ImportResult } from '../../shared/types';

export async function exportData(options: ExportOptions): Promise<Uint8Array> {
  const res = await window.electronAPI.exportData(options);
  if (!res.success || !res.data) throw new Error(res.error || 'export failed');
  return new Uint8Array(res.data);
}

export async function importData(data: Uint8Array, options: ImportOptions): Promise<ImportResult> {
  const res = await window.electronAPI.importData(Array.from(data), options);
  if (!res.success || !res.data) throw new Error(res.error || 'import failed');
  return res.data as ImportResult;
}
