import { contextBridge, ipcRenderer } from 'electron';

export interface LabNoteAPI {
  app: {
    getDataPath: () => Promise<string>;
  };
  images: {
    save: (dataUrl: string) => Promise<string>;
  };
  projects: {
    list: () => Promise<any[]>;
    get: (id: number) => Promise<any>;
    create: (data: { name: string; description?: string; innovations?: string; tasks?: string; progress?: number }) => Promise<number>;
    update: (id: number, data: { name?: string; description?: string; innovations?: string; tasks?: string; progress?: number }) => Promise<void>;
    delete: (id: number) => Promise<void>;
  };
  experiments: {
    list: () => Promise<any[]>;
    get: (id: number) => Promise<any>;
    create: (data: any) => Promise<number>;
    update: (id: number, data: any) => Promise<void>;
    delete: (id: number) => Promise<void>;
    tags: (expId: number) => Promise<any[]>;
    allTags: () => Promise<{ experiment_id: number; tag_id: number }[]>;
    export: (id: number) => Promise<string | null>;
    exportData: (id: number) => Promise<any>;
    setModuleLayout: (id: number, layout: any[]) => Promise<void>;
    getCustomModules: (id: number) => Promise<any[]>;
    saveCustomModules: (id: number, modules: { module_key: string; data: Record<string, any> }[]) => Promise<void>;
  };
  tags: {
    list: (type?: string) => Promise<any[]>;
    create: (data: { name: string; color?: string; type?: string }) => Promise<number>;
    update: (id: number, data: { name: string; color?: string }) => Promise<void>;
    delete: (id: number) => Promise<void>;
  };
  templates: {
    list: () => Promise<any[]>;
    get: (id: number) => Promise<any>;
    create: (data: { name: string; description?: string; template_data: string }) => Promise<number>;
    update: (id: number, data: { name?: string; description?: string; template_data?: string }) => Promise<void>;
    delete: (id: number) => Promise<void>;
    incrementUsage: (id: number) => Promise<void>;
  };
  reagents: {
    list: () => Promise<any[]>;
    get: (id: number) => Promise<any>;
    create: (data: { name: string; abbreviation?: string; molecular_weight?: number; molecular_formula?: string; structure_image?: string }) => Promise<number>;
    update: (id: number, data: { name?: string; abbreviation?: string; molecular_weight?: number; molecular_formula?: string; structure_image?: string }) => Promise<void>;
    delete: (id: number) => Promise<void>;
  };
  modules: {
    templates: {
      list: () => Promise<any[]>;
      get: (id: number) => Promise<any>;
      create: (data: { name: string; description?: string; category?: string; fields: string }) => Promise<number>;
      update: (id: number, data: { name?: string; description?: string; fields?: string }) => Promise<void>;
      delete: (id: number) => Promise<void>;
    };
  };
  compound: {
    getName: (smiles: string) => Promise<string | null>;
    setName: (smiles: string, name: string) => Promise<void>;
  };
  tasks: {
    list: (filters?: { status?: string; experiment_id?: number; tag_id?: number }) => Promise<any[]>;
    get: (id: number) => Promise<any>;
    create: (data: any) => Promise<number>;
    update: (id: number, data: any) => Promise<void>;
    delete: (id: number) => Promise<void>;
    getByExperiment: (experimentId: number) => Promise<any[]>;
  };
  widget: {
    toggle: () => Promise<void>;
    openMain: () => Promise<void>;
    navigateTo: (path: string) => Promise<void>;
    devtools: () => Promise<void>;
    onDataChanged: (callback: () => void) => () => void;
  };
}

