import { useRef } from 'react';

export interface WidgetPrefs {
  opacity: number;
  fontScale: number;
  bearEnabled: boolean;
  bearSize: number;
  bearOpacity: number;
  bearSet: 'default' | 'alt';
  // Custom images (base64 data URLs, stored separately for size)
  customLeftImg: string | null;
  customRightImg: string | null;
}

const DEFAULT_PREFS: WidgetPrefs = {
  opacity: 0.88, fontScale: 1.0,
  bearEnabled: true, bearSize: 70, bearOpacity: 1.0, bearSet: 'default',
  customLeftImg: null, customRightImg: null,
};

export function loadWidgetPrefs(): WidgetPrefs {
  try {
    const stored = localStorage.getItem('widgetPrefs');
    const base = stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : { ...DEFAULT_PREFS };
    // Restore custom images from separate keys
    base.customLeftImg = localStorage.getItem('widgetCustomLeft') || null;
    base.customRightImg = localStorage.getItem('widgetCustomRight') || null;
    return base;
  } catch { /* ignore */ }
  return DEFAULT_PREFS;
}

export function saveWidgetPrefs(prefs: WidgetPrefs) {
  // Store large base64 strings in separate localStorage keys to avoid hitting limits
  const { customLeftImg, customRightImg, ...rest } = prefs;
  localStorage.setItem('widgetPrefs', JSON.stringify(rest));
  if (customLeftImg) {
    try { localStorage.setItem('widgetCustomLeft', customLeftImg); } catch { /* too large */ }
  } else {
    localStorage.removeItem('widgetCustomLeft');
  }
  if (customRightImg) {
    try { localStorage.setItem('widgetCustomRight', customRightImg); } catch { /* too large */ }
  } else {
    localStorage.removeItem('widgetCustomRight');
  }
}

