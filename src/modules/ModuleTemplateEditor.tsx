import { useState } from 'react';
import type { ModuleField } from '../types';

interface ModuleTemplateEditorProps {
  initialName?: string;
  initialDescription?: string;
  initialFields?: ModuleField[];
  onSave: (data: { name: string; description: string; fields: string }) => void;
  onClose: () => void;
  title?: string;
}

const FIELD_TYPES: { value: ModuleField['type']; label: string }[] = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'textarea', label: '长文本' },
  { value: 'select', label: '下拉选择' },
  { value: 'image', label: '图片' },
  { value: 'structure', label: '化学结构式' },
];

function OptionsInput({ value, onChange }: { value: string[]; onChange: (opts: string[]) => void }) {
  // Maintain local text state to allow comma input without immediate split
  const [text, setText] = useState<string | null>(null);

  // Sync from external value only when the local text is not being edited
  const displayText = text !== null ? text : value.join(', ');
  const isEditing = text !== null;

  const handleChange = (raw: string) => {
    setText(raw);
    // Only sync back to options array if the input ends with a comma or is cleared
    if (raw === '') {
      onChange([]);
      setText(null);
    } else if (raw.endsWith(',') || raw.endsWith('，')) {
      const opts = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      onChange(opts);
    }
  };

  const handleBlur = () => {
    // On blur, finalize the options
    if (text !== null && text.trim()) {
      const opts = text.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      onChange(opts);
      setText(opts.join(', '));
    }
    setText(null);
  };

  return (
    <input
      type="text"
      value={displayText}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      placeholder="选项（逗号分隔）"
      className="input-field !py-xs !text-xs"
    />
  );
}

function emptyField(): ModuleField {
  return { key: '', label: '', type: 'text', span: 'half' };
}

export default function ModuleTemplateEditor({
  initialName = '',
  initialDescription = '',
  initialFields,
  onSave,
  onClose,
  title = '创建自定义模块',
}: ModuleTemplateEditorProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [fields, setFields] = useState<ModuleField[]>(
    initialFields?.length ? initialFields : [emptyField()]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (index: number, key: keyof ModuleField, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    // Auto-generate key from label
    if (key === 'label' && !updated[index].key) {
      updated[index].key = (value as string)
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '_')
        .replace(/^_|_$/g, '')
        || `field_${index}`;
    }
    // Reset options when type changes away from select
    if (key === 'type' && value !== 'select') {
      updated[index].options = undefined;
    }
    setFields(updated);
  };

  const addField = () => setFields([...fields, emptyField()]);
  const removeField = (index: number) => {
    if (fields.length <= 1) return;
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = '请输入模块名称';

    const validFields = fields.filter((f) => f.label.trim());
    if (validFields.length === 0) errs.fields = '至少需要一个字段';

    validFields.forEach((f, i) => {
      if (!f.key.trim()) f.key = `field_${i}`;
    });

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      fields: JSON.stringify(validFields.map((f) => ({
        ...f,
        key: f.key || `field_${fields.indexOf(f)}`,
      }))),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-[600px] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-lg border-b border-slate-200">
          <h3 className="text-h2">{title}</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto p-lg flex-1 space-y-md">
          {/* Module name */}
          <div>
            <label className="block text-caption text-gray-500 mb-xs">模块名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => { const n = { ...p }; delete n.name; return n; }); }}
              placeholder="如: 表征数据、安全信息..."
              className={`input-field ${errors.name ? '!border-red-500' : ''}`}
              autoFocus
            />
            {errors.name && <p className="text-red-500 text-caption mt-xs">{errors.name}</p>}
          </div>

          {/* Module description */}
          <div>
            <label className="block text-caption text-gray-500 mb-xs">描述（可选）</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要说明模块用途"
              className="input-field"
            />
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-sm">
              <label className="text-caption text-gray-500">字段定义</label>
              <button type="button" onClick={addField} className="btn-ghost text-primary-500 text-xs">
                + 添加字段
              </button>
            </div>
            {errors.fields && <p className="text-red-500 text-caption mb-xs">{errors.fields}</p>}

            <div className="space-y-sm">
              {fields.map((field, i) => (
                <div key={i} className="flex items-start gap-sm bg-gray-50 rounded-lg p-md">
                  <span className="text-caption text-gray-400 w-5 pt-1.5">{i + 1}</span>
                  <div className="flex-1 grid grid-cols-4 gap-sm">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(i, 'label', e.target.value)}
                      placeholder="标签名"
                      className="input-field !py-xs !text-xs col-span-2"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateField(i, 'type', e.target.value)}
                      className="select-field !py-xs !text-xs"
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                    <select
                      value={field.span || 'half'}
                      onChange={(e) => updateField(i, 'span', e.target.value)}
                      className="select-field !py-xs !text-xs"
                    >
                      <option value="half">半宽</option>
                      <option value="full">全宽</option>
                    </select>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(i, 'placeholder', e.target.value)}
                        placeholder="占位提示"
                        className="input-field !py-xs !text-xs"
                      />
                    </div>
                    {field.type === 'select' && (
                      <div className="col-span-2">
                        <OptionsInput
                          value={field.options || []}
                          onChange={(opts) => updateField(i, 'options', opts)}
                        />
                      </div>
                    )}
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      className="text-gray-400 hover:text-red-500 p-xs shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-sm p-lg border-t border-slate-200">
          <button type="button" onClick={onClose} className="btn-secondary">取消</button>
          <button type="button" onClick={handleSave} disabled={!name.trim()} className="btn-primary">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
