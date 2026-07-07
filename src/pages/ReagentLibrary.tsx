import { useState, useEffect, useRef, lazy, Suspense, type ClipboardEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Reagent } from '../types';
import StructureImage, { isSmilesLike } from '../components/StructureImage';

const StructureDraw = lazy(() => import('./StructureDraw'));

export default function ReagentLibrary() {
  const [reagents, setReagents] = useState<Reagent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Structure draw modal state
  const [showStructureDraw, setShowStructureDraw] = useState(false);

  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [molecularWeight, setMolecularWeight] = useState('');
  const [molecularFormula, setMolecularFormula] = useState('');
  const [structureImage, setStructureImage] = useState('');

  const api = (window as any).labnote;
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const list = await api.reagents.list();
    setReagents(list);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setAbbreviation('');
    setMolecularWeight('');
    setMolecularFormula('');
    setStructureImage('');
    setShowForm(true);
  };

  const openEdit = (r: Reagent) => {
    setEditingId(r.id);
    setName(r.name);
    setAbbreviation(r.abbreviation || '');
    setMolecularWeight(r.molecular_weight != null ? String(r.molecular_weight) : '');
    setMolecularFormula(r.molecular_formula || '');
    setStructureImage(r.structure_image || '');
    setShowForm(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      abbreviation: abbreviation.trim(),
      molecular_weight: molecularWeight ? parseFloat(molecularWeight) : undefined,
      molecular_formula: molecularFormula.trim(),
      structure_image: structureImage.trim() || undefined,
    };
    if (editingId) {
      await api.reagents.update(editingId, data);
    } else {
      await api.reagents.create(data);
    }
    setShowForm(false);
    load();
  };

  const saveImage = async (dataUrl: string): Promise<string> => {
    try {
      return await api.images.save(dataUrl);
    } catch {
      return dataUrl;
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const filename = await saveImage(reader.result as string);
      setStructureImage(filename);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = async () => {
            const filename = await saveImage(reader.result as string);
            setStructureImage(filename);
          };
          reader.readAsDataURL(blob);
        }
        return;
      }
    }
  };

  const getImageSrc = (value: string): string => {
    if (value.startsWith('data:') || value.startsWith('labnote:') || value.startsWith('http:')) return value;
    return `labnote://images/${value}`;
  };

  const remove = async (id: number) => {
    if (!confirm('确认删除该试剂？')) return;
    await api.reagents.delete(id);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">试剂库</h1>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + 新建试剂
        </button>
      </div>

      {/* Reagent table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-[180px]">名称</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-[100px]">简称</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-[100px]">分子量</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-[160px]">分子式</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">结构式</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 w-[120px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {reagents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  尚未录入试剂，点击"新建试剂"开始
                </td>
              </tr>
            ) : (
              reagents.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.abbreviation || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.molecular_weight != null ? r.molecular_weight.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono">{r.molecular_formula || '-'}</td>
                  <td className="px-4 py-3">
                    {r.structure_image ? (
                      isSmilesLike(r.structure_image) ? (
                        <StructureImage smiles={r.structure_image} width={120} height={48} />
                      ) : (
                        <img
                          src={getImageSrc(r.structure_image)}
                          alt={r.name}
                          className="max-h-12 object-contain rounded border border-slate-200"
                        />
                      )
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-blue-600 hover:text-blue-800 mr-3 text-xs"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[520px] p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editingId ? '编辑试剂' : '新建试剂'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">名称 *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="如：对甲苯磺酸"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">简称</label>
                  <input
                    value={abbreviation}
                    onChange={(e) => setAbbreviation(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="如：PTSA"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">分子量 (MW)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={molecularWeight}
                    onChange={(e) => setMolecularWeight(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="如：172.20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">分子式</label>
                <input
                  value={molecularFormula}
                  onChange={(e) => setMolecularFormula(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="如：C7H8O3S"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">结构式</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStructureDraw(true);
                    }}
                    className="text-xs px-2 py-0.5 rounded border border-blue-400 text-blue-600 hover:bg-blue-50"
                  >
                    {isSmilesLike(structureImage) ? '编辑结构式' : '绘制结构式'}
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/gif, image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div
                  className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
                  onPaste={handlePaste}
                  onClick={() => { if (!isSmilesLike(structureImage)) fileInputRef.current?.click(); }}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isSmilesLike(structureImage)) fileInputRef.current?.click(); }}
                >
                  {structureImage ? (
                    isSmilesLike(structureImage) ? (
                      <div className="flex flex-col items-center gap-2">
                        <StructureImage smiles={structureImage} width={240} height={120} />
                        {(molecularFormula || molecularWeight) && (
                          <div className="flex items-center justify-center gap-3 text-xs text-blue-500">
                            {molecularFormula && <span>分子式: <strong>{molecularFormula}</strong></span>}
                            {molecularWeight && <span>MW: <strong>{parseFloat(molecularWeight).toFixed(2)}</strong></span>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <img
                        src={getImageSrc(structureImage)}
                        alt="预览"
                        className="max-h-32 mx-auto object-contain rounded"
                      />
                    )
                  ) : (
                    <div>
                      <p className="text-sm text-slate-500">点击选择图片，或 Ctrl+V 粘贴</p>
                      <p className="text-xs text-slate-400 mt-1">支持 PNG / JPEG / GIF / WebP</p>
                    </div>
                  )}
                </div>
                {structureImage && (
                  <div className="flex gap-2 mt-2">
                    <input
                      value={structureImage}
                      onChange={(e) => setStructureImage(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="图片标识"
                      readOnly
                    />
                    <button
                      onClick={() => setStructureImage('')}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-red-500 hover:bg-red-50"
                    >
                      清除
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                取消
              </button>
              <button
                onClick={save}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Structure Draw Modal */}
      {showStructureDraw && (
        <Suspense fallback={<div className="fixed inset-0 z-[100] flex items-center justify-center bg-white"><p className="text-gray-400">加载编辑器...</p></div>}>
          <div className="fixed inset-0 z-[100]">
            <StructureDraw
              initialSmiles={structureImage}
              onSave={(result) => {
                setStructureImage(result.smiles || '');
                if (result.formula) setMolecularFormula(result.formula);
                if (result.molecularWeight) setMolecularWeight(String(result.molecularWeight));
                if (result.name && !name) setName(result.name);
                setShowStructureDraw(false);
              }}
              onCancel={() => setShowStructureDraw(false)}
            />
          </div>
        </Suspense>
      )}
    </div>
  );
}