// Almacenamiento local (IndexedDB). Todo funciona sin internet.
import { get, set, del } from 'idb-keyval';
import type { Fixture, Project } from '../model';
import { migrate } from './migrate';

export interface ProjectMeta { id: string; name: string; updated: number; scenes: number }

export async function listProjects(): Promise<ProjectMeta[]> {
  return ((await get<ProjectMeta[]>('index')) ?? []).sort((a, b) => b.updated - a.updated);
}

export async function loadProject(id: string): Promise<Project | null> {
  const p = await get<Project>('proj:' + id);
  return p ? migrate(p) : null;
}

export async function saveProject(p: Project): Promise<void> {
  await set('proj:' + p.id, p);
  const idx = (await get<ProjectMeta[]>('index')) ?? [];
  const meta = { id: p.id, name: p.name, updated: p.updated, scenes: p.scenes.length };
  await set('index', [meta, ...idx.filter(m => m.id !== p.id)]);
}

export async function deleteProject(id: string): Promise<void> {
  await del('proj:' + id);
  const idx = (await get<ProjectMeta[]>('index')) ?? [];
  await set('index', idx.filter(m => m.id !== id));
}

export async function loadCustomFixtures(): Promise<Fixture[]> {
  return (await get<Fixture[]>('customFixtures')) ?? [];
}
export async function saveCustomFixtures(list: Fixture[]): Promise<void> {
  await set('customFixtures', list);
}
