/**
 * Export template system for experimental section formatting.
 * Supports preset journal-style templates and custom placeholder-based templates.
 */

export interface ExportReagent {
  name: string;
  amount?: number | null;
  amount_unit?: string;
}

export interface ExportSolvent {
  name: string;
  volume?: number | null;
  volume_unit?: string;
}

export interface ExportData {
  title: string;
  container?: string | null;
  temperature?: string | null;
  time?: string | null;
  atmosphere?: string | null;
  stirring?: string | null;
  workup?: string | null;
  yield_val?: number | null;
  morphology?: string | null;
  notes?: string | null;
  reactants?: ExportReagent[];
  catalysts?: ExportReagent[];
  solvents?: ExportSolvent[];
}

/** Format a reagent with optional amount: "Name (amount unit)" or "Name" */
export function fmtReagent(r: ExportReagent): string {
  if (r.amount != null && r.amount_unit) {
    return `${r.name} (${r.amount} ${r.amount_unit})`;
  }
  return r.name;
}

/** Join items with commas and final "and" */
export function andJoin(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}

/** Capitalize first letter */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Build placeholder values map from export data */
function buildPlaceholders(data: ExportData): Record<string, string> {
  const allReagents: ExportReagent[] = [
    ...(data.reactants || []),
    ...(data.catalysts || []),
  ];

  const reactStr = andJoin((data.reactants || []).map(fmtReagent));
  const cataStr = andJoin((data.catalysts || []).map(fmtReagent));
  const allReagStr = andJoin(allReagents.map(fmtReagent));

  const solvStr = andJoin((data.solvents || []).map((s: ExportSolvent) => {
    if (s.volume != null && s.volume_unit) {
      return `${s.volume} ${s.volume_unit} of ${s.name}`;
    }
    return s.name;
  }));

  const condParts: string[] = [];
  if (data.temperature) condParts.push(`heated to ${data.temperature}`);
  if (data.time) condParts.push(`${data.time}`);
  const stirringStr = data.stirring ? ` under ${data.stirring}` : '';
  const atmStr = data.atmosphere ? ` under a ${data.atmosphere} atmosphere` : '';

  let condStr = '';
  if (condParts.length > 0) {
    condStr = `the mixture was ${condParts.join(' for ')} for ${data.time || ''}${stirringStr}${atmStr}`.replace(/\s+/g, ' ').trim();
  } else if (data.stirring || data.atmosphere) {
    condStr = `the mixture was stirred${stirringStr}${atmStr}`;
  }

  // Workup: normalize Chinese punctuation
  let workupNormalized = (data.workup || '').trim();
  if (workupNormalized) {
    workupNormalized = workupNormalized
      .replace(/。/g, '. ')
      .replace(/；/g, '; ')
      .replace(/，/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
    workupNormalized = /^[A-Z]/.test(workupNormalized) ? workupNormalized : capitalize(workupNormalized);
  }

  const resultParts: string[] = [];
  if (data.yield_val != null) resultParts.push(`Yield ${data.yield_val}%`);
  if (data.morphology) resultParts.push(`as a ${data.morphology}`);

  return {
    title: data.title || '',
    reactants: reactStr,
    catalysts: cataStr,
    all_reagents: allReagStr,
    solvents: solvStr,
    container: data.container || 'flask',
    temperature: data.temperature || '',
    time: data.time || '',
    atmosphere: data.atmosphere || '',
    stirring: data.stirring || '',
    workup: workupNormalized,
    yield: data.yield_val != null ? String(data.yield_val) : '',
    morphology: data.morphology || '',
    notes: data.notes || '',
    result: resultParts.join(' '),
  };
}

// ── Preset Templates ──

/** ACS Style – full narrative with synthesis header */
function templateACS(data: ExportData): string {
  const ph = buildPlaceholders(data);
  const lines: string[] = [];

  lines.push(`Synthesis of ${ph.title}.\n`);

  const allReagents: ExportReagent[] = [
    ...(data.reactants || []),
    ...(data.catalysts || []),
  ];

  if (allReagents.length > 0) {
    const container = data.container || 'flask';
    lines.push(
      `${andJoin(allReagents.map(fmtReagent))} were added to a ${container} containing a stir bar.`
    );
  }

  if (data.atmosphere) {
    lines.push(
      `The flask was evacuated and backfilled with ${data.atmosphere} three times.`
    );
  }

  if (ph.solvents) {
    lines.push(`${ph.solvents} was added.`);
  }

  const condParts: string[] = [];
  if (data.temperature) condParts.push(`heated to ${data.temperature}`);
  if (data.time) condParts.push(`${data.time}`);
  if (!condParts.length && data.stirring) condParts.push(`stirred`);
  const stirringStr = data.stirring ? ` under ${data.stirring}` : '';
  const atmStr = data.atmosphere ? ` under a ${data.atmosphere} atmosphere` : '';
  if (condParts.length > 0) {
    lines.push(
      `The reaction mixture was ${condParts.join(' for ')}${stirringStr}${atmStr}.`
    );
  } else if (data.stirring || data.atmosphere) {
    lines.push(
      `The reaction mixture was stirred${stirringStr}${atmStr}.`
    );
  }

  if (ph.workup) {
    lines.push(`After the reaction was complete, ${ph.workup}`);
  }

  if (ph.result) {
    lines.push(ph.result + '.');
  }

  if (ph.notes) {
    lines.push(`Note: ${ph.notes}`);
  }

  return lines.join(' ');
}

/** JACS Style – concise, inverted sentence structure */
function templateJACS(data: ExportData): string {
  const ph = buildPlaceholders(data);
  const lines: string[] = [];

  lines.push(`${ph.title}.\n`);

  if (ph.all_reagents) {
    const container = data.container || 'flask';
    lines.push(`To a ${container} were added ${ph.all_reagents}.`);
  }

  if (ph.solvents) {
    const solvIntro = data.solvents && data.solvents.length === 1 ? `${ph.solvents} was` : `${ph.solvents} were`;
    lines.push(`${solvIntro} added.`);
  }

  const condParts: string[] = [];
  if (data.temperature) condParts.push(data.temperature);
  if (data.stirring) condParts.push(data.stirring);
  let condLine = 'The mixture was stirred';
  if (condParts.length) condLine += ` at ${condParts.join(' under ')}`;
  if (data.time) condLine += ` for ${data.time}`;
  if (data.atmosphere) condLine += ` under ${data.atmosphere}`;
  condLine += '.';
  lines.push(condLine);

  if (ph.workup) {
    const workup = ph.workup.endsWith('.') ? ph.workup : ph.workup + '.';
    lines.push(workup);
  }

  const resultParts: string[] = [];
  if (data.yield_val != null) resultParts.push(`${data.yield_val}%`);
  if (data.morphology) {
    const morph = data.morphology;
    resultParts.push(morph);
  }
  if (resultParts.length > 0) {
    const yieldStr = data.yield_val != null ? `Yield ${data.yield_val}%` : '';
    const morphStr = data.morphology ? `as a ${data.morphology}` : '';
    lines.push(`${yieldStr} ${morphStr}`.trim() + '.');
  }

  if (ph.notes) {
    lines.push(`Note: ${ph.notes}`);
  }

  return lines.join(' ');
}

/** Angewandte Style – colon-separated header, compact */
function templateAngew(data: ExportData): string {
  const ph = buildPlaceholders(data);
  const lines: string[] = [];

  lines.push(`${ph.title}:\n`);

  const reagentParts: string[] = [];
  if (ph.all_reagents) reagentParts.push(ph.all_reagents);
  if (ph.solvents) {
    reagentParts.push(`in ${ph.solvents}`);
  }
  if (reagentParts.length > 0) {
    lines.push(`${reagentParts.join(' ')} was stirred`);
  }

  const condParts: string[] = [];
  if (data.temperature) condParts.push(`at ${data.temperature}`);
  if (data.time) condParts.push(`for ${data.time}`);
  if (data.atmosphere) condParts.push(`under ${data.atmosphere}`);
  if (data.stirring) condParts.push(`with ${data.stirring}`);
  if (condParts.length > 0) {
    lines.push(condParts.join(' ') + '.');
  }

  if (ph.workup) {
    const workup = ph.workup.endsWith('.') ? ph.workup : ph.workup + '.';
    lines.push(`After workup (${workup})`);
  }

  if (ph.result) {
    lines.push(ph.result + '.');
  }

  if (ph.notes) {
    lines.push(`Note: ${ph.notes}`);
  }

  // Rejoin with proper spacing for Angewandte compact style
  return lines.join(' ');
}

// ── Custom Template ──

export interface CustomTemplate {
  name: string;
  template: string;
}

const CUSTOM_TEMPLATES_KEY = 'labnote_export_custom_templates';

/** Load custom templates from localStorage */
export function loadCustomTemplates(): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save custom templates to localStorage */
export function saveCustomTemplates(templates: CustomTemplate[]): void {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
}

/** Apply a custom placeholder template to experiment data */
export function applyCustomTemplate(template: string, data: ExportData): string {
  const ph = buildPlaceholders(data);

  // Replace {{cond}} and {{result}} as convenience macros
  const condParts: string[] = [];
  if (data.temperature) condParts.push(`heated to ${data.temperature}`);
  if (data.time) condParts.push(`${data.time}`);
  const stirringStr = data.stirring ? ` under ${data.stirring}` : '';
  const atmStr = data.atmosphere ? ` under a ${data.atmosphere} atmosphere` : '';
  let condStr = '';
  if (condParts.length > 0) {
    condStr = `the mixture was ${condParts.join(' for ')}${stirringStr}${atmStr}`.replace(/\s+/g, ' ').trim();
  }

  const resultParts: string[] = [];
  if (data.yield_val != null) resultParts.push(`Yield ${data.yield_val}%`);
  if (data.morphology) resultParts.push(`as a ${data.morphology}`);
  const resultStr = resultParts.join(' ');

  const macros: Record<string, string> = {
    ...ph,
    cond: condStr,
    result: resultStr,
  };

  let result = template;
  for (const [key, value] of Object.entries(macros)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Clean up double spaces and trailing spaces
  return result.replace(/\s{2,}/g, ' ').trim();
}

// ── Template Registry ──

export type TemplateId = 'acs' | 'jacs' | 'angew' | `custom:${number}`;

export interface TemplateEntry {
  id: TemplateId;
  name: string;
  format: (data: ExportData) => string;
}

export function getBuiltinTemplates(): TemplateEntry[] {
  return [
    { id: 'acs', name: 'ACS Style', format: templateACS },
    { id: 'jacs', name: 'JACS Style', format: templateJACS },
    { id: 'angew', name: 'Angewandte Style', format: templateAngew },
  ];
}

export function getCustomTemplateEntries(templates: CustomTemplate[]): TemplateEntry[] {
  return templates.map((t, i) => ({
    id: `custom:${i}` as TemplateId,
    name: `自定义: ${t.name}`,
    format: (data: ExportData) => applyCustomTemplate(t.template, data),
  }));
}

export function getAllTemplates(
  customTemplates: CustomTemplate[]
): TemplateEntry[] {
  return [...getBuiltinTemplates(), ...getCustomTemplateEntries(customTemplates)];
}
