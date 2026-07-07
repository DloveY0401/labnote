/**
 * Format experiment data into journal-style experimental section text.
 */
interface ExportReagent {
  name: string;
  amount?: number | null;
  amount_unit?: string;
}

interface ExportSolvent {
  name: string;
  volume?: number | null;
  volume_unit?: string;
}

interface ExportExperiment {
  title: string;
  container?: string | null;
  temperature?: string | null;
  time?: string | null;
  atmosphere?: string | null;
  stirring?: string | null;
  procedure?: string | null;
  workup?: string | null;
  yield_val?: number | null;
  morphology?: string | null;
  notes?: string | null;
  reactants?: ExportReagent[];
  catalysts?: ExportReagent[];
  solvents?: ExportSolvent[];
}

/** Format a reagent with optional amount: "Name (amount unit)" or "Name" */
function fmtReagent(r: ExportReagent): string {
  if (r.amount != null && r.amount_unit) {
    return `${r.name} (${r.amount} ${r.amount_unit})`;
  }
  return r.name;
}

/** Join items with commas and final "and" */
function andJoin(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}

/** Capitalize first letter of a string */
function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateExperimentalSection(exp: ExportExperiment): string {
  const lines: string[] = [];
  const compoundLabel = exp.title.match(/^(\d+)[\.\s、)]/) ? '' : '';

  // --- Title ---
  lines.push(`Synthesis of ${exp.title}.\n`);

  // --- Reagents (reactants + catalysts) ---
  const allReagents: ExportReagent[] = [
    ...(exp.reactants || []),
    ...(exp.catalysts || []),
  ];

  if (allReagents.length > 0) {
    const container = exp.container || 'flask';
    lines.push(
      `${andJoin(allReagents.map(fmtReagent))} were added to a ${container} containing a stir bar.`
    );
  }

  // --- Atmosphere (vacuum-refill) ---
  if (exp.atmosphere) {
    lines.push(
      `The flask was evacuated and backfilled with ${exp.atmosphere} three times.`
    );
  }

  // --- Solvents ---
  const solventParts = (exp.solvents || []).map((s: ExportSolvent) => {
    if (s.volume != null && s.volume_unit) {
      return `${s.volume} ${s.volume_unit} of ${s.name}`;
    }
    return s.name;
  });
  if (solventParts.length > 0) {
    lines.push(`${andJoin(solventParts)} was added.`);
  }

  // --- Reaction conditions ---
  const condParts: string[] = [];
  if (exp.temperature) condParts.push(`heated to ${exp.temperature}`);
  if (exp.time) condParts.push(`${exp.time}`);
  if (!condParts.length && exp.stirring) condParts.push(`stirred`);
  const stirringStr = exp.stirring ? ` under ${exp.stirring}` : '';
  const atmStr = exp.atmosphere ? ` under a ${exp.atmosphere} atmosphere` : '';
  if (condParts.length > 0) {
    lines.push(
      `The reaction mixture was ${condParts.join(' for ')}${stirringStr}${atmStr}.`
    );
  } else if (exp.stirring || exp.atmosphere) {
    lines.push(
      `The reaction mixture was stirred${stirringStr}${atmStr}.`
    );
  }

  // --- Workup ---
  if (exp.workup) {
    // Normalize Chinese punctuation to English for journal style
    const wp = exp.workup
      .replace(/。/g, '. ')
      .replace(/；/g, '; ')
      .replace(/，/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
    const wpCapitalized = /^[A-Z]/.test(wp) ? wp : capitalize(wp);
    lines.push(`After the reaction was complete, ${wpCapitalized}`);
  }

  // --- Yield & morphology ---
  const resultParts: string[] = [];
  if (exp.yield_val != null) resultParts.push(`Yield ${exp.yield_val}%`);
  if (exp.morphology) resultParts.push(`as a ${exp.morphology}`);
  if (resultParts.length > 0) {
    lines.push(resultParts.join(' ') + '.');
  }

  // --- Notes (if any) ---
  if (exp.notes) {
    lines.push(`Note: ${exp.notes}`);
  }

  return lines.join(' ');
}
