// Chemical structure data model

export interface AtomData {
  id: string;
  x: number;
  y: number;
  element: string;       // 'C', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'H', etc.
  charge: number;         // -1, 0, 1, etc.
  implicitH: boolean;     // show implicit hydrogens
  isAromatic: boolean;    // is part of aromatic system
}

export interface BondData {
  id: string;
  fromId: string;
  toId: string;
  type: BondType;
}

export type BondType = 'single' | 'double' | 'triple' | 'wedge-up' | 'wedge-down' | 'wavy';

export interface Molecule {
  atoms: AtomData[];
  bonds: BondData[];
}

export type ToolType =
  | 'select'
  | 'bond-single'
  | 'bond-double'
  | 'bond-triple'
  | 'bond-wedge-up'
  | 'bond-wedge-down'
  | 'atom'
  | 'eraser'
  | 'ring';

// Ring template definitions
export interface RingTemplate {
  name: string;
  size: number;           // number of atoms in the ring
  bonds: number[];         // indices of double bonds (0-based)
  label?: string;         // e.g. 'cyclohexane'
}

export const RING_TEMPLATES: RingTemplate[] = [
  { name: '环丙烷', size: 3, bonds: [] },
  { name: '环丁烷', size: 4, bonds: [] },
  { name: '环戊烷', size: 5, bonds: [] },
  { name: '环己烷', size: 6, bonds: [] },
  { name: '环庚烷', size: 7, bonds: [] },
  { name: '环辛烷', size: 8, bonds: [] },
  { name: '苯', size: 6, bonds: [0, 2, 4], label: '苯' },  // aromatic - alternate double bonds
  { name: '萘', size: 10, bonds: [0, 2, 4, 6, 8], label: '萘' },  // naphthalene skeleton
];

// Element definitions for the palette
export interface ElementDef {
  symbol: string;
  label: string;
  color: string;         // CPK coloring
}

export const COMMON_ELEMENTS: ElementDef[] = [
  { symbol: 'C', label: 'C', color: '#404040' },
  { symbol: 'N', label: 'N', color: '#3050F8' },
  { symbol: 'O', label: 'O', color: '#FF0D0D' },
  { symbol: 'S', label: 'S', color: '#C0C000' },
  { symbol: 'P', label: 'P', color: '#FF8000' },
  { symbol: 'F', label: 'F', color: '#90E050' },
  { symbol: 'Cl', label: 'Cl', color: '#1FF01F' },
  { symbol: 'Br', label: 'Br', color: '#A62929' },
  { symbol: 'I', label: 'I', color: '#940094' },
  { symbol: 'H', label: 'H', color: '#FFFFFF' },
];

export const EXTRA_ELEMENTS: ElementDef[] = [
  { symbol: 'B', label: 'B', color: '#FFB5B5' },
  { symbol: 'Si', label: 'Si', color: '#C2C2A3' },
  { symbol: 'Se', label: 'Se', color: '#FFA100' },
  { symbol: 'Sn', label: 'Sn', color: '#668080' },
  { symbol: 'Li', label: 'Li', color: '#B22222' },
  { symbol: 'Na', label: 'Na', color: '#AB5CF2' },
  { symbol: 'K', label: 'K', color: '#8F40D4' },
  { symbol: 'Mg', label: 'Mg', color: '#8AFF00' },
  { symbol: 'Ca', label: 'Ca', color: '#3DFF00' },
  { symbol: 'Fe', label: 'Fe', color: '#E06633' },
  { symbol: 'Zn', label: 'Zn', color: '#7D80B0' },
  { symbol: 'Cu', label: 'Cu', color: '#C88033' },
];

// ─── Molecule Engine ──────────────────────────────

let nextAtomId = 0;
let nextBondId = 0;

function resetIds() { nextAtomId = 0; nextBondId = 0; }

export function createEmptyMolecule(): Molecule {
  resetIds();
  return { atoms: [], bonds: [] };
}

export function createAtom(x: number, y: number, element: string = 'C'): AtomData {
  return {
    id: `a${++nextAtomId}`,
    x, y,
    element,
    charge: 0,
    implicitH: true,
    isAromatic: false,
  };
}

export function createBond(fromId: string, toId: string, type: BondType = 'single'): BondData {
  return { id: `b${++nextBondId}`, fromId, toId, type };
}

export function addAtom(mol: Molecule, atom: AtomData): Molecule {
  return { atoms: [...mol.atoms, atom], bonds: mol.bonds };
}

export function addBond(mol: Molecule, bond: BondData): Molecule {
  return { atoms: mol.atoms, bonds: [...mol.bonds, bond] };
}

export function updateAtom(mol: Molecule, id: string, updates: Partial<AtomData>): Molecule {
  return {
    atoms: mol.atoms.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    bonds: mol.bonds,
  };
}

