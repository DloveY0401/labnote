/**
 * Drizzle ORM query helpers for LabNote.
 *
 * In Electron, all DB access goes through IPC (electron/main.ts).
 * These are type-only helpers for reference; actual queries use window.labnote.* API.
 */

import type {
  Project,
  Experiment,
  ExperimentDetail,
  Reactant,
  Catalyst,
  Solvent,
  Tag,
  Template,
  CreateExperimentInput,
  UpdateExperimentInput,
  ModuleTemplate,
  ModuleLayoutItem,
} from '../types';

function getApi() {
  if (!window.labnote) {
    const msg = '[LabNote] window.labnote is not available. Is preload.js loaded?';
    console.error(msg);
    throw new Error(msg);
  }
  return window.labnote;
}

// ── Project Queries ──

export async function getProjects(): Promise<Project[]> {
  return getApi().projects.list();
}

export async function getProject(id: number): Promise<Project | undefined> {
  return getApi().projects.get(id);
}

export async function createProject(data: { name: string; description?: string; innovations?: string; tasks?: string; progress?: number }): Promise<number> {
  return getApi().projects.create(data);
}

export async function updateProject(id: number, data: { name?: string; description?: string; innovations?: string; tasks?: string; progress?: number }): Promise<void> {
  return getApi().projects.update(id, data);
}

export async function deleteProject(id: number): Promise<void> {
  return getApi().projects.delete(id);
}

// ── Experiment Queries ──

export async function getExperiments(): Promise<Experiment[]> {
  return getApi().experiments.list();
}

export async function getExperiment(id: number): Promise<ExperimentDetail | null> {
  return getApi().experiments.get(id);
}

export async function createExperiment(data: CreateExperimentInput): Promise<number> {
  return getApi().experiments.create(data);
}

export async function updateExperiment(id: number, data: UpdateExperimentInput): Promise<void> {
  return getApi().experiments.update(id, data);
}

export async function deleteExperiment(id: number): Promise<void> {
  return getApi().experiments.delete(id);
}

// ── Tag Queries ──

export async function getTags(type?: string): Promise<Tag[]> {
  return getApi().tags.list(type);
}

export async function createTag(data: { name: string; color?: string; type?: string }): Promise<number> {
  return getApi().tags.create(data);
}

export async function deleteTag(id: number): Promise<void> {
  return getApi().tags.delete(id);
}

export async function updateTag(id: number, data: { name: string; color?: string }): Promise<void> {
  return getApi().tags.update(id, data);
}

// ── Template Queries ──

export async function getTemplates(): Promise<Template[]> {
  return getApi().templates.list();
}

export async function getTemplate(id: number): Promise<Template | undefined> {
  return getApi().templates.get(id);
}

export async function createTemplate(data: { name: string; description?: string; template_data: string }): Promise<number> {
  return getApi().templates.create(data);
}

export async function deleteTemplate(id: number): Promise<void> {
  return getApi().templates.delete(id);
}

export async function updateTemplate(id: number, data: { name?: string; description?: string; template_data?: string }): Promise<void> {
  return getApi().templates.update(id, data);
}

export async function incrementTemplateUsage(id: number): Promise<void> {
  return getApi().templates.incrementUsage(id);
}

export async function getAllExperimentTags(): Promise<{ experiment_id: number; tag_id: number }[]> {
  return getApi().experiments.allTags();
}

// ── Reagent Queries ──

export async function getReagents(): Promise<any[]> {
  return getApi().reagents.list();
}

export async function getReagent(id: number): Promise<any> {
  return getApi().reagents.get(id);
}

// ── Module Template Queries ──

export async function getModuleTemplates(): Promise<ModuleTemplate[]> {
  const raw = await getApi().modules.templates.list();
  return raw.map((t: any) => ({
    ...t,
    fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields,
    is_preset: !!t.is_preset,
  }));
}

export async function getModuleTemplate(id: number): Promise<ModuleTemplate | undefined> {
  const raw = await getApi().modules.templates.get(id);
  if (!raw) return undefined;
  return {
    ...raw,
    fields: typeof raw.fields === 'string' ? JSON.parse(raw.fields) : raw.fields,
    is_preset: !!raw.is_preset,
  };
}

export async function createModuleTemplate(data: { name: string; description?: string; category?: string; fields: string }): Promise<number> {
  return getApi().modules.templates.create(data);
}

export async function updateModuleTemplate(id: number, data: { name?: string; description?: string; fields?: string }): Promise<void> {
  return getApi().modules.templates.update(id, data);
}

export async function deleteModuleTemplate(id: number): Promise<void> {
  return getApi().modules.templates.delete(id);
}

// ── Task Queries ──
import type { Task, CreateTaskInput, UpdateTaskInput } from '../types';

export async function getTasks(filters?: { status?: string; experiment_id?: number; tag_id?: number }): Promise<Task[]> {
  return getApi().tasks.list(filters);
}

export async function getTask(id: number): Promise<Task | null> {
  return getApi().tasks.get(id);
}

export async function createTask(data: CreateTaskInput): Promise<number> {
  return getApi().tasks.create(data);
}

export async function updateTask(id: number, data: UpdateTaskInput): Promise<void> {
  return getApi().tasks.update(id, data);
}

export async function deleteTask(id: number): Promise<void> {
  return getApi().tasks.delete(id);
}

export async function getTasksByExperiment(experimentId: number): Promise<Task[]> {
  return getApi().tasks.getByExperiment(experimentId);
}