const api: LabNoteAPI = {
  app: {
    getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  },
  images: {
    save: (dataUrl) => ipcRenderer.invoke('images:save', dataUrl),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    get: (id) => ipcRenderer.invoke('projects:get', id),
    create: (data) => ipcRenderer.invoke('projects:create', data),
    update: (id, data) => ipcRenderer.invoke('projects:update', id, data),
    delete: (id) => ipcRenderer.invoke('projects:delete', id),
  },
  experiments: {
    list: () => ipcRenderer.invoke('experiments:list'),
    get: (id) => ipcRenderer.invoke('experiments:get', id),
    create: (data) => ipcRenderer.invoke('experiments:create', data),
    update: (id, data) => ipcRenderer.invoke('experiments:update', id, data),
    delete: (id) => ipcRenderer.invoke('experiments:delete', id),
    tags: (expId) => ipcRenderer.invoke('experiments:tags', expId),
    allTags: () => ipcRenderer.invoke('experiments:allTags'),
    export: (id) => ipcRenderer.invoke('experiments:export', id),
    exportData: (id) => ipcRenderer.invoke('experiments:exportData', id),
    setModuleLayout: (id, layout) => ipcRenderer.invoke('experiments:setModuleLayout', id, layout),
    getCustomModules: (id) => ipcRenderer.invoke('experiments:getCustomModules', id),
    saveCustomModules: (id, modules) => ipcRenderer.invoke('experiments:saveCustomModules', id, modules),
  },
  tags: {
    list: (type?: string) => ipcRenderer.invoke('tags:list', type),
    create: (data) => ipcRenderer.invoke('tags:create', data),
    update: (id, data) => ipcRenderer.invoke('tags:update', id, data),
    delete: (id) => ipcRenderer.invoke('tags:delete', id),
  },
  templates: {
    list: () => ipcRenderer.invoke('templates:list'),
    get: (id) => ipcRenderer.invoke('templates:get', id),
    create: (data) => ipcRenderer.invoke('templates:create', data),
    update: (id, data) => ipcRenderer.invoke('templates:update', id, data),
    delete: (id) => ipcRenderer.invoke('templates:delete', id),
    incrementUsage: (id) => ipcRenderer.invoke('templates:increment-usage', id),
  },
  reagents: {
    list: () => ipcRenderer.invoke('reagents:list'),
    get: (id) => ipcRenderer.invoke('reagents:get', id),
    create: (data) => ipcRenderer.invoke('reagents:create', data),
    update: (id, data) => ipcRenderer.invoke('reagents:update', id, data),
    delete: (id) => ipcRenderer.invoke('reagents:delete', id),
  },
  modules: {
    templates: {
      list: () => ipcRenderer.invoke('modules:templates:list'),
      get: (id) => ipcRenderer.invoke('modules:templates:get', id),
      create: (data) => ipcRenderer.invoke('modules:templates:create', data),
      update: (id, data) => ipcRenderer.invoke('modules:templates:update', id, data),
      delete: (id) => ipcRenderer.invoke('modules:templates:delete', id),
    },
  },
  compound: {
    getName: (smiles) => ipcRenderer.invoke('compound:getName', smiles),
    setName: (smiles, name) => ipcRenderer.invoke('compound:setName', smiles, name),
  },
  tasks: {
    list: (filters) => ipcRenderer.invoke('tasks:list', filters),
    get: (id) => ipcRenderer.invoke('tasks:get', id),
    create: (data) => ipcRenderer.invoke('tasks:create', data),
    update: (id, data) => ipcRenderer.invoke('tasks:update', id, data),
    delete: (id) => ipcRenderer.invoke('tasks:delete', id),
    getByExperiment: (experimentId) => ipcRenderer.invoke('tasks:getByExperiment', experimentId),
  },
  widget: {
    toggle: () => ipcRenderer.invoke('widget:toggle'),
    openMain: () => ipcRenderer.invoke('widget:openMain'),
    navigateTo: (path: string) => ipcRenderer.invoke('widget:navigateTo', path),
    devtools: () => ipcRenderer.invoke('widget:devtools'),
    onDataChanged: (callback: () => void) => {
      ipcRenderer.on('widget:dataChanged', callback);
      return () => { ipcRenderer.removeListener('widget:dataChanged', callback); };
    },
  },
};

contextBridge.exposeInMainWorld('labnote', api);
