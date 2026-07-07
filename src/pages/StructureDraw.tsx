import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { analyzeSmilesSync, analyzeSmiles, type SmilesInfo } from '../utils/smilesParser';

interface StructureDrawProps {
  initialSmiles?: string;
  onSave?: (result: {
    smiles: string;
    molfile: string;
    formula: string;
    molecularWeight: number;
    name: string;
  }) => void;
  onCancel?: () => void;
}

export default function StructureDraw({ initialSmiles, onSave, onCancel }: StructureDrawProps) {
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<SmilesInfo | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Read initial SMILES
  useEffect(() => {
    const smi = initialSmiles || (window as any).__structureInitialSmiles;
    if (smi) {
      delete (window as any).__structureInitialSmiles;
      const timer = setInterval(async () => {
        try {
          const k = (iframeRef.current?.contentWindow as any)?.ketcher;
          if (k && typeof k.setMolecule === 'function') {
            await k.setMolecule(smi);
            clearInterval(timer);
          }
        } catch {}
      }, 300);
      return () => clearInterval(timer);
    }
  }, [initialSmiles]);

  const waitForKetcher = useCallback(async (timeout = 15000): Promise<any> => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) throw new Error('iframe not loaded');
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const k = (iframe.contentWindow as any).ketcher;
        if (k && typeof k.getSmiles === 'function') return k;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('Ketcher failed to initialize');
  }, []);

  const handleIframeLoad = useCallback(() => {
    waitForKetcher().then(() => setLoading(false)).catch(() => setLoading(false));
  }, [waitForKetcher]);

  const getKetcher = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) throw new Error('iframe not loaded');
    // Ensure the iframe window is focused so cross-frame API calls work.
    // In Electron, iframe focus can block parent → child contentWindow access
    // until the window regains focus (e.g. by alt-tabbing away and back).
    try { iframe.contentWindow.focus(); } catch {}
    const k = (iframe.contentWindow as any).ketcher;
    if (!k) throw new Error('Ketcher not initialized');
    return k;
  }, []);

  /** Refresh the molecule info panel */
  const refreshInfo = useCallback(async () => {
    try {
      window.focus();
      await new Promise((r) => setTimeout(r, 30));
      const ketcher = await getKetcher();
      const smiles = await ketcher.getSmiles();
      if (smiles) {
        const syncInfo = analyzeSmilesSync(smiles);
        setInfo({ ...syncInfo, name: '' });
        // Async fetch name from PubChem
        analyzeSmiles(smiles).then((full) => {
          setInfo((prev) => prev?.smiles === full.smiles ? full : prev);
        });
      } else {
        setInfo(null);
      }
    } catch {}
  }, [getKetcher]);

  const handleCopySmiles = async () => {
    try {
      const ketcher = await getKetcher();
      const smiles = await ketcher.getSmiles();
      if (smiles) {
        await navigator.clipboard.writeText(smiles);
        showToast('SMILES 已复制', 'success');
      } else {
        showToast('未绘制任何结构', 'error');
      }
    } catch (err) {
      showToast('Error: ' + String(err), 'error');
    }
  };

  const handleCopyMolfile = async () => {
    try {
      const ketcher = await getKetcher();
      const molfile = await ketcher.getMolfile();
      if (molfile) {
        await navigator.clipboard.writeText(molfile);
        showToast('Molfile 已复制', 'success');
      } else {
        showToast('未绘制任何结构', 'error');
      }
    } catch (err) {
      showToast('Error: ' + String(err), 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    window.focus();
    await new Promise((r) => setTimeout(r, 30));
    try {
      const ketcher = await getKetcher();
      const smiles: string = await ketcher.getSmiles();
      const molfile: string = await ketcher.getMolfile();

      const syncInfo = smiles ? analyzeSmilesSync(smiles) : null;
      let name = '';

      // 通过 PubChem 查询化合物名，最多等待 3 秒
      if (smiles) {
        try {
          const nameResult = await Promise.race([
            analyzeSmiles(smiles),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
          ]);
          name = nameResult.name || '';
        } catch { /* timeout or network error, ignore */ }
      }

      const result = {
        smiles,
        molfile,
        formula: syncInfo?.formula || '',
        molecularWeight: syncInfo?.molecularWeight || 0,
        name,
      };

      if (onSave) {
        onSave(result);
      } else {
        (window as any).__structureDrawResult = result;
        showToast('结构式已保存', 'success');
        navigate(-1);
      }
    } catch (err) {
      showToast('保存失败: ' + String(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    navigate(-1);
  };

  const handleClear = async () => {
    setClearConfirmOpen(true);
  };

  const confirmClear = () => {
    // 对于复杂结构, setMolecule('') 可能导致 Ketcher 内部卡死。
    // 直接重载 iframe 更可靠, 避免整个界面变成白屏。
    setInfo(null);
    setLoading(true);
    setClearConfirmOpen(false);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-lg py-sm bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-sm">
          <button onClick={handleCancel} className="btn-ghost text-label">
            ← 返回
          </button>
          <div className="w-px h-6 bg-gray-200 mx-sm" />
          <button onClick={handleClear} className="btn-ghost text-label text-red-500">
            清空
          </button>
          <div className="w-px h-6 bg-gray-200 mx-sm" />
          <button onClick={handleCopySmiles} className="btn-ghost text-label">
            复制 SMILES
          </button>
          <button onClick={handleCopyMolfile} className="btn-ghost text-label">
            复制 Molfile
          </button>
          <button onClick={refreshInfo} className="btn-ghost text-label">
            刷新信息
          </button>
        </div>
        <div className="flex items-center gap-sm">
          <button onClick={handleCancel} className="btn-secondary text-label">
            取消
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-label">
            {saving ? '保存中...' : '确认并插入'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Ketcher iframe */}
        <div className="flex-1 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center">
                <p className="text-gray-400 mb-sm">加载 Ketcher 编辑器...</p>
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src="./ketcher/index.html"
            className="w-full h-full border-0"
            title="Ketcher Structure Editor"
            onLoad={handleIframeLoad}
          />
        </div>

        {/* Info panel */}
        <div className="w-56 bg-white border-l border-gray-200 flex flex-col shrink-0 p-md">
          <h3 className="text-caption font-medium text-gray-500 mb-md">分子信息</h3>
          {info ? (
            <div className="space-y-sm">
              <div>
                <label className="text-[10px] text-gray-400">SMILES</label>
                <p className="text-xs font-mono text-gray-700 break-all">{info.smiles}</p>
              </div>
              <div>
                <label className="text-[10px] text-gray-400">分子式</label>
                <p className="text-sm font-semibold text-gray-800">{info.formula || '-'}</p>
              </div>
              <div>
                <label className="text-[10px] text-gray-400">分子量</label>
                <p className="text-sm text-gray-700">{info.molecularWeight > 0 ? info.molecularWeight.toFixed(2) + ' g/mol' : '-'}</p>
              </div>
              <div>
                <label className="text-[10px] text-gray-400">名称 (PubChem)</label>
                <p className="text-xs text-gray-600">{info.name || '查询中...'}</p>
              </div>
            </div>
          ) : (
            <p className="text-caption text-gray-400">绘制结构式后点击"刷新信息"</p>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <ConfirmDialog
        open={clearConfirmOpen}
        title="清空画布"
        message="确定清空画布？"
        danger
        confirmText="清空"
        onConfirm={confirmClear}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </div>
  );
}
