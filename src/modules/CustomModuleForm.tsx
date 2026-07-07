import { useNavigate } from 'react-router-dom';
import { type ClipboardEvent, type ChangeEvent } from 'react';
import type { ModuleField, ModuleTemplate } from '../types';
import StructureImage from '../components/StructureImage';

interface CustomModuleFormProps {
  template: ModuleTemplate;
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
  saveImage: (dataUrl: string) => Promise<string>;
  onOpenStructureDraw?: (fieldKey: string, setResult: (result: any) => void) => void;
}

function resolveImageSrc(value: string): string {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('labnote:') || value.startsWith('http:')) return value;
  return `labnote://images/${value}`;
}

export default function CustomModuleForm({
  template,
  data,
  onChange,
  saveImage,
  onOpenStructureDraw,
}: CustomModuleFormProps) {
  const navigate = useNavigate();
  const fields: ModuleField[] = (template && template.fields) || [];

  const openStructureDraw = (key: string) => {
    if (onOpenStructureDraw) {
      onOpenStructureDraw(key, (result) => updateField(key, result));
      return;
    }
    // Fallback: use route navigation
    const currentSmiles = data[key]?.smiles || '';
    (window as any).__structureInitialSmiles = currentSmiles;
    (window as any).structureDrawResult = (result: any) => {
      updateField(key, result);
    };
    navigate('/structure');
  };

  const updateField = (key: string, value: any) => {
    onChange({ ...data, [key]: value });
  };

  const handleImagePaste = async (key: string, e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = async () => {
            const filename = await saveImage(reader.result as string);
            updateField(key, filename);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    }
  };

  const handleImageFile = async (key: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const filename = await saveImage(reader.result as string);
      updateField(key, filename);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearImage = (key: string) => updateField(key, null);

  if (fields.length === 0) {
    return <p className="text-caption text-gray-400">此模块无已定义字段，请编辑模板。</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-md">
      {fields.map((field) => {
        const value = data[field.key] ?? '';
        const spanClass = field.span === 'full' ? 'col-span-2' : '';

        const label = (
          <label className="block text-caption text-gray-500 mb-xs">
            {field.label}
            {field.required && <span className="text-red-400 ml-xs">*</span>}
          </label>
        );

        switch (field.type) {
          case 'textarea':
            return (
              <div key={field.key} className={spanClass || 'col-span-2'}>
                {label}
                <textarea
                  value={value}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={4}
                  className="input-field resize-y"
                />
              </div>
            );

          case 'select':
            return (
              <div key={field.key} className={spanClass}>
                {label}
                <select
                  value={value}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="select-field"
                >
                  <option value="">--</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            );

          case 'number':
            return (
              <div key={field.key} className={spanClass}>
                {label}
                <input
                  type="number"
                  step="any"
                  value={value ?? ''}
                  onChange={(e) => updateField(field.key, e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder={field.placeholder}
                  className="input-field"
                />
              </div>
            );

          case 'image':
            return (
              <div key={field.key} className={spanClass || 'col-span-2'}>
                {label}
                <div
                  className="border border-dashed border-gray-300 rounded-lg p-md min-h-[60px] hover:border-primary-400 transition-colors"
                  onPaste={(e) => handleImagePaste(field.key, e)}
                >
                  {value ? (
                    <div className="relative group inline-block">
                      <img
                        src={resolveImageSrc(value)}
                        alt={field.label}
                        className="h-20 w-auto object-contain border border-gray-200 rounded"
                        onDoubleClick={() => {
                          const w = window.open('', '_blank');
                          if (w) w.document.write(`<img src="${resolveImageSrc(value)}" style="max-width:100%;height:auto" />`);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => clearImage(field.key)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none
                                   opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-xs cursor-pointer text-gray-400 hover:text-primary-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs">点击上传 / Ctrl+V 粘贴</span>
                      <input type="file" accept="image/*" onChange={(e) => handleImageFile(field.key, e)} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            );

          case 'structure':
            return (
              <div key={field.key} className={spanClass || 'col-span-2'}>
                {label}
                {value?.smiles ? (
                  <div className="border border-gray-200 rounded-lg p-md bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="space-y-xs flex-1 min-w-0">
                        <StructureImage smiles={value.smiles} width={240} height={120} />
                        <div className="flex flex-wrap items-center gap-x-md gap-y-1 text-xs text-gray-500">
                          {value.formula && <span>分子式: <strong>{value.formula}</strong></span>}
                          {value.molecularWeight > 0 && <span>MW: <strong>{value.molecularWeight.toFixed(2)}</strong></span>}
                          {value.name && <span className="text-gray-400 italic">{value.name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-xs ml-sm shrink-0">
                        <button type="button" onClick={() => openStructureDraw(field.key)} className="btn-ghost text-primary-500 text-xs">编辑</button>
                        <button type="button" onClick={() => updateField(field.key, null)} className="btn-ghost text-red-500 text-xs">移除</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openStructureDraw(field.key)}
                    className="w-full border border-dashed border-gray-300 rounded-lg p-lg hover:border-primary-400 hover:bg-primary-50 transition-colors flex items-center justify-center gap-sm"
                  >
                    <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span className="text-body text-primary-600">绘制化学结构式</span>
                  </button>
                )}
              </div>
            );

          case 'text':
          default:
            return (
              <div key={field.key} className={spanClass}>
                {label}
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="input-field"
                />
              </div>
            );
        }
      })}
    </div>
  );
}
