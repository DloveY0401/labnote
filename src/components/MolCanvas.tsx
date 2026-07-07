import { useRef, useEffect, useCallback } from 'react';
import type {
  Molecule, AtomData, BondData, BondType, ToolType,
} from '../utils/molEngine';
import {
  findAtomAt, findBondAt, moveAtom, addBond, removeAtom, removeBond,
  updateAtom, insertRing, cycleBondType, addAtom, createAtom,
  createBond, RING_TEMPLATES, type RingTemplate,
} from '../utils/molEngine';

interface MolCanvasProps {
  molecule: Molecule;
  tool: ToolType;
  currentElement: string;
  currentRing: RingTemplate | null;
  showRingPicker: boolean;
  onMoleculeChange: (mol: Molecule) => void;
  onHistoryPush: (mol: Molecule) => void;
  onRingPlaced: () => void;
}

// 原子渲染颜色映射
const ELEMENT_COLORS: Record<string, string> = {
  C: '#404040', N: '#3050F8', O: '#FF0D0D', S: '#C0C000',
  P: '#FF8000', F: '#90E050', Cl: '#1FF01F', Br: '#A62929',
  I: '#940094', H: '#888888', B: '#FFB5B5', Si: '#C2C2A3',
  Se: '#FFA100', Sn: '#668080', Li: '#B22222', Na: '#AB5CF2',
  K: '#8F40D4', Mg: '#8AFF00', Ca: '#3DFF00', Fe: '#E06633',
  Zn: '#7D80B0', Cu: '#C88033',
};

function elementColor(el: string): string {
  return ELEMENT_COLORS[el] || '#404040';
}

// 键渲染偏置常量
const BOND_OFFSET = 5;  // 双键/三键线间距

/**
 * Canvas 渲染 + 事件处理
 */
