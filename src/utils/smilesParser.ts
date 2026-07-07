// SMILES 解析工具：从 SMILES 计算分子式（含隐式氢）、分子量，查询 IUPAC 命名

// 原子量 (g/mol)
const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011,
  N: 14.007, O: 15.999, F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305,
  Al: 26.982, Si: 28.085, P: 30.974, S: 32.065, Cl: 35.453, Ar: 39.948,
  K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996,
  Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38,
  Ga: 69.723, Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798,
  Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.95,
  Tc: 98, Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41,
  In: 114.82, Sn: 118.71, Sb: 121.76, Te: 127.60, I: 126.90, Xe: 131.29,
  Cs: 132.91, Ba: 137.33, La: 138.91, Hf: 178.49, Ta: 180.95, W: 183.84,
  Re: 186.21, Os: 190.23, Ir: 192.22, Pt: 195.08, Au: 196.97, Hg: 200.59,
  Tl: 204.38, Pb: 207.2, Bi: 208.98,
};

/** 标准化合价 — 用于计算隐式氢 */
const STD_VALENCY: Record<string, number> = {
  H: 1, He: 0, Li: 1, Be: 2, B: 3, C: 4, N: 3, O: 2, F: 1, Ne: 0,
  Na: 1, Mg: 2, Al: 3, Si: 4, P: 3, S: 2, Cl: 1, Ar: 0,
  K: 1, Ca: 2, Sc: 3, Ti: 4, V: 5, Cr: 6, Mn: 7, Fe: 6, Co: 5,
  Ni: 4, Cu: 4, Zn: 2, Ga: 3, Ge: 4, As: 3, Se: 2, Br: 1, Kr: 0,
};

/** 有机子集小写 → 大写映射 */
const ORGANIC_MAP: Record<string, string> = {
  b: 'B', c: 'C', n: 'N', o: 'O', s: 'S', p: 'P',
  f: 'F', i: 'I',
};

// 分子式中元素排序：C, H, 然后字母序
const FORMULA_ORDER = ['C', 'H'];

// ========== 内部类型 ==========

interface ParsedAtom {
  idx: number;        // 原子序号 (0-based)
  el: string;         // 元素符号 (如 "C", "N", "Fe")
  charge: number;     // 形式电荷 (+/- n)
  hCount: number;     // 方括号显式氢数 ([NH4+] → 4)
  aromatic: boolean;  // 是否芳香原子 (小写有机子集)
}

interface ParsedBond {
  from: number;
  to: number;
  order: number;      // 键级: 1/2/3/1.5(芳香)
}

// ========== SMILES 解析器 (含键跟踪) ==========

