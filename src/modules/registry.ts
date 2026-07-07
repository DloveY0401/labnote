import type { StandardModuleDef, ModuleTemplate, ModuleLayoutItem } from '../types';

/**
 * Standard module definitions - what the 9 built-in modules are.
 * These are separate from module_layout; the layout only controls visibility/order.
 */
export const STANDARD_MODULES: Record<string, StandardModuleDef> = {
  basic_info: {
    key: 'basic_info',
    name: '基本信息',
    category: 'core',
    required: true,
  },
  conditions: {
    key: 'conditions',
    name: '反应条件',
    category: 'core',
    required: false,
  },
  reactants: {
    key: 'reactants',
    name: '反应物',
    category: 'reagents',
    required: false,
  },
  catalysts: {
    key: 'catalysts',
    name: '催化剂',
    category: 'reagents',
    required: false,
  },
  solvents: {
    key: 'solvents',
    name: '溶剂',
    category: 'reagents',
    required: false,
  },
  procedure: {
    key: 'procedure',
    name: '实验步骤',
    category: 'description',
    required: false,
  },
  workup: {
    key: 'workup',
    name: '后处理',
    category: 'description',
    required: false,
  },
  results: {
    key: 'results',
    name: '实验结果',
    category: 'core',
    required: false,
  },
  tags: {
    key: 'tags',
    name: '标签',
    category: 'meta',
    required: false,
  },
};

/** Default module layout - all standard modules visible */
export const DEFAULT_LAYOUT: ModuleLayoutItem[] = [
  { key: 'basic_info', type: 'standard' },
  { key: 'conditions', type: 'standard' },
  { key: 'reactants', type: 'standard' },
  { key: 'catalysts', type: 'standard' },
  { key: 'solvents', type: 'standard' },
  { key: 'procedure', type: 'standard' },
  { key: 'workup', type: 'standard' },
  { key: 'results', type: 'standard' },
  { key: 'tags', type: 'standard' },
];

export function parseModuleLayout(raw: string | null | undefined): ModuleLayoutItem[] {
  if (!raw) return DEFAULT_LAYOUT;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const seen = new Set<string>();
      const valid = parsed.filter(
        (item: any) => {
          if (!item || typeof item.key !== 'string') return false;
          if (!(item.type === 'standard' || item.type === 'custom')) return false;
          if (seen.has(item.key)) return false;  // deduplicate
          seen.add(item.key);
          return true;
        }
      );
      if (valid.length > 0) return valid;
    }
  } catch { /* fall through */ }
  return DEFAULT_LAYOUT;
}

export function layoutToJson(layout: ModuleLayoutItem[]): string {
  return JSON.stringify(layout);
}

/** Get all standard module keys that are NOT in current layout */
export function getHiddenStandardKeys(layout: ModuleLayoutItem[]): string[] {
  const activeKeys = new Set(layout.filter((i) => i.type === 'standard').map((i) => i.key));
  return Object.keys(STANDARD_MODULES).filter(
    (k) => !activeKeys.has(k) && !STANDARD_MODULES[k].required
  );
}

/** Get custom template keys that are active in layout */
export function getActiveCustomKeys(layout: ModuleLayoutItem[]): string[] {
  return layout.filter((i) => i.type === 'custom').map((i) => i.key);
}

/** Resolve a module template by its layout key (which is "custom:<id>") */
export function resolveCustomModuleTemplate(
  key: string,
  templates: ModuleTemplate[]
): ModuleTemplate | undefined {
  const id = key.startsWith('custom:') ? Number(key.slice(7)) : null;
  if (id == null || isNaN(id)) return undefined;
  return templates.find((t) => t.id === id);
}
