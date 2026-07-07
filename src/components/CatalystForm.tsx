import { Catalyst } from '../types';

interface CatalystFormProps {
  catalysts: Catalyst[];
  onChange: (catalysts: Catalyst[]) => void;
}

const emptyRow = (): Catalyst => ({
  name: '',
  amount: null,
  amount_unit: 'g',
  molecular_weight: null,
  molar_amount: null,
});

function molarToAmount(molarAmount: number, mw: number, unit: string): number {
  switch (unit) {
    case 'g':   return (mw * molarAmount) / 1000;
    case 'mg':  return mw * molarAmount;
    case 'mol': return molarAmount / 1000;
    case 'mmol': return molarAmount;
    default:    return 0; // mol% etc. — not mass-based
  }
}

function amountToMolar(amount: number, mw: number, unit: string): number {
  switch (unit) {
    case 'g':   return (amount / mw) * 1000;
    case 'mg':  return amount / mw;
    case 'mol': return amount * 1000;
    case 'mmol': return amount;
    default:    return 0;
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export default function CatalystForm({ catalysts, onChange }: CatalystFormProps) {
  const updateRow = (index: number, field: keyof Catalyst, value: string | number | null) => {
    const updated = [...catalysts];
    updated[index] = { ...updated[index], [field]: value };

    const c = updated[index];
    const mw = c.molecular_weight;

    if (mw != null && mw > 0) {
      if (field === 'molecular_weight' || field === 'molar_amount') {
        const ma = c.molar_amount;
        if (ma != null && ma > 0) {
          updated[index].amount = round4(molarToAmount(ma, mw, c.amount_unit));
        }
      } else if (field === 'amount') {
        const amt = c.amount;
        if (amt != null && amt > 0) {
          const newMa = amountToMolar(amt, mw, c.amount_unit);
          if (newMa > 0) updated[index].molar_amount = round4(newMa);
        }
      } else if (field === 'amount_unit') {
        const ma = c.molar_amount;
        if (ma != null && ma > 0) {
          updated[index].amount = round4(molarToAmount(ma, mw, value as string));
        } else {
          const amt = c.amount;
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

  const addRow = () => onChange([...catalysts, emptyRow()]);
  const removeRow = (index: number) => onChange(catalysts.filter((_, i) => i !== index));

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
      {catalysts.length === 0 ? (
        <p className="text-gray-400 text-caption py-sm">暂无催化剂</p>
      ) : (
        <div className="space-y-sm">
          {catalysts.map((c, i) => (
            <div key={i} className="flex items-center gap-sm">
              <input
                type="text"
                value={c.name}
                onChange={(e) => updateRow(i, 'name', e.target.value)}
                placeholder="名称"
                className="input-field w-[140px] !text-body"
              />
              <input
                type="number"
                step="any"
                value={c.molecular_weight ?? ''}
                onChange={(e) => updateRow(i, 'molecular_weight', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="MW"
                className="input-field w-[80px] !text-body"
              />
              <input
                type="number"
                step="any"
                value={c.molar_amount ?? ''}
                onChange={(e) => updateRow(i, 'molar_amount', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="mmol"
                className="input-field w-[80px] !text-body"
              />
              <input
                type="number"
                step="any"
                value={c.amount ?? ''}
                onChange={(e) => updateRow(i, 'amount', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="用量"
                className="input-field w-[80px] !text-body"
              />
              <select
                value={c.amount_unit}
                onChange={(e) => updateRow(i, 'amount_unit', e.target.value)}
                className="select-field w-[80px] !text-body"
              >
                <option value="g">g</option>
                <option value="mg">mg</option>
                <option value="mol%">mol%</option>
              </select>
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