export default function MolCanvas({
  molecule, tool, currentElement, currentRing,
  showRingPicker, onMoleculeChange, onHistoryPush, onRingPlaced,
}: MolCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ atomId: string; startX: number; startY: number } | null>(null);
  const firstAtomRef = useRef<string | null>(null);  // bond drawing: first clicked atom
  const showRingRef = useRef(showRingPicker);
  showRingRef.current = showRingPicker;

  // 当环模板变化且在画布上点击时插入环
  const ringRef = useRef(currentRing);
  ringRef.current = currentRing;

  // ── 渲染 ──
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 背景网格
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let x = gridSize; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
    }
    for (let y = gridSize; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }

    // 键
    ctx.lineCap = 'round';
    for (const bond of molecule.bonds) {
      const a1 = molecule.atoms.find((a) => a.id === bond.fromId);
      const a2 = molecule.atoms.find((a) => a.id === bond.toId);
      if (!a1 || !a2) continue;
      drawBond(ctx, a1, a2, bond.type);
    }

    // 原子
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const atom of molecule.atoms) {
      drawAtom(ctx, atom);
    }
  }, [molecule]);

  useEffect(() => { render(); }, [render]);

  // ── 绘制原子 ──
  function drawAtom(ctx: CanvasRenderingContext2D, atom: AtomData) {
    const { x, y, element } = atom;
    const color = elementColor(element);

    // 碳原子: 仅显示小黑点（不显式标 C，除非有电荷或特殊设置）
    if (element === 'C' && atom.charge === 0) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      // 隐式氢标记
      if (atom.implicitH) {
        const neighbors = molecule.bonds.filter((b) => b.fromId === atom.id || b.toId === atom.id).length;
        const hCount = 4 - neighbors;
        if (hCount > 0) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#999';
          // 显示 H 数量（仅单键连接时有隐式H）
          const allSingle = molecule.bonds
            .filter((b) => b.fromId === atom.id || b.toId === atom.id)
            .every((b) => b.type === 'single');
          if (allSingle) {
            for (let i = 0; i < Math.min(hCount, 3); i++) {
              const angle = (Math.PI * 2 * i) / hCount - Math.PI / 2;
              const hx = x + 12 * Math.cos(angle);
              const hy = y + 12 * Math.sin(angle);
              ctx.fillText('H', hx, hy);
            }
          }
        }
      }
      return;
    }

    // 非碳原子: 绘制白色背景 + 元素符号
    ctx.font = 'bold 13px sans-serif';
    const w = ctx.measureText(element).width + 12;
    const h = 18;

    // 背景
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = color === '#FFFFFF' || color === '#888888' ? 1.5 : 1;
    ctx.beginPath();
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 3);
    ctx.fill();
    ctx.stroke();

    // 文字
    ctx.fillStyle = color;
    ctx.fillText(element, x, y + 1);
  }

  // ── 绘制键 ──
  function drawBond(ctx: CanvasRenderingContext2D, a1: AtomData, a2: AtomData, type: BondType) {
    const dx = a2.x - a1.x, dy = a2.y - a1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;  // 法向量

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;

    if (type === 'single' || type === 'wedge-up' || type === 'wedge-down' || type === 'wavy') {
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();

      if (type === 'wedge-up') {
        // 粗楔形键（实心三角）
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(a2.x, a2.y);
        ctx.lineTo(a1.x + nx * 4, a1.y + ny * 4);
        ctx.lineTo(a1.x - nx * 4, a1.y - ny * 4);
        ctx.closePath();
        ctx.fill();
      } else if (type === 'wedge-down') {
        // 虚线楔形键
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(a2.x, a2.y);
        ctx.lineTo(a1.x + nx * 4, a1.y + ny * 4);
        ctx.moveTo(a2.x, a2.y);
        ctx.lineTo(a1.x - nx * 4, a1.y - ny * 4);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (type === 'wavy') {
        // 波浪键（用锯齿近似）
        ctx.beginPath();
        ctx.moveTo(a1.x, a1.y);
        const steps = 4;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const sign = i % 2 === 0 ? 1 : -1;
          ctx.lineTo(a1.x + dx * t, a1.y + dy * t + sign * 4);
        }
        ctx.stroke();
      }
    } else if (type === 'double') {
      ctx.beginPath();
      ctx.moveTo(a1.x + nx * BOND_OFFSET, a1.y + ny * BOND_OFFSET);
      ctx.lineTo(a2.x + nx * BOND_OFFSET, a2.y + ny * BOND_OFFSET);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a1.x - nx * BOND_OFFSET, a1.y - ny * BOND_OFFSET);
      ctx.lineTo(a2.x - nx * BOND_OFFSET, a2.y - ny * BOND_OFFSET);
      ctx.stroke();
    } else if (type === 'triple') {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a1.x + nx * BOND_OFFSET, a1.y + ny * BOND_OFFSET);
      ctx.lineTo(a2.x + nx * BOND_OFFSET, a2.y + ny * BOND_OFFSET);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a1.x - nx * BOND_OFFSET, a1.y - ny * BOND_OFFSET);
      ctx.lineTo(a2.x - nx * BOND_OFFSET, a2.y - ny * BOND_OFFSET);
      ctx.stroke();
    }
  }

  // ── 画布事件处理 ──
  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);

    // 环模板插入模式
    if (ringRef.current && showRingRef.current) {
      const newMol = insertRing(molecule, ringRef.current, x, y);
      onHistoryPush(molecule);
      onMoleculeChange(newMol);
      onRingPlaced();
      return;
    }

    // 橡皮擦
    if (tool === 'eraser') {
      const atom = findAtomAt(molecule, x, y);
      if (atom) {
        onHistoryPush(molecule);
        onMoleculeChange(removeAtom(molecule, atom.id));
        return;
      }
      const bond = findBondAt(molecule, x, y);
      if (bond) {
        onHistoryPush(molecule);
        onMoleculeChange(removeBond(molecule, bond.id));
        return;
      }
      return;
    }

    // 选择工具：拖动原子
    if (tool === 'select') {
      const atom = findAtomAt(molecule, x, y);
      if (atom) {
        dragRef.current = { atomId: atom.id, startX: atom.x, startY: atom.y };
        return;
      }
      // 点击键：切换键型
      const bond = findBondAt(molecule, x, y, 16);
      if (bond) {
        onHistoryPush(molecule);
        onMoleculeChange({
          atoms: molecule.atoms,
          bonds: molecule.bonds.map((b) =>
            b.id === bond.id ? { ...b, type: cycleBondType(b.type) } : b
          ),
        });
        return;
      }
      return;
    }

    // 原子工具：修改原子元素/添加原子
    if (tool === 'atom') {
      const atom = findAtomAt(molecule, x, y);
      if (atom) {
        onHistoryPush(molecule);
        onMoleculeChange(updateAtom(molecule, atom.id, { element: currentElement }));
        return;
      }
      // 空白处添加原子
      onHistoryPush(molecule);
      onMoleculeChange(addAtom(molecule, createAtom(x, y, currentElement)));
      return;
    }

    // 键工具
    if (tool.startsWith('bond')) {
      const atom = findAtomAt(molecule, x, y);
      if (atom) {
        if (firstAtomRef.current === null) {
          // 第一次点击：选中起始原子
          firstAtomRef.current = atom.id;
        } else if (firstAtomRef.current !== atom.id) {
          // 第二次点击：创建键
          const bondType: BondType = tool === 'bond-double' ? 'double'
            : tool === 'bond-triple' ? 'triple'
            : tool === 'bond-wedge-up' ? 'wedge-up'
            : tool === 'bond-wedge-down' ? 'wedge-down'
            : 'single';

          // 检查键是否已存在
          const exists = molecule.bonds.some(
            (b) => (b.fromId === firstAtomRef.current && b.toId === atom.id) ||
                   (b.toId === firstAtomRef.current && b.fromId === atom.id)
          );
          if (!exists) {
            onHistoryPush(molecule);
            onMoleculeChange(addBond(molecule, createBond(firstAtomRef.current!, atom.id, bondType)));
          }
          firstAtomRef.current = null;
        } else {
          // 点击同一个原子：取消
          firstAtomRef.current = null;
        }
        return;
      }
      // 点击空白处：添加新原子并开始连线
      onHistoryPush(molecule);
      const newAtom = createAtom(x, y, 'C');
      const mol1 = addAtom(molecule, newAtom);
      if (firstAtomRef.current !== null) {
        const bondType: BondType = tool === 'bond-double' ? 'double'
          : tool === 'bond-triple' ? 'triple'
          : tool === 'bond-wedge-up' ? 'wedge-up'
          : tool === 'bond-wedge-down' ? 'wedge-down'
          : 'single';
        const mol2 = addBond(mol1, createBond(firstAtomRef.current!, newAtom.id, bondType));
        onMoleculeChange(mol2);
        firstAtomRef.current = null;
      } else {
        onMoleculeChange(mol1);
        firstAtomRef.current = newAtom.id;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { x, y } = getCanvasPos(e);
    const newMol = moveAtom(molecule, dragRef.current.atomId, x, y);
    onMoleculeChange(newMol);
  };

  const handleMouseUp = () => {
    if (dragRef.current) {
      const atom = molecule.atoms.find((a) => a.id === dragRef.current!.atomId);
      if (atom && (atom.x !== dragRef.current!.startX || atom.y !== dragRef.current!.startY)) {
        onHistoryPush(molecule);
      }
      dragRef.current = null;
    }
  };

  // 光标样式
  const cursorClass = tool === 'eraser' ? 'cursor-crosshair' 
    : tool.startsWith('bond') ? 'cursor-crosshair'
    : tool === 'atom' ? 'cursor-cell'
    : ringRef.current ? 'cursor-copy'
    : 'cursor-default';

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={600}
      className={`w-full h-full border border-gray-200 rounded-lg ${cursorClass}`}
      style={{ minHeight: '500px', background: '#fafafa' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

// 工具函数：绘制圆角矩形
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
