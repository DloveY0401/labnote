import { type ClipboardEvent, type ChangeEvent } from 'react';
import { Reactant } from '../types';
import StructureImage, { isSmilesLike } from './StructureImage';

interface ReactantTableProps {
  reactants: Reactant[];
  onChange: (reactants: Reactant[]) => void;
  onOpenStructureDraw?: (index: number) => void;
}

const emptyRow = (): Reactant => ({
  name: '',
  formula: '',
  amount: null,
  amount_unit: 'g',
  equiv: null,
  role: '',
  structure_image: null,
  molecular_weight: null,
  molar_amount: null,
});

/** Convert molar_amount (mmol) + MW (g/mol) → amount in given unit.
 *  Returns 0 for non-mass units (mL) where conversion is not meaningful. */
function molarToAmount(molarAmount: number, mw: number, unit: string): number {
  switch (unit) {
    case 'g':    return (mw * molarAmount) / 1000;
    case 'mg':   return mw * molarAmount;
    case 'mol':  return molarAmount / 1000;
    case 'mmol': return molarAmount;
    default:     return 0;
  }
}

/** Convert amount + MW (g/mol) → molar_amount (mmol) based on unit.
 *  Returns 0 for non-mass units. */
function amountToMolar(amount: number, mw: number, unit: string): number {
  switch (unit) {
    case 'g':    return (amount / mw) * 1000;
    case 'mg':   return amount / mw;
    case 'mol':  return amount * 1000;
    case 'mmol': return amount;
    default:     return 0;
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function imageFromClipboard(items: DataTransferItemList): Promise<string | null> {
  return new Promise((resolve) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
          return;
        }
      }
    }
    resolve(null);
  });
}

/** Convert data URL to file-based filename via IPC, or return the original on failure */
async function saveImage(dataUrl: string): Promise<string> {
  try {
    if ((window as any).labnote?.images?.save) {
      return await (window as any).labnote.images.save(dataUrl);
    }
  } catch (err) {
    console.warn('Image save via IPC failed, falling back to data URL:', err);
  }
  return dataUrl; // fallback to data URL
}

/** Resolve stored image value to a displayable src */
function getImageSrc(value: string | null): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('data:')) return value;           // legacy data URL
  if (value.startsWith('http:') || value.startsWith('labnote:')) return value;
  return `labnote://images/${value}`;                     // new file-based
}

