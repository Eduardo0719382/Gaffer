// Migraciones del formato de proyecto. Cada versión de SCHEMA agrega un paso aquí.
import { Project, SCHEMA, defaultSettings, uid } from '../model';

export function migrate(raw: any): Project {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.scenes)) throw new Error('El archivo no es un proyecto de Gaffer.');
  const p = raw as Project;
  if ((p.schema ?? 0) > SCHEMA) throw new Error('Este proyecto se hizo con una versión más nueva de Gaffer. Actualiza la app para abrirlo.');
  p.settings = { ...defaultSettings(), ...(p.settings ?? {}) };
  p.id ||= uid();
  p.name ||= 'Proyecto';
  p.scenes.forEach(s => { s.objects ??= []; s.notes ??= ''; });
  p.schema = SCHEMA;
  return p;
}
