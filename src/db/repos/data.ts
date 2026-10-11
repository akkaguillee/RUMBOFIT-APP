import { ALL_TABLES, db, type TableName } from '../db';
import { scheduleSync } from '../sync';

const FORMAT = 'rumbo-export';
const VERSION = 1;

export interface ExportFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

export async function exportAll(): Promise<ExportFile> {
  const tables: ExportFile['tables'] = {};
  for (const name of ALL_TABLES) tables[name] = await db.table(name).toArray();
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), tables };
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseExport(text: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const file = data as Partial<ExportFile>;
  if (!file || file.format !== FORMAT || typeof file.tables !== 'object' || file.tables === null) {
    throw new Error('El archivo no es una copia de seguridad de RUMBO.');
  }
  if ((file.version ?? 0) > VERSION) throw new Error('La copia procede de una versión más reciente de RUMBO.');
  for (const [name, rows] of Object.entries(file.tables)) {
    if (!ALL_TABLES.includes(name as TableName)) throw new Error(`Tabla desconocida: ${name}`);
    if (!Array.isArray(rows)) throw new Error(`Formato no válido en ${name}.`);
  }
  const profile = file.tables.profile?.[0] as { id?: string; name?: string } | undefined;
  if (!profile || profile.id !== 'me' || typeof profile.name !== 'string') {
    throw new Error('La copia no contiene un perfil válido.');
  }
  return file as ExportFile;
}

/** Replaces all local data with the backup contents (atomic). */
export async function importAll(file: ExportFile): Promise<void> {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const name of ALL_TABLES) {
      await db.table(name).clear();
      const rows = file.tables[name];
      if (rows?.length) await db.table(name).bulkAdd(rows);
    }
  });
  scheduleSync();
}

export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const name of ALL_TABLES) await db.table(name).clear();
  });
}