export function loadCustomImages(): { left: string | null; right: string | null } {
  return {
    left: localStorage.getItem('widgetCustomLeft') || null,
    right: localStorage.getItem('widgetCustomRight') || null,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  prefs: WidgetPrefs;
  onChange: (prefs: WidgetPrefs) => void;
}

const rangeClass = "w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:cursor-pointer";

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function WidgetSettings({ open, onClose, prefs, onChange }: Props) {
  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const update = (partial: Partial<WidgetPrefs>) => {
    const next = { ...prefs, ...partial };
    onChange(next);
    saveWidgetPrefs(next);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-[#1e2132] border border-white/10 rounded-lg p-md w-[260px] shadow-xl max-h-[90%] flex flex-col">
        <div className="flex items-center justify-between mb-md flex-shrink-0">
          <h3 className="text-xs text-gray-200 font-semibold">小组件设置</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-md">
          {/* Opacity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-gray-400">透明度</label>
              <span className="text-[11px] text-gray-500">{Math.round(prefs.opacity * 100)}%</span>
            </div>
            <input type="range" min="50" max="100" step="5"
              value={Math.round(prefs.opacity * 100)}
              onChange={e => update({ opacity: Number(e.target.value) / 100 })}
              className={rangeClass} />
          </div>

          {/* Font Scale */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-gray-400">字体大小</label>
              <span className="text-[11px] text-gray-500">{Math.round(prefs.fontScale * 100)}%</span>
            </div>
            <input type="range" min="60" max="200" step="10"
              value={Math.round(prefs.fontScale * 100)}
              onChange={e => update({ fontScale: Number(e.target.value) / 100 })}
              className={rangeClass} />
          </div>

          {/* Bear Decoration */}
          <div className="pt-md border-t border-white/10">
            <h4 className="text-xs text-gray-200 font-semibold mb-sm">装饰小熊</h4>
            <div className="flex items-center justify-between mb-sm">
              <label className="text-[11px] text-gray-400">显示</label>
              <button onClick={() => update({ bearEnabled: !prefs.bearEnabled })}
                className={`w-9 h-5 rounded-full transition-colors relative ${prefs.bearEnabled ? 'bg-primary-500' : 'bg-white/10'}`}>
                <span className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${prefs.bearEnabled ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            <div className="mb-sm">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400">大小</label>
                <span className="text-[11px] text-gray-500">{prefs.bearSize}px</span>
              </div>
              <input type="range" min="40" max="120" step="5"
                value={prefs.bearSize} onChange={e => update({ bearSize: Number(e.target.value) })}
                className={rangeClass} />
            </div>
            <div className="mb-sm">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400">透明度</label>
                <span className="text-[11px] text-gray-500">{Math.round(prefs.bearOpacity * 100)}%</span>
              </div>
              <input type="range" min="30" max="100" step="5"
                value={Math.round(prefs.bearOpacity * 100)}
                onChange={e => update({ bearOpacity: Number(e.target.value) / 100 })}
                className={rangeClass} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-gray-400">样式</label>
              <div className="flex gap-1">
                <button onClick={() => update({ bearSet: 'default' })}
                  className={`text-[11px] px-2 py-1 rounded border ${prefs.bearSet === 'default' ? 'border-primary-500 text-primary-300' : 'border-white/10 text-gray-500'}`}>默认</button>
                <button onClick={() => update({ bearSet: 'alt' })}
                  className={`text-[11px] px-2 py-1 rounded border ${prefs.bearSet === 'alt' ? 'border-primary-500 text-primary-300' : 'border-white/10 text-gray-500'}`}>云朵</button>
              </div>
            </div>

            {/* Custom images */}
            <div className="mt-sm pt-sm border-t border-white/10">
              <h5 className="text-[10px] text-gray-500 mb-sm">自定义图片</h5>
              {/* Left image */}
              <div className="mb-sm">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-gray-400">左侧</label>
                  {prefs.customLeftImg && (
                    <button onClick={() => update({ customLeftImg: null })}
                      className="text-[10px] text-gray-500 hover:text-red-400">清除</button>
                  )}
                </div>
                <input ref={leftInputRef} type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) update({ customLeftImg: await readFileAsDataURL(f) });
                  }} />
                {prefs.customLeftImg ? (
                  <img src={prefs.customLeftImg} className="w-full h-10 object-cover rounded border border-white/10 cursor-pointer"
                    onClick={() => leftInputRef.current?.click()} />
                ) : (
                  <button onClick={() => leftInputRef.current?.click()}
                    className="w-full text-[11px] text-gray-500 hover:text-gray-300 py-1 rounded border border-dashed border-white/10 hover:border-white/20">
                    + 选择图片
                  </button>
                )}
              </div>
              {/* Right image */}
              <div className="mb-sm">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-gray-400">右侧</label>
                  {prefs.customRightImg && (
                    <button onClick={() => update({ customRightImg: null })}
                      className="text-[10px] text-gray-500 hover:text-red-400">清除</button>
                  )}
                </div>
                <input ref={rightInputRef} type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) update({ customRightImg: await readFileAsDataURL(f) });
                  }} />
                {prefs.customRightImg ? (
                  <img src={prefs.customRightImg} className="w-full h-10 object-cover rounded border border-white/10 cursor-pointer"
                    onClick={() => rightInputRef.current?.click()} />
                ) : (
                  <button onClick={() => rightInputRef.current?.click()}
                    className="w-full text-[11px] text-gray-500 hover:text-gray-300 py-1 rounded border border-dashed border-white/10 hover:border-white/20">
                    + 选择图片
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reset */}
        <button onClick={() => {
          localStorage.removeItem('widgetCustomLeft');
          localStorage.removeItem('widgetCustomRight');
          onChange(DEFAULT_PREFS);
          saveWidgetPrefs(DEFAULT_PREFS);
        }}
          className="w-full text-[11px] text-gray-500 hover:text-gray-300 py-sm rounded border border-white/10 hover:border-white/20 transition-colors mt-md flex-shrink-0">
          恢复默认
        </button>
      </div>
    </div>
  );
}