function parseSmilesGraph(smiles: string): { atoms: ParsedAtom[]; bonds: ParsedBond[] } {
  const atoms: ParsedAtom[] = [];
  const bonds: ParsedBond[] = [];
  const ringMap = new Map<number, number>(); // ring number → first atom idx
  const branchStack: number[] = [];

  let prevAtomIdx = -1;         // 上一个原子的索引
  let pendingBond: number | null = null; // 显式键符指定的键级 (null=默认)
  let i = 0;
  const s = smiles.trim();
  const len = s.length;

  function addChainBond(from: number, to: number) {
    if (from < 0 || to < 0) return;
    let order = pendingBond ?? 1;
    // 芳香链：两个相邻芳香原子之间默认 1.5
    if (pendingBond === null && atoms[from]?.aromatic && atoms[to]?.aromatic) {
      order = 1.5;
    }
    bonds.push({ from, to, order });
    pendingBond = null;
  }

  function nextAtomIdx() { return atoms.length; }

  while (i < len) {
    const ch = s[i];

    // --------------------- 分支 ---------------------
    if (ch === '(') {
      branchStack.push(prevAtomIdx);
      i++; continue;
    }
    if (ch === ')') {
      prevAtomIdx = branchStack.pop() ?? prevAtomIdx;
      i++; continue;
    }

    // --------------------- 断开 ---------------------
    if (ch === '.') {
      prevAtomIdx = -1;
      pendingBond = null;
      i++; continue;
    }

    // --------------------- 键符 ---------------------
    if (ch === '-') { pendingBond = 1; i++; continue; }
    if (ch === '=') { pendingBond = 2; i++; continue; }
    if (ch === '#') { pendingBond = 3; i++; continue; }
    if (ch === ':') { pendingBond = 1.5; i++; continue; }
    if (ch === '/' || ch === '\\') { i++; continue; } // 方向键忽略

    // --------------------- 环闭合 ---------------------
    if (/[0-9]/.test(ch)) {
      let ringNum = 0;
      if (ch === '%') {
        ringNum = parseInt(s.substring(i + 1, i + 3), 10);
        i += 3;
      } else {
        ringNum = parseInt(ch, 10);
        i++;
      }

      if (ringMap.has(ringNum)) {
        const firstIdx = ringMap.get(ringNum)!;
        const bondOrder = pendingBond ?? (
          atoms[firstIdx]?.aromatic && atoms[prevAtomIdx]?.aromatic ? 1.5 : 1
        );
        bonds.push({ from: prevAtomIdx, to: firstIdx, order: bondOrder });
        ringMap.delete(ringNum);
      } else {
        ringMap.set(ringNum, prevAtomIdx);
      }
      pendingBond = null;
      continue;
    }

    // --------------------- 方括号原子 [ … ] ---------------------
    if (ch === '[') {
      i++; // skip '['

      // 同位素 (可选)
      while (i < len && /[0-9]/.test(s[i])) i++;

      // 元素符号
      let el = '';
      if (i < len && /[A-Z]/.test(s[i])) {
        el = s[i]; i++;
        if (i < len && /[a-z]/.test(s[i])) { el += s[i]; i++; }
      }
      // 没有元素符号 → 默认为碳
      if (!el) el = 'C';

      // 氢计数 H 或 Hn
      let hCount = 0;
      if (i < len && s[i] === 'H') {
        i++;
        let nStr = '';
        while (i < len && /[0-9]/.test(s[i])) { nStr += s[i]; i++; }
        hCount = nStr ? parseInt(nStr, 10) : 1;
      }

      // 电荷 + / - / +n / -n / ++ / --
      let charge = 0;
      if (i < len && (s[i] === '+' || s[i] === '-')) {
        const sign = s[i] === '+' ? 1 : -1;
        i++;
        // 双重符号 ++ / --
        if (i < len && s[i] === (sign > 0 ? '+' : '-')) { charge = sign * 2; i++; }
        else {
          let cStr = '';
          while (i < len && /[0-9]/.test(s[i])) { cStr += s[i]; i++; }
          charge = sign * (cStr ? parseInt(cStr, 10) : 1);
        }
      }

      // 跳过 ']'
      if (i < len && s[i] === ']') i++;

      const idx = nextAtomIdx();
      atoms.push({ idx, el, charge, hCount, aromatic: false });
      addChainBond(prevAtomIdx, idx);
      prevAtomIdx = idx;
      continue;
    }

    // --------------------- 有机子集原子 ---------------------
    if (/[A-Za-z]/.test(ch)) {
      let el: string;
      let aromatic = false;

      if (/[a-z]/.test(ch)) {
        // 小写 = 芳香
        el = ORGANIC_MAP[ch] || ch.toUpperCase();
        aromatic = true;
        i++;
      } else {
        // 大写: B C N O P S F / Cl Br I
        el = ch; i++;
        if (i < len && /[a-z]/.test(s[i])) {
          const two = el + s[i];
          if (two === 'Cl' || two === 'Br') { el = two; i++; }
        }
      }

      const idx = nextAtomIdx();
      atoms.push({ idx, el, charge: 0, hCount: 0, aromatic });
      addChainBond(prevAtomIdx, idx);

      // 芳香原子默认键级 1.5
      pendingBond = aromatic ? 1.5 : null;
      prevAtomIdx = idx;
      continue;
    }

    i++; // 跳过未知字符
  }

  return { atoms, bonds };
}

// ========== 隐式氢计算 ==========

/** 计算各原子的键级总和 */
function atomBondSum(idx: number, bonds: ParsedBond[]): number {
  let sum = 0;
  for (const b of bonds) {
    if (b.from === idx) sum += b.order;
    if (b.to === idx) sum += b.order;
  }
  return sum;
}