export default function ReactantTable({ reactants, onChange, onOpenStructureDraw }: ReactantTableProps) {
  const updateRow = (index: number, field: keyof Reactant, value: string | number | null) => {
    const updated = [...reactants];
    updated[index] = { ...updated[index], [field]: value };

    const r = updated[index];
    const mw = r.molecular_weight;

    if (mw != null && mw > 0) {
      if (field === 'molecular_weight' || field === 'molar_amount') {
        // MW or molar_amount changed → recalculate amount from molar_amount
        const ma = r.molar_amount;
        if (ma != null && ma > 0) {
          updated[index].amount = round4(molarToAmount(ma, mw, r.amount_unit));
        }
      } else if (field === 'amount') {
        // Amount changed → recalculate molar_amount
        const amt = r.amount;
        if (amt != null && amt > 0) {
          const newMa = amountToMolar(amt, mw, r.amount_unit);
          if (newMa > 0) updated[index].molar_amount = round4(newMa);
        }
      } else if (field === 'amount_unit') {
        // Unit changed → recalculate amount, molar_amount stays same
        const ma = r.molar_amount;
        if (ma != null && ma > 0) {
          updated[index].amount = round4(molarToAmount(ma, mw, value as string));
        } else {
          // No molar_amount → recalc molar from existing amount+new unit, then recalc amount
          const amt = r.amount;
          if (amt != null && amt > 0) {
            const newMa = amountToMolar(amt, mw, value as string);
            if (newMa > 0) {
              updated[index].molar_amount = round4(newMa);
              updated[index].amount = round4(molarToAmount(newMa, mw, value as string));
            }
          }
        }
      }
    }

    onChange(updated);
  };

  const addRow = () => onChange([...reactants, emptyRow()]);

  const removeRow = (index: number) => {
    if (reactants.length <= 1) return;
    onChange(reactants.filter((_, i) => i !== index));
  };

  const handleStructurePaste = async (index: number, e: ClipboardEvent) => {
    const items = e.clipboardData.items;
    if (!items) return;
    const dataUrl = await imageFromClipboard(items);
    if (dataUrl) {
      e.preventDefault();
      const filename = await saveImage(dataUrl);
      updateRow(index, 'structure_image', filename);
    }
  };

  const handleFileSelect = async (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const filename = await saveImage(dataUrl);
      updateRow(index, 'structure_image', filename);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearStructure = (index: number) => {
    updateRow(index, 'structure_image', null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-sm">
        <h3 className="section-title mb-0">反应物</h3>
        <button type="button" onClick={addRow} className="btn-ghost text-primary-500 flex items-center gap-xs">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium w-[30px]">#</th>
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium">名称</th>
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium w-[140px]">分子式</th>
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium w-[80px]">MW</th>
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium w-[80px]">摩尔量</th>
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium w-[90px]">用量</th>
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium w-[70px]">单位</th>
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium w-[70px]">当量</th>
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium w-[100px]">角色</th>
              <th className="text-left py-xs px-sm text-caption text-gray-400 font-medium w-[120px]">结构式</th>
              <th className="w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {reactants.map((r, i) => {
              const smilesLike = isSmilesLike(r.structure_image);
              const imgSrc = smilesLike ? undefined : getImageSrc(r.structure_image);
              return (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-xs px-sm text-caption text-gray-400">{i + 1}</td>
                <td className="py-xs px-sm">
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => updateRow(i, 'name', e.target.value)}
                    placeholder="如: 苯胺"
                    className="input-field !py-xs !px-sm !text-body"
                  />
                </td>
                <td className="py-xs px-sm">
                  <input
                    type="text"
                    value={r.formula}
                    onChange={(e) => updateRow(i, 'formula', e.target.value)}
                    placeholder="C6H7N"
                    className="input-field !py-xs !px-sm !text-body"
                  />
                </td>
                <td className="py-xs px-sm">
                  <input
                    type="number"
                    step="any"
                    value={r.molecular_weight ?? ''}
                    onChange={(e) => updateRow(i, 'molecular_weight', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="MW"
                    className="input-field !py-xs !px-sm !text-body"
                  />
                </td>
                <td className="py-xs px-sm">
                  <input
                    type="number"
                    step="any"
                    value={r.molar_amount ?? ''}
                    onChange={(e) => updateRow(i, 'molar_amount', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="mmol"
                    className="input-field !py-xs !px-sm !text-body"
                  />
                </td>
                <td className="py-xs px-sm">
                  <input
                    type="number"
                    step="any"
                    value={r.amount ?? ''}
                    onChange={(e) => updateRow(i, 'amount', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0"
                    className="input-field !py-xs !px-sm !text-body"
                  />
                </td>
                <td className="py-xs px-sm">
                  <select
                    value={r.amount_unit}
                    onChange={(e) => updateRow(i, 'amount_unit', e.target.value)}
                    className="select-field !py-xs !px-sm !text-body"
                  >
                    <option value="g">g</option>
                    <option value="mg">mg</option>
                    <option value="mL">mL</option>
                    <option value="mol">mol</option>
                    <option value="mmol">mmol</option>
                  </select>
                </td>
                <td className="py-xs px-sm">
                  <input
                    type="number"
                    step="any"
                    value={r.equiv ?? ''}
                    onChange={(e) => updateRow(i, 'equiv', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="1.0"
                    className="input-field !py-xs !px-sm !text-body"
                  />
                </td>
                <td className="py-xs px-sm">
                  <input
                    type="text"
                    value={r.role}
                    onChange={(e) => updateRow(i, 'role', e.target.value)}
                    placeholder="底物"
                    className="input-field !py-xs !px-sm !text-body"
                  />
                </td>
                <td
                  className="py-xs px-sm"
                  onPaste={(e) => handleStructurePaste(i, e)}
                >
                  <div className="flex items-center gap-xs min-w-0">
                    <div className="flex-1 min-w-0">
                      {smilesLike ? (
                        <div className="relative group inline-block">
                          <StructureImage
                            smiles={r.structure_image || ''}
                            width={130}
                            height={48}
                          />
                          <button
                            type="button"
                            onClick={() => clearStructure(i)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none
                                       opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            title="删除结构式"
                          >
                            ×
                          </button>
                        </div>
                      ) : imgSrc ? (
                        <div className="relative group inline-block">
                          <img
                            src={imgSrc}
                            alt="结构式"
                            className="h-12 max-w-[100px] object-contain border border-gray-200 rounded"
                            onDoubleClick={() => {
                              const w = window.open('', '_blank');
                              if (w) {
                                w.document.write(`<img src="${imgSrc}" style="max-width:100%;height:auto" />`);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => clearStructure(i)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none
                                       opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            title="删除结构式"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-center border border-dashed border-gray-300 rounded h-12 text-caption text-gray-400
                                     hover:border-primary-400 hover:text-primary-500 transition-colors gap-xs"
                        >
                          <label className="cursor-pointer flex items-center gap-xs">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px]">上传</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileSelect(i, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    {onOpenStructureDraw && (
                      <button
                        type="button"
                        onClick={() => onOpenStructureDraw(i)}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-primary-400 text-primary-600 hover:bg-primary-50 shrink-0"
                        title="绘制结构式"
                      >
                        {smilesLike ? '编辑' : '绘制'}
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-xs px-sm">
                  {reactants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
