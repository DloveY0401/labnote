// ── Project ──
export interface Project {
  id: number;
  name: string;
  description: string | null;
  innovations: string;
  tasks: string;
  progress: number;
  created_at: string;
  experiment_count?: number;
}

// ── Reactant ──
export interface Reactant {
  id?: number;
  experiment_id?: number;
  name: string;
  formula: string;
  amount: number | null;
  amount_unit: string;
  equiv: number | null;
  role: string;
  sort_order?: number;
  structure_image?: string | null;
  molecular_weight: number | null;
  molar_amount: number | null;
}

// ── Catalyst ──
export interface Catalyst {
  id?: number;
  experiment_id?: number;
  name: string;
  amount: number | null;
  amount_unit: string;
  loading?: string;  // 保留但可选，前端不再显示
  sort_order?: number;
  molecular_weight: number | null;
  molar_amount: number | null;
}

// ── Reagent ──
export interface Reagent {
  id: number;
  name: string;
  abbreviation: string;
  molecular_weight: number | null;
  molecular_formula: string;
  structure_image: string | null;
  created_at: string;
}

// ── Solvent ──
export interface Solvent {
  id?: number;
  experiment_id?: number;
  name: string;
  volume: number | null;
  volume_unit: string;
  ratio: string;
  sort_order?: number;
}

// ── Tag ──
export interface Tag {
  id: number;
  name: string;
  color: string;
  type?: string;
}