/** 解析 SMILES，包含隐式氢 */
export function smilesToAtomCounts(smiles: string): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!smiles || typeof smiles !== 'string') return counts;

  const { atoms, bonds } = parseSmilesGraph(smiles);

  // 1) 直接计数 + 方括号显式氢
  for (const a of atoms) {
    counts[a.el] = (counts[a.el] || 0) + 1;
    if (a.hCount > 0) counts['H'] = (counts['H'] || 0) + a.hCount;
  }

  // 2) 隐式氢 = 标准化合价 − 键级总和 − 显式氢 + 形式电荷调整
  for (const a of atoms) {
    const baseV = STD_VALENCY[a.el];
    if (baseV === undefined || baseV === 0) continue;

    const bondSum = atomBondSum(a.idx, bonds);

    // 正电荷 → 价态增加（如 [NH4+] N 为 4 价），负电荷 → 价态减少
    const adjustedV = baseV + a.charge;

    const implicitH = Math.max(0, Math.round(adjustedV - bondSum - a.hCount));
    if (implicitH > 0) {
      counts['H'] = (counts['H'] || 0) + implicitH;
    }
  }

  return counts;
}

/** 从元素计数生成分子式字符串 (Hill 系统) */
export function atomCountsToFormula(counts: Record<string, number>): string {
  const elements = Object.keys(counts);
  const hasCarbon = 'C' in counts;
  const sorted = elements.sort((a, b) => {
    if (hasCarbon) {
      // Hill system: C first, H second, then alphabetical
      const idxA = FORMULA_ORDER.indexOf(a);
      const idxB = FORMULA_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
    }
    return a.localeCompare(b); // purely alphabetical (no-C case)
  });
  return sorted.map((el) => el + (counts[el] > 1 ? counts[el] : '')).join('');
}

/** 从元素计数计算分子量 (g/mol) */
export function atomCountsToWeight(counts: Record<string, number>): number {
  let total = 0;
  for (const [el, count] of Object.entries(counts)) {
    const w = ATOMIC_WEIGHTS[el];
    if (w) total += w * count;
  }
  return Math.round(total * 100) / 100;
}

/** 从 SMILES 直接获取分子式 */
export function smilesToFormula(smiles: string): string {
  return atomCountsToFormula(smilesToAtomCounts(smiles));
}

/** 从 SMILES 直接获取分子量 */
export function smilesToMolecularWeight(smiles: string): number {
  return atomCountsToWeight(smilesToAtomCounts(smiles));
}

/** 通过 PubChem PUG REST API 查询化合物名 */
export async function smilesToName(smiles: string): Promise<string> {
  if (!smiles) return '';

  // 1) Check local SQLite cache first (instant)
  try {
    const cached = await (window as any).labnote?.compound?.getName(smiles);
    if (cached) return cached;
  } catch { /* IPC unavailable (e.g. browser dev) */ }

  // 2) Fall back to PubChem
  try {
    const cidUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/cids/TXT`;
    const cidResp = await fetch(cidUrl);
    if (!cidResp.ok) return '';
    const cidText = await cidResp.text();
    const cid = cidText.trim().split('\n')[0];
    if (!cid || isNaN(Number(cid))) return '';

    const nameUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/description/JSON`;
    const nameResp = await fetch(nameUrl);
    if (!nameResp.ok) return '';
    const nameData = await nameResp.json();
    const info = nameData?.InformationList?.Information?.[0];
    const name = info?.Title || '';

    // 3) Save to cache for next time
    if (name) {
      try {
        (window as any).labnote?.compound?.setName(smiles, name);
      } catch {}
    }

    return name;
  } catch {
    return '';
  }
}

/** 从 SMILES 计算所有信息 */
export interface SmilesInfo {
  smiles: string;
  formula: string;
  molecularWeight: number;
  name: string;
}

export async function analyzeSmiles(smiles: string): Promise<SmilesInfo> {
  const formula = smilesToFormula(smiles);
  const molecularWeight = smilesToMolecularWeight(smiles);
  const name = await smilesToName(smiles);
  return { smiles, formula, molecularWeight, name };
}

/** 同步计算（不含 PubChem 命名） */
export function analyzeSmilesSync(smiles: string): Omit<SmilesInfo, 'name'> {
  return {
    smiles,
    formula: smilesToFormula(smiles),
    molecularWeight: smilesToMolecularWeight(smiles),
  };
}
