import { useState, useEffect } from 'react';
import type { ModuleTemplate } from '../types';
import { STANDARD_MODULES } from './registry';

interface ModulePickerProps {
  hiddenStandardKeys: string[];
  availableCustomTemplates: ModuleTemplate[];
  onAddStandard: (key: string) => void;
  onAddCustom: (templateId: number) => void;
  onCreateCustom: () => void;
  onDeleteCustom?: (templateId: number) => void;
  onClose: () => void;
}

export default function ModulePicker({
  hiddenStandardKeys,
  availableCustomTemplates,
  onAddStandard,
  onAddCustom,
  onCreateCustom,
  onDeleteCustom,
  onClose,
}: ModulePickerProps) {
  const [filter, setFilter] = useState('');
  const filteredCustom = filter
    ? availableCustomTemplates.filter(
        (t) =>
          t.name.toLowerCase().includes(filter.toLowerCase()) ||
          (t.description || '').toLowerCase().includes(filter.toLowerCase())
      )
    : availableCustomTemplates;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-[520px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-lg border-b border-slate-200">
          <h3 className="text-h2">添加模块</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto p-lg flex-1 space-y-lg">
          {/* Hidden standard modules */}
          {hiddenStandardKeys.length > 0 && (
            <div>
              <h4 className="text-label font-medium text-gray-500 mb-sm">已隐藏的标准模块</h4>
              <div className="space-y-xs">
                {hiddenStandardKeys.map((key) => {
                  const def = STANDARD_MODULES[key];
                  if (!def) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onAddStandard(key)}
                      className="w-full text-left px-md py-sm rounded-lg border border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors flex items-center gap-sm"
                    >
                      <svg className="w-4 h-4 text-primary-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-body">{def.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom templates */}
          <div>
            <div className="flex items-center justify-between mb-sm">
              <h4 className="text-label font-medium text-gray-500">模板模块</h4>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="搜索模板..."
                className="input-field !w-[160px] !py-xs !text-xs"
              />
            </div>

            {filteredCustom.length > 0 ? (
              <div className="space-y-xs">
                {filteredCustom.map((t) => (
                  <div
                    key={t.id}
                    className="w-full text-left px-md py-sm rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors flex items-center gap-sm group"
                  >
                    <div
                      className="flex items-center gap-sm flex-1 min-w-0 cursor-pointer"
                      onClick={() => onAddCustom(t.id)}
                    >
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <span className="text-body block truncate">{t.name}</span>
                        {t.description && (
                          <span className="text-caption text-gray-400 block truncate">{t.description}</span>
                        )}
                      </div>
                      {t.is_preset && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">预置</span>
                      )}
                    </div>
                    {!t.is_preset && onDeleteCustom && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteCustom(t.id); }}
                        className="text-gray-400 hover:text-red-500 p-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="删除此模板"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-caption text-gray-400">
                {filter ? '没有匹配的模板' : '暂无可用模板'}
              </p>
            )}
          </div>

          {/* Create custom */}
          <button
            type="button"
            onClick={onCreateCustom}
            className="w-full text-left px-md py-sm rounded-lg border border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 transition-colors flex items-center gap-sm"
          >
            <svg className="w-4 h-4 text-primary-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-body">创建自定义模块模板</span>
          </button>
        </div>
      </div>
    </div>
  );
}
