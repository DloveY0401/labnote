import { useEffect, useState, useCallback, useRef, lazy, Suspense, type ClipboardEvent, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactantTable from '../components/ReactantTable';
import CatalystForm from '../components/CatalystForm';
import SolventForm from '../components/SolventForm';
import TagSelector from '../components/TagSelector';
import StructureImage from '../components/StructureImage';
import SectionHeader from '../modules/SectionHeader';
import CustomModuleForm from '../modules/CustomModuleForm';
import ModulePicker from '../modules/ModulePicker';
import ModuleTemplateEditor from '../modules/ModuleTemplateEditor';
import LinkedTasks from '../components/LinkedTasks';
import { useToast, ToastContainer } from '../components/Toast';
import {
  getExperiment, createExperiment, updateExperiment,
  getProjects, getTags, createTemplate, updateTemplate,
  deleteModuleTemplate,
} from '../db/queries';
import type {
  ExperimentDetail, Project, Tag, Reactant, Catalyst, Solvent, Reagent,
  ModuleTemplate, ModuleLayoutItem, ExperimentModuleData,
} from '../types';
import {
  STANDARD_MODULES, DEFAULT_LAYOUT, parseModuleLayout,
  getHiddenStandardKeys, getActiveCustomKeys,
} from '../modules/registry';
import {
  getAllTemplates, loadCustomTemplates, saveCustomTemplates,
  type TemplateEntry, type TemplateId, type CustomTemplate, type ExportData,
} from '../utils/exportTemplates';

const StructureDraw = lazy(() => import('./StructureDraw'));

interface FormData {
  title: string;
  subtitle: string;
  project_id: number | null;
  date: string;
  container: string;
  temperature: string;
  time: string;
  pressure: string;
  ph: string;
  stirring: string;
  atmosphere: string;
  procedure: string;
  workup: string;
  yield_val: number | null;
  yield_unit: string;
  morphology: string;
  notes: string;
  result_images: string | null;
  structure_image: string | null;
}

const emptyForm: FormData = {
  title: '',
  subtitle: '',
  project_id: null,
  date: new Date().toISOString().slice(0, 10),
  container: '', temperature: '', time: '', pressure: '', ph: '', stirring: '', atmosphere: '',
  procedure: '', workup: '', yield_val: null, yield_unit: '%', morphology: '', notes: '',
  result_images: null,
  structure_image: null,
};

export default function ExperimentEdit() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const editTemplateId = searchParams.get('edit_template');
  const isEditingTemplate = !!editTemplateId;

  // ── Core state ──
  const [form, setForm] = useState<FormData>(emptyForm);
  const [reactants, setReactants] = useState<Reactant[]>([]);
  const [catalysts, setCatalysts] = useState<Catalyst[]>([]);
  const [solvents, setSolvents] = useState<Solvent[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Module system state ──
  const [moduleLayout, setModuleLayout] = useState<ModuleLayoutItem[]>(DEFAULT_LAYOUT);
  const [customModuleData, setCustomModuleData] = useState<Record<string, Record<string, any>>>({});
  const [moduleTemplates, setModuleTemplates] = useState<ModuleTemplate[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // ── Export/template state ──
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportedText, setExportedText] = useState('');
  const [exportedData, setExportedData] = useState<ExportData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportTemplateId, setExportTemplateId] = useState<TemplateId>('acs');
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => loadCustomTemplates());
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [tmEditIdx, setTmEditIdx] = useState<number | null>(null);
  const [tmEditName, setTmEditName] = useState('');
  const [tmEditTemplate, setTmEditTemplate] = useState('');
  const [tmAdding, setTmAdding] = useState(false);

  // ── Reagent picker ──
  const [reagents, setReagents] = useState<Reagent[]>([]);
  const [showReagentPicker, setShowReagentPicker] = useState(false);
  const [reagentTarget, setReagentTarget] = useState<'reactant' | 'catalyst' | 'solvent'>('reactant');

  // ── Module dialogs ──
  const [showModulePicker, setShowModulePicker] = useState(false);

  // Structure draw modal
  const [showStructureDraw, setShowStructureDraw] = useState(false);
  const [structureInitialSmiles, setStructureInitialSmiles] = useState('');
  const structureSaveRef = useRef<((result: any) => void) | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  const { toasts, showToast, removeToast } = useToast();

  // ── Image helpers ──

  const saveResultImage = async (dataUrl: string): Promise<string> => {
    try {
      return await (window as any).labnote.images.save(dataUrl);
    } catch {
      return dataUrl;
    }
  };

  const getResultImageSrc = (value: string): string => {
    if (value.startsWith('data:') || value.startsWith('labnote:') || value.startsWith('http:')) return value;
    return `labnote://images/${value}`;
  };

  const getResultImages = (): string[] => {
    if (!form.result_images) return [];
    try { return JSON.parse(form.result_images); } catch { return []; }
  };

  const addResultImage = async (dataUrl: string) => {
    const filename = await saveResultImage(dataUrl);
    const imgs = [...getResultImages(), filename];
    updateField('result_images', JSON.stringify(imgs));
  };

  const removeResultImage = (index: number) => {
    const imgs = getResultImages();
    imgs.splice(index, 1);
    updateField('result_images', imgs.length ? JSON.stringify(imgs) : null);
  };

  const handleResultPaste = (e: ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => addResultImage(reader.result as string);
          reader.readAsDataURL(blob);
          return;
        }
      }
    }
  };

  const handleResultFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => addResultImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Module helpers ──

  const isModuleVisible = (key: string): boolean => {
    return moduleLayout.some((item) => item.key === key);
  };

  const toggleCollapse = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hideModule = (key: string) => {
    setModuleLayout((prev) => prev.filter((item) => item.key !== key));
    // Clean up custom module data
    if (key.startsWith('custom:')) {
      setCustomModuleData((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const addStandardModule = (key: string) => {
    setModuleLayout((prev) => {
      if (prev.some((item) => item.key === key)) return prev;
      return [...prev, { key, type: 'standard' }];
    });
    setShowModulePicker(false);
  };

  const addCustomModule = (templateId: number) => {
    const key = `custom:${templateId}`;
    setModuleLayout((prev) => {
      if (prev.some((item) => item.key === key)) return prev;
      return [...prev, { key, type: 'custom' }];
    });
    setCustomModuleData((prev) => ({
      ...prev,
      [key]: prev[key] || {},
    }));
    setShowModulePicker(false);
  };

  // ── Drag and drop ──
  const dragIdxRef = useRef(-1);

  const handleDragStart = (e: DragEvent, index: number) => {
    dragIdxRef.current = index;
    // native DragEvent may be nested inside React synthetic event
    const dt = (e as any).nativeEvent?.dataTransfer || e.dataTransfer;
    dt.effectAllowed = 'move';
    dt.setData('text/plain', String(index));
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    const dt = (e as any).nativeEvent?.dataTransfer || e.dataTransfer;
    dt.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    const dt = (e as any).nativeEvent?.dataTransfer || e.dataTransfer;
    const raw = dt.getData('text/plain');
    let sourceIdx = parseInt(raw, 10);
    // fallback to ref if dataTransfer failed (some Electron Chromium builds have issues)
    if (isNaN(sourceIdx)) sourceIdx = dragIdxRef.current;
    if (sourceIdx < 0 || sourceIdx === targetIndex) return;
    dragIdxRef.current = -1;
    setModuleLayout((prev) => {
      const next = [...prev];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  // ── Load data ──

  const loadData = useCallback(async () => {
    try {
      const [projs, tgs, rgs, modTmpls] = await Promise.all([
        getProjects(),
        getTags('experiment'),
        (window as any).labnote.reagents.list(),
        (window as any).labnote.modules.templates.list(),
      ]);
      setProjects(projs);
      setTags(tgs);
      setReagents(rgs);
      setModuleTemplates(modTmpls.map((t: any) => ({
        ...t,
        fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields,
        is_preset: !!t.is_preset,
      })));

      if (!isNew) {
        const exp = await getExperiment(Number(id));
        if (exp) {
          setForm({
            title: exp.title,
            subtitle: exp.subtitle || '',
            project_id: exp.project_id, date: exp.date,
            container: exp.container || '', temperature: exp.temperature || '',
            time: exp.time || '', pressure: exp.pressure || '', ph: exp.ph || '',
            stirring: exp.stirring || '', atmosphere: exp.atmosphere || '',
            procedure: exp.procedure || '', workup: exp.workup || '',
            yield_val: exp.yield_val, yield_unit: exp.yield_unit || '%',
            morphology: exp.morphology || '', notes: exp.notes || '',
            result_images: exp.result_images || null,
            structure_image: exp.structure_image || null,
          });
          setReactants(exp.reactants.length ? exp.reactants : [{ name: '', formula: '', amount: null, amount_unit: 'g', equiv: null, role: '' }]);
          setCatalysts(exp.catalysts || []);
          setSolvents(exp.solvents || []);
          setTagIds((exp.tags || []).map((t) => t.id));

          // Load module layout
          const layout = parseModuleLayout(exp.module_layout);
          setModuleLayout(layout);

          // Load custom module data
          if (exp.custom_modules?.length) {
            const dataMap: Record<string, Record<string, any>> = {};
            exp.custom_modules.forEach((m: ExperimentModuleData) => {
              dataMap[m.module_key] = typeof m.data === 'string' ? JSON.parse(m.data as any) : m.data;
            });
            setCustomModuleData(dataMap);
          }
        }
      } else {
        setForm(emptyForm);
        setReactants([{ name: '', formula: '', amount: null, amount_unit: 'g', equiv: null, role: '' }]);
        setCatalysts([]);
        setSolvents([]);
        setTagIds([]);
        setErrors({});
        setModuleLayout(DEFAULT_LAYOUT);
        setCustomModuleData({});

        // Check for template prefill
        const templateId = searchParams.get('template');
        if (templateId) {
          try {
            const tmpl = await window.labnote.templates.get(Number(templateId));
            if (tmpl) {
              const data = JSON.parse(tmpl.template_data);
              setForm((f) => ({
                ...f,
                ...data.form,
                // Use template name/subtitle when editing a template
                ...(isEditingTemplate ? {
                  title: tmpl.name || '',
                  subtitle: tmpl.description || '',
                } : {}),
              }));
              if (data.catalysts?.length) setCatalysts(data.catalysts);
              if (data.solvents?.length) setSolvents(data.solvents);
              if (data.tag_ids?.length) setTagIds(data.tag_ids);
              // Restore module layout and custom modules data
              if (data.module_layout) {
                setModuleLayout(parseModuleLayout(
                  typeof data.module_layout === 'string'
                    ? data.module_layout
                    : JSON.stringify(data.module_layout)
                ));
              }
              if (data.custom_modules_data) {
                setCustomModuleData(data.custom_modules_data);
              }
              await window.labnote.templates.incrementUsage(Number(templateId));
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, isNew, searchParams]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Form helpers ──

  const updateField = (field: keyof FormData, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = '请输入实验标题';
    if (!form.date) errs.date = '请选择日期';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildPayload = () => ({
    ...form,
    reactants: reactants.filter((r) => r.name.trim()),
    catalysts: catalysts.filter((c) => c.name.trim()),
    solvents: solvents.filter((s) => s.name.trim()),
    tag_ids: tagIds,
    result_images: form.result_images,
    module_layout: moduleLayout,
    custom_modules: Object.entries(customModuleData)
      .filter(([, data]) => data && Object.keys(data).length > 0)
      .map(([key, data]) => ({ module_key: key, data })),
  });

  // ── Save ──

  const handleSave = async () => {
    if (!validate()) {
      console.log('[LabNote] Validation failed, not saving');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEditingTemplate) {
        // Update existing template
        await updateTemplate(Number(editTemplateId), {
          name: form.title || '未命名模板',
          description: payload.subtitle || undefined,
          template_data: JSON.stringify({
            form: {
              container: payload.container,
              temperature: payload.temperature,
              time: payload.time,
              pressure: payload.pressure,
              ph: payload.ph,
              stirring: payload.stirring,
              atmosphere: payload.atmosphere,
              procedure: payload.procedure,
              workup: payload.workup,
              yield_unit: payload.yield_unit,
            },
            catalysts: payload.catalysts,
            solvents: payload.solvents,
            tag_ids: payload.tag_ids,
            module_layout: payload.module_layout,
            custom_modules_data: Object.fromEntries(
              (payload.custom_modules || []).map((m: any) => [m.module_key, m.data])
            ),
          }),
        });
        console.log('[LabNote] Template updated, id:', editTemplateId);
        showToast('模板更新成功', 'success');
        navigate('/templates', { replace: true });
      } else if (isNew) {
        const newId = await createExperiment(payload);
        console.log('[LabNote] Experiment created, id:', newId);
        navigate(`/experiments/${newId}`, { replace: true });
      } else {
        await updateExperiment(Number(id), payload);
        console.log('[LabNote] Experiment updated, id:', id);
      }
      showToast('保存成功', 'success');
    } catch (err) {
      console.error('[LabNote] Save experiment failed:', err);
      showToast('保存失败: ' + String(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Template ──

  const handleSaveAsTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    try {
      await createTemplate({
        name,
        description: `基于实验「${form.title || '未命名'}」`,
        template_data: JSON.stringify({
          form: {
            container: form.container,
            temperature: form.temperature,
            time: form.time,
            pressure: form.pressure,
            ph: form.ph,
            stirring: form.stirring,
            atmosphere: form.atmosphere,
            procedure: form.procedure,
            workup: form.workup,
            yield_unit: form.yield_unit,
            structure_image: form.structure_image,
          },
          catalysts: catalysts.filter((c) => c.name.trim()),
          solvents: solvents.filter((s) => s.name.trim()),
          tag_ids: tagIds,
          module_layout: moduleLayout,
          custom_modules_data: Object.entries(customModuleData).reduce(
            (acc, [key, data]) => {
              if (data && Object.keys(data).length > 0) {
                acc[key] = data;
              }
              return acc;
            },
            {} as Record<string, Record<string, any>>
          ),
        }),
      });
      setShowTemplateDialog(false);
      setTemplateName('');
      showToast('模板保存成功', 'success');
    } catch (err) {
      showToast('保存模板失败: ' + String(err), 'error');
    }
  };

  // ── Export ──

  const handleExport = async () => {
    setExporting(true);
    try {
      let expId = Number(id);
      if (isNew) {
        if (!validate()) { setExporting(false); return; }
        expId = await createExperiment(buildPayload());
        navigate(`/experiments/${expId}`, { replace: true });
      }
      const data: ExportData = await (window as any).labnote.experiments.exportData(expId);
      if (!data) { setExportedText(''); setExportedData(null); setShowExportDialog(true); return; }
      setExportedData(data);
      const allTmpl = getAllTemplates(customTemplates);
      const tmpl = allTmpl.find((t) => t.id === exportTemplateId);
      if (tmpl) {
        setExportedText(tmpl.format(data));
      } else {
        setExportedText('');
      }
      setShowExportDialog(true);
    } catch (err) {
      showToast('导出失败: ' + String(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  // ── Reagent picker ──

  const pickReagent = (r: Reagent) => {
    if (reagentTarget === 'reactant') {
      setReactants([...reactants, {
        name: r.name, formula: r.molecular_formula || '', amount: null, amount_unit: 'g', equiv: null,
        role: '', structure_image: r.structure_image || null,
        molecular_weight: r.molecular_weight, molar_amount: null,
      }]);
    } else if (reagentTarget === 'catalyst') {
      setCatalysts([...catalysts, {
        name: r.name, amount: null, amount_unit: 'g',
        molecular_weight: r.molecular_weight, molar_amount: null,
      }]);
    } else if (reagentTarget === 'solvent') {
      setSolvents([...solvents, {
        name: r.name, volume: null, volume_unit: 'mL', ratio: '',
      }]);
    }
    setShowReagentPicker(false);
  };

  // ── Create custom module template ──

  const handleCreateModuleTemplate = async (data: { name: string; description: string; fields: string }) => {
    try {
      await (window as any).labnote.modules.templates.create(data);
      const tmpls = await (window as any).labnote.modules.templates.list();
      setModuleTemplates(tmpls.map((t: any) => ({
        ...t,
        fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields,
        is_preset: !!t.is_preset,
      })));
      setShowTemplateEditor(false);
      showToast('自定义模块模板已创建', 'success');
    } catch (err) {
      showToast('创建失败: ' + String(err), 'error');
    }
  };

  const handleDeleteModuleTemplate = async (templateId: number) => {
    try {
      await deleteModuleTemplate(templateId);
      // Remove from local state
      setModuleTemplates((prev) => prev.filter((t) => t.id !== templateId));
      // Also remove from current module layout if it was used
      const key = `custom:${templateId}`;
      setModuleLayout((prev) => prev.filter((item) => item.key !== key));
      setCustomModuleData((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      showToast('模块模板已删除', 'success');
    } catch (err) {
      showToast('删除失败: ' + String(err), 'error');
    }
  };

  // ── Render helpers ──

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">加载中...</p></div>;
  }

  /** Render a single module section by its layout item */
  const renderModule = (item: ModuleLayoutItem, index: number) => {
    const collapsed = collapsedSections.has(item.key);

    let sectionContent: React.ReactNode = null;
    let sectionTitle = '';
    let canHide = true;

    if (item.type === 'standard') {
      const def = STANDARD_MODULES[item.key];
      if (!def) return null;
      sectionTitle = def.name;
      canHide = !def.required;

      switch (item.key) {
        case 'basic_info':
          sectionContent = (
            <div className="grid grid-cols-3 gap-md">
              {/* Left column (1/3): basic info fields */}
              <div className="col-span-1 space-y-md">
                <div>
                  <label className="block text-caption text-gray-500 mb-xs">实验标题 *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="如: Suzuki 偶联反应"
                    className={`input-field ${errors.title ? '!border-red-500' : ''}`}
                  />
                  {errors.title && <p className="text-red-500 text-caption mt-xs">{errors.title}</p>}
                </div>
                <div>
                  <label className="block text-caption text-gray-500 mb-xs">小标题</label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => updateField('subtitle', e.target.value)}
                    placeholder="如：第一步"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-caption text-gray-500 mb-xs">日期 *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => updateField('date', e.target.value)}
                    className={`input-field ${errors.date ? '!border-red-500' : ''}`}
                  />
                  {errors.date && <p className="text-red-500 text-caption mt-xs">{errors.date}</p>}
                </div>
                <div>
                  <label className="block text-caption text-gray-500 mb-xs">所属课题</label>
                  <select
                    value={form.project_id ?? ''}
                    onChange={(e) => updateField('project_id', e.target.value ? Number(e.target.value) : null)}
                    className="select-field"
                  >
                    <option value="">无</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right column (2/3): structure drawing */}
              <div className="col-span-2 flex flex-col">
                <label className="block text-caption text-gray-500 mb-xs">结构式 (绘制后名称自动填入标题)</label>
                {form.structure_image ? (
                  <div className="flex-1 relative border border-gray-200 rounded-lg bg-gray-50 p-md flex flex-col items-center justify-center min-h-[180px]">
                    <StructureImage smiles={form.structure_image} width={320} height={160} />
                    <div className="flex items-center gap-sm mt-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setStructureInitialSmiles(form.structure_image || '');
                          structureSaveRef.current = (result: any) => {
                            updateField('structure_image', result.smiles || null);
                            if (result.name && !form.title) updateField('title', result.name);
                          };
                          setShowStructureDraw(true);
                        }}
                        className="text-xs px-2 py-0.5 rounded border border-blue-400 text-blue-600 hover:bg-blue-50"
                      >
                        编辑结构式
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('structure_image', null)}
                        className="text-xs px-2 py-0.5 rounded border border-red-300 text-red-500 hover:bg-red-50"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setStructureInitialSmiles('');
                      structureSaveRef.current = (result: any) => {
                        updateField('structure_image', result.smiles || null);
                        if (result.name && !form.title) updateField('title', result.name);
                      };
                      setShowStructureDraw(true);
                    }}
                    className="flex-1 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-sm min-h-[180px]"
                  >
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span className="text-sm text-gray-500">点击绘制反应结构式</span>
                    <span className="text-xs text-gray-400">化合物名称将自动填入实验标题</span>
                  </button>
                )}
              </div>
            </div>
          );
          break;

        case 'conditions':
          sectionContent = (
            <div className="grid grid-cols-4 gap-md">
              {([
                ['container', '容器'],
                ['temperature', '温度'],
                ['time', '时间'],
                ['atmosphere', '保护气氛'],
                ['stirring', '搅拌方式'],
                ['pressure', '压力'],
                ['ph', 'pH'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-caption text-gray-500 mb-xs">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    placeholder={label}
                    className="input-field"
                  />
                </div>
              ))}
            </div>
          );
          break;

        case 'reactants':
          sectionContent = (
            <div>
              <div className="flex justify-end mb-sm">
                <button
                  type="button"
                  onClick={() => { setReagentTarget('reactant'); setShowReagentPicker(true); }}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1 hover:bg-blue-50 transition"
                >
                  从试剂库选择
                </button>
              </div>
              <ReactantTable
                reactants={reactants}
                onChange={setReactants}
                onOpenStructureDraw={(index) => {
                  const currentSmiles = reactants[index]?.structure_image || '';
                  setStructureInitialSmiles(currentSmiles);
                  structureSaveRef.current = (result: any) => {
                    setReactants((prev) => prev.map((r, i) => i === index ? {
                      ...r,
                      structure_image: result.smiles || null,
                      formula: result.formula || r.formula,
                      molecular_weight: result.molecularWeight || r.molecular_weight,
                      name: r.name || result.name || '',
                    } : r));
                  };
                  setShowStructureDraw(true);
                }}
              />
            </div>
          );
          break;

        case 'catalysts':
          sectionContent = (
            <div>
              <div className="flex justify-end mb-sm">
                <button
                  type="button"
                  onClick={() => { setReagentTarget('catalyst'); setShowReagentPicker(true); }}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1 hover:bg-blue-50 transition"
                >
                  从试剂库选择
                </button>
              </div>
              <CatalystForm catalysts={catalysts} onChange={setCatalysts} />
            </div>
          );
          break;

        case 'solvents':
          sectionContent = (
            <div>
              <div className="flex justify-end mb-sm">
                <button
                  type="button"
                  onClick={() => { setReagentTarget('solvent'); setShowReagentPicker(true); }}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1 hover:bg-blue-50 transition"
                >
                  从试剂库选择
                </button>
              </div>
              <SolventForm solvents={solvents} onChange={setSolvents} />
            </div>
          );
          break;

        case 'procedure':
          sectionContent = (
            <textarea
              value={form.procedure}
              onChange={(e) => updateField('procedure', e.target.value)}
              placeholder="描述实验操作步骤..."
              rows={6}
              className="input-field resize-y"
            />
          );
          break;

        case 'workup':
          sectionContent = (
            <textarea
              value={form.workup}
              onChange={(e) => updateField('workup', e.target.value)}
              placeholder="描述后处理过程..."
              rows={4}
              className="input-field resize-y"
            />
          );
          break;

        case 'results':
          sectionContent = (
            <div>
              <div className="grid grid-cols-3 gap-md mb-lg">
                <div>
                  <label className="block text-caption text-gray-500 mb-xs">产率</label>
                  <div className="flex items-center gap-sm">
                    <input
                      type="number" step="any"
                      value={form.yield_val ?? ''}
                      onChange={(e) => updateField('yield_val', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0" className="input-field w-[100px]"
                    />
                    <span className="text-body text-gray-500">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-caption text-gray-500 mb-xs">形态</label>
                  <input
                    type="text" value={form.morphology}
                    onChange={(e) => updateField('morphology', e.target.value)}
                    placeholder="如: 白色晶体" className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-caption text-gray-500 mb-xs">备注</label>
                  <input
                    type="text" value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="其他观察结果" className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-caption text-gray-500 mb-xs">实验图片（TLC / 光谱 / 产物照片等，支持粘贴和上传）</label>
                <div
                  className="border border-dashed border-gray-300 rounded-lg p-md min-h-[80px] flex flex-wrap gap-sm items-start hover:border-primary-400 transition-colors"
                  onPaste={handleResultPaste}
                >
                  {getResultImages().map((storedVal, idx) => {
                    const imgSrc = getResultImageSrc(storedVal);
                    return (
                      <div key={idx} className="relative group">
                        <img
                          src={imgSrc} alt={`结果图 ${idx + 1}`}
                          className="h-24 w-auto object-contain border border-gray-200 rounded"
                          onDoubleClick={() => {
                            const w = window.open('', '_blank');
                            if (w) w.document.write(`<img src="${imgSrc}" style="max-width:100%;height:auto" />`);
                          }}
                        />
                        <button
                          type="button" onClick={() => removeResultImage(idx)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none
                                     opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >×</button>
                      </div>
                    );
                  })}
                  <label className="flex items-center justify-center border border-dashed border-gray-300 rounded
                                  w-24 h-24 cursor-pointer hover:border-primary-400 hover:text-primary-500 text-gray-400 transition-colors">
                    <div className="flex flex-col items-center gap-xs">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-[10px]">添加图片</span>
                    </div>
                    <input type="file" accept="image/*" onChange={handleResultFileSelect} className="hidden" />
                  </label>
                </div>
                <p className="text-caption text-gray-400 mt-xs">提示：从 ChemDraw 复制结构式后在此 Ctrl+V 粘贴。支持 PNG / JPG / GIF。</p>
              </div>
            </div>
          );
          break;

        case 'tags':
          sectionContent = (
            <TagSelector
              selectedIds={tagIds}
              allTags={tags}
              onChange={setTagIds}
              onTagsRefresh={async () => { setTags(await getTags('experiment')); }}
            />
          );
          break;

        default:
          return null;
      }
    } else if (item.type === 'custom') {
      const template = moduleTemplates.find((t) => `custom:${t.id}` === item.key);
      if (!template) return null;
      sectionTitle = template.name;
      const data = customModuleData[item.key] || {};
      const moduleKey = item.key;
      sectionContent = (
        <div key={moduleKey}>
          <CustomModuleForm
            template={template}
            data={data}
            onChange={(newData) => {
              setCustomModuleData((prev) => ({ ...prev, [moduleKey]: newData }));
            }}
            saveImage={saveResultImage}
            onOpenStructureDraw={(fieldKey, setResult) => {
              const currentData = customModuleData[moduleKey] || {};
              setStructureInitialSmiles(currentData[fieldKey]?.smiles || '');
              structureSaveRef.current = (result: any) => {
                setCustomModuleData((prev) => ({
                  ...prev,
                  [moduleKey]: { ...(prev[moduleKey] || {}), [fieldKey]: result },
                }));
              };
              setShowStructureDraw(true);
            }}
          />
        </div>
      );
    }

    return (
      <section key={item.key} className={`card p-lg mb-lg`}>
        <SectionHeader
          title={sectionTitle}
          collapsed={collapsed}
          onToggleCollapse={() => toggleCollapse(item.key)}
          canHide={canHide}
          onHide={() => hideModule(item.key)}
          dragHandle
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
        />
        {!collapsed && sectionContent}
      </section>
    );
  };

  return (
    <div className="pb-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-lg sticky top-0 bg-gray-50 py-sm z-10">
        <div className="flex items-center gap-md">
          <button onClick={() => navigate(isEditingTemplate ? '/templates' : -1)} className="btn-ghost p-xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-h1">{isEditingTemplate ? '编辑模板' : isNew ? '新建实验' : '编辑实验'}</h1>
        </div>
        <div className="flex items-center gap-sm">
          {!isEditingTemplate && (
            <button type="button" onClick={handleExport} disabled={exporting} className="btn-secondary text-label">
              {exporting ? '导出中...' : '导出实验细节'}
            </button>
          )}
          {!isEditingTemplate && (
            <button type="button" onClick={() => setShowTemplateDialog(true)} className="btn-secondary text-label" disabled={!form.title.trim()}>
              保存为模板
            </button>
          )}
          <button type="button" onClick={() => navigate(isEditingTemplate ? '/templates' : -1)} className="btn-secondary text-label">取消</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* Module sections */}
      {moduleLayout.map((item, index) => renderModule(item, index))}

      {/* Add module button */}
      <button
        type="button"
        onClick={() => setShowModulePicker(true)}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-md text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors flex items-center justify-center gap-sm mb-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-label">添加模块</span>
      </button>

      {/* Bottom save bar */}
      <div className="flex items-center justify-end gap-sm pt-md border-t border-gray-200">
        <button type="button" onClick={() => navigate(isEditingTemplate ? '/templates' : -1)} className="btn-secondary">取消</button>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* Template dialog */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="card p-lg w-[360px]">
            <h3 className="text-h2 mb-md">保存为模板</h3>
            <label className="block text-caption text-gray-500 mb-xs">模板名称</label>
            <input
              type="text" value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="如: Suzuki 偶联标准流程"
              className="input-field mb-md" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveAsTemplate()}
            />
            <div className="flex justify-end gap-sm">
              <button type="button" onClick={() => { setShowTemplateDialog(false); setTemplateName(''); }} className="btn-secondary">取消</button>
              <button type="button" onClick={handleSaveAsTemplate} disabled={!templateName.trim()} className="btn-primary">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* Export dialog */}
      {showExportDialog && (() => {
        const allTmpl = getAllTemplates(customTemplates);
        const handleTemplateChange = (tid: TemplateId) => {
          setExportTemplateId(tid);
          if (exportedData) {
            const t = allTmpl.find((x) => x.id === tid);
            if (t) setExportedText(t.format(exportedData));
          }
        };
        return (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="card p-lg w-[680px] max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between mb-md">
                <h3 className="text-h2">导出实验细节</h3>
                <button type="button" onClick={() => setShowExportDialog(false)} className="btn-ghost p-xs">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-sm mb-sm">
                <label className="text-caption text-gray-500 shrink-0">输出模板</label>
                <select value={exportTemplateId} onChange={(e) => handleTemplateChange(e.target.value as TemplateId)} className="select-field flex-1">
                  {allTmpl.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
                <button type="button" onClick={() => setShowTemplateManager(true)} className="btn-secondary text-label shrink-0">管理自定义模板</button>
              </div>
              <p className="text-caption text-gray-500 mb-sm">以下为期刊风格的实验细节描述，可直接用于论文 Supporting Information。</p>
              <div className="bg-gray-100 rounded-lg p-md overflow-auto flex-1 mb-md max-h-[400px]">
                <pre className="text-body whitespace-pre-wrap font-serif leading-relaxed">{exportedText || '暂无导出内容'}</pre>
              </div>
              <div className="flex justify-end gap-sm">
                <button type="button" onClick={() => setShowExportDialog(false)} className="btn-secondary">关闭</button>
                <button type="button" onClick={() => { navigator.clipboard.writeText(exportedText).then(() => showToast('已复制到剪贴板', 'success')); }} disabled={!exportedText} className="btn-primary">复制到剪贴板</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Template manager dialog */}
      {showTemplateManager && (() => {
        const openNew = () => {
          setTmEditIdx(null); setTmEditName(''); setTmEditTemplate(''); setTmAdding(true);
        };
        const openEdit = (idx: number) => {
          setTmEditIdx(idx); setTmEditName(customTemplates[idx].name); setTmEditTemplate(customTemplates[idx].template); setTmAdding(false);
        };
        const cancelEdit = () => {
          setTmAdding(false); setTmEditIdx(null); setTmEditName(''); setTmEditTemplate('');
        };
        const saveEdit = () => {
          const name = tmEditName.trim(); const tmpl = tmEditTemplate.trim();
          if (!name || !tmpl) return;
          let updated: CustomTemplate[];
          if (tmEditIdx != null) {
            updated = customTemplates.map((t, i) => i === tmEditIdx ? { name, template: tmpl } : t);
          } else {
            updated = [...customTemplates, { name, template: tmpl }];
          }
          setCustomTemplates(updated); saveCustomTemplates(updated); cancelEdit();
        };
        const deleteTemplate = (idx: number) => {
          const updated = customTemplates.filter((_, i) => i !== idx);
          setCustomTemplates(updated); saveCustomTemplates(updated);
          if (exportTemplateId === `custom:${idx}`) setExportTemplateId('acs');
        };
        const inEdit = tmAdding || tmEditIdx != null;
        return (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]">
            <div className="card p-lg w-[560px] max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between mb-md">
                <h3 className="text-h2">管理自定义模板</h3>
                <button type="button" onClick={() => { setShowTemplateManager(false); cancelEdit(); }} className="btn-ghost p-xs">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="overflow-auto flex-1 mb-md">
                {customTemplates.length === 0 && !tmAdding && (
                  <p className="text-caption text-gray-400 text-center py-lg">暂无自定义模板，点击下方按钮创建。</p>
                )}
                {inEdit ? (
                  <div className="space-y-md mb-md">
                    <div>
                      <label className="block text-caption text-gray-500 mb-xs">模板名称</label>
                      <input type="text" value={tmEditName} onChange={(e) => setTmEditName(e.target.value)} placeholder="如: Nature Chemistry Style" className="input-field" autoFocus />
                    </div>
                    <div>
                      <label className="block text-caption text-gray-500 mb-xs">模板内容（使用 {'{{'}占位符{'}}'}）</label>
                      <textarea value={tmEditTemplate} onChange={(e) => setTmEditTemplate(e.target.value)} rows={10} className="input-field resize-y font-mono text-sm" placeholder={`示例:\nSynthesis of {{title}}.\n\n{{all_reagents}} were added to a {{container}}. The mixture was stirred at {{temperature}} for {{time}} under {{atmosphere}}. {{workup}} {{result}}.`} />
                      <p className="text-caption text-gray-400 mt-xs">可用占位符：{'{{'}title{'}}'}, {'{{'}reactants{'}}'}, {'{{'}catalysts{'}}'}, {'{{'}all_reagents{'}}'}, {'{{'}solvents{'}}'}, {'{{'}container{'}}'}, {'{{'}temperature{'}}'}, {'{{'}time{'}}'}, {'{{'}atmosphere{'}}'}, {'{{'}stirring{'}}'}, {'{{'}workup{'}}'}, {'{{'}yield{'}}'}, {'{{'}morphology{'}}'}, {'{{'}result{'}}'}, {'{{'}notes{'}}'}</p>
                    </div>
                    <div className="flex justify-end gap-sm">
                      <button type="button" onClick={cancelEdit} className="btn-secondary">取消</button>
                      <button type="button" onClick={saveEdit} disabled={!tmEditName.trim() || !tmEditTemplate.trim()} className="btn-primary">{tmEditIdx != null ? '保存修改' : '创建模板'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-sm">
                    {customTemplates.map((t, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded p-md">
                        <div className="flex-1 min-w-0">
                          <p className="text-body font-medium truncate">{t.name}</p>
                          <p className="text-caption text-gray-400 truncate">{t.template.slice(0, 80)}{t.template.length > 80 ? '...' : ''}</p>
                        </div>
                        <div className="flex items-center gap-xs ml-md shrink-0">
                          <button type="button" onClick={() => openEdit(i)} className="btn-ghost text-label text-sm">编辑</button>
                          <button type="button" onClick={() => deleteTemplate(i)} className="btn-ghost text-label text-sm text-red-500">删除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!inEdit && (
                <div className="flex justify-end gap-sm">
                  <button type="button" onClick={() => setShowTemplateManager(false)} className="btn-secondary">关闭</button>
                  <button type="button" onClick={openNew} className="btn-primary">新建模板</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Reagent picker dialog */}
      {showReagentPicker && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[640px] max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-lg border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                从试剂库选择 — {reagentTarget === 'reactant' ? '反应物' : reagentTarget === 'catalyst' ? '催化剂' : '溶剂'}
              </h3>
              <button type="button" onClick={() => setShowReagentPicker(false)} className="btn-ghost p-xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-auto p-lg flex-1">
              {reagents.length === 0 ? (
                <p className="text-center text-slate-400 py-8">试剂库为空，请先在"试剂库"页面录入试剂。</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left border-b border-slate-200">
                    <tr>
                      <th className="pb-2 font-medium text-slate-600">名称</th>
                      <th className="pb-2 font-medium text-slate-600">简称</th>
                      <th className="pb-2 font-medium text-slate-600 w-[90px]">分子量</th>
                      <th className="pb-2 font-medium text-slate-600 w-[120px]">分子式</th>
                      <th className="pb-2 font-medium text-slate-600 w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reagents.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition" onClick={() => pickReagent(r)}>
                        <td className="py-2 font-medium text-slate-800">{r.name}</td>
                        <td className="py-2 text-slate-500">{r.abbreviation || '-'}</td>
                        <td className="py-2 text-slate-600">{r.molecular_weight != null ? r.molecular_weight.toFixed(2) : '-'}</td>
                        <td className="py-2 text-slate-600 font-mono">{r.molecular_formula || '-'}</td>
                        <td className="py-2 text-blue-600 text-xs">选择</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module picker dialog */}
      {showModulePicker && (
        <ModulePicker
          hiddenStandardKeys={getHiddenStandardKeys(moduleLayout)}
          availableCustomTemplates={moduleTemplates.filter(
            (t) => !moduleLayout.some((item) => item.key === `custom:${t.id}`)
          )}
          onAddStandard={addStandardModule}
          onAddCustom={addCustomModule}
          onDeleteCustom={handleDeleteModuleTemplate}
          onCreateCustom={() => {
            setShowModulePicker(false);
            setShowTemplateEditor(true);
          }}
          onClose={() => setShowModulePicker(false)}
        />
      )}

      {/* Module template editor dialog */}
      {showTemplateEditor && (
        <ModuleTemplateEditor
          title="创建自定义模块"
          onSave={handleCreateModuleTemplate}
          onClose={() => setShowTemplateEditor(false)}
        />
      )}

      {/* Linked Tasks Section (only for existing experiments) */}
      {!isNew && id && (
        <LinkedTasks experimentId={id} />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Structure Draw Modal */}
      {showStructureDraw && (
        <Suspense fallback={<div className="fixed inset-0 z-[100] flex items-center justify-center bg-white"><p className="text-gray-400">加载编辑器...</p></div>}>
          <div className="fixed inset-0 z-[100]">
            <StructureDraw
              initialSmiles={structureInitialSmiles}
              onSave={(result) => {
                structureSaveRef.current?.(result);
                structureSaveRef.current = null;
                setShowStructureDraw(false);
              }}
              onCancel={() => {
                structureSaveRef.current = null;
                setShowStructureDraw(false);
              }}
            />
          </div>
        </Suspense>
      )}
    </div>
  );
}