// ── Template ──
export interface Template {
  id: number;
  name: string;
  description: string | null;
  template_data: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// ── Task / Todo ──
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  experiment_id: number | null;
  experiment_title?: string | null;
  experiment_date?: string | null;
  parent_task_id: number | null;
  recurrence_rule: string | null;
  subtasks?: Task[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  experiment_id?: number | null;
  parent_task_id?: number | null;
  recurrence_rule?: string | null;
  tag_ids?: number[];
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

// ── Experiment (list view) ──
export interface Experiment {
  id: number;
  title: string;
  subtitle: string | null;
  project_id: number | null;
  project_name: string | null;
  date: string;
  yield_val: number | null;
  structure_image: string | null;
  created_at: string;
  updated_at: string;
}

// ── Experiment Detail ──
export interface ExperimentDetail extends Experiment {
  container: string | null;
  temperature: string | null;
  time: string | null;
  pressure: string | null;
  ph: string | null;
  stirring: string | null;
  atmosphere: string | null;
  procedure: string | null;
  workup: string | null;
  yield_unit: string;
  morphology: string | null;
  notes: string | null;
  result_images: string | null;
  structure_image: string | null;
  module_layout: string | null;
  reactants: Reactant[];
  catalysts: Catalyst[];
  solvents: Solvent[];
  tags: Tag[];
  custom_modules?: ExperimentModuleData[];
}

// ── Module System ──
export interface ModuleField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'image' | 'structure';
  placeholder?: string;
  required?: boolean;
  options?: string[];
  span?: 'full' | 'half';
}

export interface ModuleTemplate {
  id: number;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  fields: ModuleField[];
  is_preset: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ExperimentModuleData {
  id?: number;
  experiment_id?: number;
  module_key: string;
  module_type: 'standard' | 'custom';
  data: Record<string, any>;
  sort_order: number;
}

export interface ModuleLayoutItem {
  key: string;
  type: 'standard' | 'custom';
}

export interface StandardModuleDef {
  key: string;
  name: string;
  category: 'core' | 'reagents' | 'description' | 'meta';
  required: boolean;
}

// ── Experiment Form Data ──
export interface CreateExperimentInput {
  title: string;
  subtitle?: string;
  project_id: number | null;
  date: string;
  container?: string;
  temperature?: string;
  time?: string;
  pressure?: string;
  ph?: string;
  stirring?: string;
  atmosphere?: string;
  procedure?: string;
  workup?: string;
  yield_val?: number | null;
  yield_unit?: string;
  morphology?: string;
  notes?: string;
  result_images?: string | null;
  structure_image?: string | null;
  reactants?: Omit<Reactant, 'id' | 'experiment_id'>[];
  catalysts?: Omit<Catalyst, 'id' | 'experiment_id'>[];
  solvents?: Omit<Solvent, 'id' | 'experiment_id'>[];
  tag_ids?: number[];
  module_layout?: ModuleLayoutItem[];
  custom_modules?: { module_key: string; data: Record<string, any> }[];
}

export type UpdateExperimentInput = CreateExperimentInput;

declare global {
  interface Window {
    labnote: {
      app: {
        getDataPath: () => Promise<string>;
      };
      images: {
        save: (dataUrl: string) => Promise<string>;
      };
      projects: {
        list: () => Promise<Project[]>;
        get: (id: number) => Promise<Project | undefined>;
        create: (data: { name: string; description?: string; innovations?: string; tasks?: string; progress?: number }) => Promise<number>;
        update: (id: number, data: { name?: string; description?: string; innovations?: string; tasks?: string; progress?: number }) => Promise<void>;
        delete: (id: number) => Promise<void>;
      };
      experiments: {
        list: () => Promise<Experiment[]>;
        get: (id: number) => Promise<ExperimentDetail | null>;
        create: (data: CreateExperimentInput) => Promise<number>;
        update: (id: number, data: UpdateExperimentInput) => Promise<void>;
        delete: (id: number) => Promise<void>;
        tags: (expId: number) => Promise<{ tag_id: number }[]>;
        allTags: () => Promise<{ experiment_id: number; tag_id: number }[]>;
        export: (id: number) => Promise<string | null>;
        exportData: (id: number) => Promise<any>;
        setModuleLayout: (id: number, layout: ModuleLayoutItem[]) => Promise<void>;
        getCustomModules: (id: number) => Promise<ExperimentModuleData[]>;
        saveCustomModules: (id: number, modules: { module_key: string; data: Record<string, any> }[]) => Promise<void>;
      };
      tags: {
        list: () => Promise<Tag[]>;
        create: (data: { name: string; color?: string }) => Promise<number>;
        update: (id: number, data: { name: string; color?: string }) => Promise<void>;
        delete: (id: number) => Promise<void>;
      };
      templates: {
        list: () => Promise<Template[]>;
        get: (id: number) => Promise<Template | undefined>;
        create: (data: { name: string; description?: string; template_data: string }) => Promise<number>;
        update: (id: number, data: { name?: string; description?: string; template_data?: string }) => Promise<void>;
        delete: (id: number) => Promise<void>;
        incrementUsage: (id: number) => Promise<void>;
      };
      reagents: {
        list: () => Promise<Reagent[]>;
        get: (id: number) => Promise<Reagent | undefined>;
        create: (data: { name: string; abbreviation?: string; molecular_weight?: number; molecular_formula?: string; structure_image?: string }) => Promise<number>;
        update: (id: number, data: { name?: string; abbreviation?: string; molecular_weight?: number; molecular_formula?: string; structure_image?: string }) => Promise<void>;
        delete: (id: number) => Promise<void>;
      };
      modules: {
        templates: {
          list: () => Promise<ModuleTemplate[]>;
          get: (id: number) => Promise<ModuleTemplate | undefined>;
          create: (data: { name: string; description?: string; category?: string; fields: string }) => Promise<number>;
          update: (id: number, data: { name?: string; description?: string; fields?: string }) => Promise<void>;
          delete: (id: number) => Promise<void>;
        };
      };
      compound: {
        getName: (smiles: string) => Promise<string | null>;
        setName: (smiles: string, name: string) => Promise<void>;
      };
      tasks: {
        list: (filters?: { status?: string; experiment_id?: number; tag_id?: number }) => Promise<Task[]>;
        get: (id: number) => Promise<Task | null>;
        create: (data: CreateTaskInput) => Promise<number>;
        update: (id: number, data: UpdateTaskInput) => Promise<void>;
        delete: (id: number) => Promise<void>;
        getByExperiment: (experimentId: number) => Promise<Task[]>;
      };
      widget: {
        toggle: () => Promise<void>;
        openMain: () => Promise<void>;
        navigateTo: (path: string) => Promise<void>;
        devtools: () => Promise<void>;
        onDataChanged: (callback: () => void) => () => void;
      };
      };
    };
  }
}
