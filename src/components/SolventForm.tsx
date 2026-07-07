import { Solvent } from '../types';

interface SolventFormProps {
  solvents: Solvent[];
  onChange: (solvents: Solvent[]) => void;
}

const emptyRow = (): Solvent => ({
  name: '',
  volume: null,
  volume_unit: 'mL',
  ratio: '',
});

export default function SolventForm({ solvents, onChange }: SolventFormProps) {
  const updateRow = (index: number, field: keyof Solvent, value: string | number | null) => {
    const updated = [...solvents];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addRow = () => onChange([...solvents, emptyRow()]);
  const removeRow = (index: number) => onChange(solvents.filter((_, i) => i !== index));

  return (
    <div>
      <div className="flex items-center justify-end mb-sm">
        <button type="button" onClick={addRow} className="btn-ghost text-primary-500 flex items-center gap-xs">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加
        </button>
      </div>
      {solvents.length === 0 ? (
        <p className="text-gray-400 text-caption py-sm">暂无溶剂</p>
      ) : (
        <div className="space-y-sm">
          {solvents.map((s, i) => (
            <div key={i} className="flex items-center gap-sm">
              <input
                type="text"
                value={s.name}
                onChange={(e) => updateRow(i, 'name', e.target.value)}
                placeholder="名称"
                className="input-field flex-1 !text-body"
              />
              <input
                type="number"
                step="any"
                value={s.volume ?? ''}
                onChange={(e) => updateRow(i, 'volume', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="体积"
                className="input-field w-[80px] !text-body"
              />
              <select
                value={s.volume_unit}
                onChange={(e) => updateRow(i, 'volume_unit', e.target.value)}
                className="select-field w-[70px] !text-body"
              >
                <option value="mL">mL</option>
                <option value="L">L</option>
                <option value="μL">μL</option>
              </select>
              <input
                type="text"
                value={s.ratio}
                onChange={(e) => updateRow(i, 'ratio', e.target.value)}
                placeholder="比例"
                className="input-field w-[80px] !text-body"
              />
              <button type="button" onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-500 p-xs">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
