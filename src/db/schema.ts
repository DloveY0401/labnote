import { sqliteTable, integer, real, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const experiments = sqliteTable('experiments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  date: text('date').notNull(),
  container: text('container'),
  temperature: text('temperature'),
  time: text('time'),
  pressure: text('pressure'),
  ph: text('ph'),
  stirring: text('stirring'),
  atmosphere: text('atmosphere'),
  procedure: text('procedure'),
  workup: text('workup'),
  yieldVal: real('yield_val'),
  yieldUnit: text('yield_unit').default('%'),
  morphology: text('morphology'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const reactants = sqliteTable('reactants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  experimentId: integer('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  formula: text('formula'),
  amount: real('amount'),
  amountUnit: text('amount_unit'),
  equiv: real('equiv'),
  role: text('role'),
  sortOrder: integer('sort_order'),
});

export const catalysts = sqliteTable('catalysts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  experimentId: integer('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: real('amount'),
  amountUnit: text('amount_unit'),
  loading: text('loading'),
  sortOrder: integer('sort_order'),
});

export const solvents = sqliteTable('solvents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  experimentId: integer('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  volume: real('volume'),
  volumeUnit: text('volume_unit'),
  ratio: text('ratio'),
  sortOrder: integer('sort_order'),
});

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').default('#3b82f6'),
});

export const experimentTags = sqliteTable('experiment_tags', {
  experimentId: integer('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.experimentId, table.tagId] }),
}));

export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  templateData: text('template_data').notNull(),
  usageCount: integer('usage_count').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const moduleTemplates = sqliteTable('module_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull().default('custom'),
  icon: text('icon'),
  fields: text('fields').notNull().default('[]'),
  isPreset: integer('is_preset').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const experimentModuleData = sqliteTable('experiment_module_data', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  experimentId: integer('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
  moduleKey: text('module_key').notNull(),
  moduleType: text('module_type').notNull().default('custom'),
  data: text('data').notNull().default('{}'),
  sortOrder: integer('sort_order').notNull().default(0),
});