export function removeAtom(mol: Molecule, id: string): Molecule {
  return {
    atoms: mol.atoms.filter((a) => a.id !== id),
    bonds: mol.bonds.filter((b) => b.fromId !== id && b.toId !== id),
  };
}

export function removeBond(mol: Molecule, bondId: string): Molecule {
  return { atoms: mol.atoms, bonds: mol.bonds.filter((b) => b.id !== bondId) };
}

export function moveAtom(mol: Molecule, id: string, x: number, y: number): Molecule {
  return updateAtom(mol, id, { x, y });
}

/**
 * 查找距离 (x, y) 最近的原子
 * @param threshold 阈值，单位 px
 */
export function findAtomAt(mol: Molecule, x: number, y: number, threshold: number = 18): AtomData | null {
  let closest: AtomData | null = null;
  let minDist = threshold;
  for (const atom of mol.atoms) {
    const dx = atom.x - x, dy = atom.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) { minDist = dist; closest = atom; }
  }
  return closest;
}

/**
 * 查找距离 (x, y) 最近的键
 */
export function findBondAt(mol: Molecule, x: number, y: number, threshold: number = 12): BondData | null {
  for (const bond of mol.bonds) {
    const a1 = mol.atoms.find((a) => a.id === bond.fromId);
    const a2 = mol.atoms.find((a) => a.id === bond.toId);
    if (!a1 || !a2) continue;
    const dx = a2.x - a1.x, dy = a2.y - a1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    let t = ((x - a1.x) * dx + (y - a1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a1.x + t * dx, py = a1.y + t * dy;
    const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
    if (dist < threshold) return bond;
  }
  return null;
}

/**
 * 在 (cx, cy) 处插入一个环模板
 */
export function insertRing(mol: Molecule, template: RingTemplate, cx: number, cy: number, radius: number = 40): Molecule {
  const n = template.size;
  const newAtoms: AtomData[] = [];
  const newBonds: BondData[] = [];

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const atom = createAtom(x, y, 'C');
    newAtoms.push(atom);
    if (i > 0) {
      newBonds.push(createBond(newAtoms[i - 1].id, atom.id, 'single'));
    }
  }
  // 闭合环
  newBonds.push(createBond(newAtoms[n - 1].id, newAtoms[0].id, 'single'));

  // 根据模板设置双键
  for (const dbIdx of template.bonds) {
    const b = newBonds[dbIdx % n];
    if (b) b.type = 'double';
  }

  return { atoms: [...mol.atoms, ...newAtoms], bonds: [...mol.bonds, ...newBonds] };
}

/**
 * 翻转键型：单→双→三→单
 */
export function cycleBondType(type: BondType): BondType {
  const order: BondType[] = ['single', 'double', 'triple'];
  const idx = order.indexOf(type);
  if (idx < 0 || idx >= order.length - 1) return 'single';
  return order[idx + 1];
}

/**
 * 获取与原子相连的其他原子 ID 列表
 */
export function getConnectedAtoms(mol: Molecule, atomId: string): string[] {
  return mol.bonds
    .filter((b) => b.fromId === atomId || b.toId === atomId)
    .map((b) => (b.fromId === atomId ? b.toId : b.fromId));
}

/**
 * 简化的 SMILES 生成器
 */
export function toSmiles(_mol: Molecule): string {
  const mol = _mol;
  if (mol.atoms.length === 0) return '';
  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(atomId: string, prevId: string | null, bondType: BondType | null) {
    if (visited.has(atomId)) return;
    visited.add(atomId);
    const atom = mol.atoms.find((a) => a.id === atomId);
    if (!atom) return;
    if (bondType === 'double') result.push('=');
    else if (bondType === 'triple') result.push('#');
    if (atom.element !== 'C' && atom.element !== 'H') result.push(atom.element);
    else if (result.length === 0 || !atom.implicitH) result.push(atom.element);
    const neighbors = getConnectedAtoms(mol, atomId).filter((id) => id !== prevId);
    if (neighbors.length > 1) result.push('(');
    for (let i = 0; i < neighbors.length; i++) {
      const bond = mol.bonds.find(
        (b) => (b.fromId === atomId && b.toId === neighbors[i]) ||
               (b.toId === atomId && b.fromId === neighbors[i])
      );
      dfs(neighbors[i], atomId, bond?.type || 'single');
    }
    if (neighbors.length > 1) result.push(')');
  }

  dfs(mol.atoms[0].id, null, null);
  return result.join('');
}

export function serializeMolecule(mol: Molecule): string {
  return JSON.stringify(mol);
}

export function deserializeMolecule(json: string): Molecule {
  try {
    const data = JSON.parse(json);
    return { atoms: data.atoms || [], bonds: data.bonds || [] };
  } catch {
    return createEmptyMolecule();
  }
}
