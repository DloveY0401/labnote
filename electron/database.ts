import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function initDatabase(dataPath: string): void {
  const dbPath = path.join(dataPath, 'labnote.db');
  console.log('[LabNote] Database path:', dbPath);

  db = new Database(dbPath);
  console.log('[LabNote] Database opened successfully');

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`PRAGMA user_version = 0`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      container TEXT,
      temperature TEXT,
      time TEXT,
      pressure TEXT,
      ph TEXT,
      stirring TEXT,
      atmosphere TEXT,
      procedure TEXT,
      workup TEXT,
      yield_val REAL,
      yield_unit TEXT DEFAULT '%',
      morphology TEXT,
      notes TEXT,
      result_images TEXT,
      structure_image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reactants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      formula TEXT,
      amount REAL,
      amount_unit TEXT,
      equiv REAL,
      role TEXT,
      sort_order INTEGER,
      structure_image TEXT,
      molecular_weight REAL,
      molar_amount REAL
    );

    CREATE TABLE IF NOT EXISTS catalysts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount REAL,
      amount_unit TEXT,
      loading TEXT,
      sort_order INTEGER,
      molecular_weight REAL,
      molar_amount REAL
    );

    CREATE TABLE IF NOT EXISTS solvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      volume REAL,
      volume_unit TEXT,
      ratio TEXT,
      sort_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      type TEXT NOT NULL DEFAULT 'experiment',
      UNIQUE(name, type)
    );

    CREATE TABLE IF NOT EXISTS experiment_tags (
      experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (experiment_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      template_data TEXT NOT NULL,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reagents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      abbreviation TEXT DEFAULT '',
      molecular_weight REAL,
      molecular_formula TEXT DEFAULT '',
      structure_image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // -- New tables for modular experiment system --
  db.exec(`
    CREATE TABLE IF NOT EXISTS module_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'custom',
      icon TEXT,
      fields TEXT NOT NULL DEFAULT '[]',
      is_preset INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS experiment_module_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
      module_key TEXT NOT NULL,
      module_type TEXT NOT NULL DEFAULT 'custom',
      data TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Cache for PubChem compound names
  db.exec(`
    CREATE TABLE IF NOT EXISTS compound_names (
      smiles TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // -- Task / Todo / Calendar --
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done','cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      due_date TEXT,
      experiment_id INTEGER REFERENCES experiments(id) ON DELETE SET NULL,
      parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      recurrence_rule TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, tag_id)
    );
  `);

  // Seed pre-built module templates if none exist
  const presetCount = db.prepare('SELECT COUNT(*) as cnt FROM module_templates WHERE is_preset = 1').get() as { cnt: number };
  if (presetCount.cnt === 0) {
    console.log('[LabNote] Seeding pre-built module templates...');
    const seedPresets = [
      {
        name: '\u8868\u5f81\u6570\u636e',
        description: '\u8bb0\u5f55 NMR\u3001IR\u3001MS\u3001XRD \u7b49\u8868\u5f81\u6570\u636e',
        category: 'characterization',
        icon: 'spectrum',
        fields: JSON.stringify([
          { key: 'nmr_solvent', label: 'NMR \u6eb6\u5242', type: 'text', placeholder: '\u5982: CDCl\u2083', span: 'half' },
          { key: 'nmr_freq', label: 'NMR \u9891\u7387', type: 'text', placeholder: '\u5982: 400 MHz', span: 'half' },
          { key: 'nmr_data', label: 'NMR \u6570\u636e', type: 'textarea', placeholder: '\u00b9H NMR (400 MHz, CDCl\u2083) \u03b4 ...' },
          { key: 'ir_data', label: 'IR \u6570\u636e', type: 'textarea', placeholder: 'IR (KBr) \u03bd ...' },
          { key: 'ms_data', label: 'MS \u6570\u636e', type: 'textarea', placeholder: 'MS (ESI) m/z ...' },
          { key: 'hrms_data', label: 'HRMS', type: 'text', placeholder: 'HRMS (ESI) calcd for ... found ...', span: 'full' },
          { key: 'xrd_data', label: 'XRD \u6570\u636e', type: 'textarea', placeholder: 'XRD \u6570\u636e...' },
        ]),
      },
      {
        name: '\u7406\u8bba\u8ba1\u7b97',
        description: '\u8bb0\u5f55 DFT \u6216\u5176\u4ed6\u8ba1\u7b97\u5316\u5b66\u6570\u636e',
        category: 'computation',
        icon: 'compute',
        fields: JSON.stringify([
          { key: 'method', label: '\u8ba1\u7b97\u65b9\u6cd5', type: 'text', placeholder: '\u5982: B3LYP-D3(BJ)', span: 'half' },
          { key: 'basis_set', label: '\u57fa\u7ec4', type: 'text', placeholder: '\u5982: def2-SVP', span: 'half' },
          { key: 'solvation', label: '\u6eb6\u5242\u6a21\u578b', type: 'text', placeholder: '\u5982: SMD (toluene)', span: 'half' },
          { key: 'energy', label: '\u80fd\u91cf (a.u.)', type: 'text', placeholder: '\u5982: -1234.567890', span: 'half' },
          { key: 'optimized_coords', label: '\u4f18\u5316\u5750\u6807', type: 'textarea', placeholder: '.xyz \u683c\u5f0f\u5750\u6807...' },
          { key: 'freq_analysis', label: '\u9891\u7387\u5206\u6790', type: 'textarea', placeholder: '\u4e3b\u8981\u632f\u52a8\u9891\u7387...' },
        ]),
      },
      {
        name: '\u5b89\u5168\u4fe1\u606f',
        description: '\u8bb0\u5f55\u5b9e\u9a8c\u5b89\u5168\u6ce8\u610f\u4e8b\u9879',
        category: 'safety',
        icon: 'safety',
        fields: JSON.stringify([
          { key: 'hazard_level', label: '\u5371\u9669\u7b49\u7ea7', type: 'select', options: ['\u4f4e', '\u4e2d', '\u9ad8', '\u6781\u9ad8'], span: 'half' },
          { key: 'hazards', label: '\u6f5c\u5728\u5371\u9669', type: 'textarea', placeholder: '\u5982: \u7b2c 4.1 \u7c7b \u6d41\u4f53\u2192\u6613\u71c3\u56fa\u4f53' },
          { key: 'ppe', label: '\u4e2a\u4eba\u9632\u62a4', type: 'textarea', placeholder: '\u5b89\u5168\u773c\u955c\u3001\u5b9e\u9a8c\u670d\u3001\u4e01\u8148\u624b\u5957' },
          { key: 'first_aid', label: '\u6025\u6551\u63aa\u65bd', type: 'textarea', placeholder: '\u76ae\u80a4\u63a5\u89e6: \u5927\u91cf\u6c34\u51b2\u6d17...' },
          { key: 'waste_disposal', label: '\u5e9f\u5f03\u7269\u5904\u7406', type: 'textarea', placeholder: '\u6709\u673a\u5e9f\u6db2\u6876 / \u56fa\u4f53\u5e9f\u7269\u6876' },
        ]),
      },
      {
        name: '\u53c2\u8003\u6587\u732e',
        description: '\u8bb0\u5f55\u76f8\u5173\u53c2\u8003\u6587\u732e',
        category: 'reference',
        icon: 'ref',
        fields: JSON.stringify([
          { key: 'doi', label: 'DOI', type: 'text', placeholder: '10.xxxx/xxxxxx', span: 'half' },
          { key: 'title', label: '\u6587\u732e\u6807\u9898', type: 'text', placeholder: '\u8bba\u6587\u6807\u9898', span: 'full' },
          { key: 'authors', label: '\u4f5c\u8005', type: 'text', placeholder: 'Smith, J. et al.', span: 'half' },
          { key: 'journal', label: '\u671f\u520a', type: 'text', placeholder: 'J. Am. Chem. Soc.', span: 'half' },
          { key: 'notes', label: '\u5907\u6ce8', type: 'textarea', placeholder: '\u76f8\u5173\u9875\u7801\u3001\u5177\u4f53\u5b9e\u9a8c\u6b65\u9aa4\u7b49' },
        ]),
      },
      {
        name: '\u7269\u6599\u6e05\u5355',
        description: '\u5b9e\u9a8c\u524d\u7269\u6599\u51c6\u5907\u6e05\u5355',
        category: 'materials',
        icon: 'checklist',
        fields: JSON.stringify([
          { key: 'items', label: '\u7269\u6599\u6e05\u5355', type: 'textarea', placeholder: '\u6bcf\u884c\u4e00\u9879\uff0c\u5982:\n- \u82ef\u787c\u9178 (5.0 g)\n- \u6eb4\u82ef (3.2 mL)\n- Pd(PPh\u2083)\u2084 (0.12 g)\n- K\u2082CO\u2083 (8.3 g)' },
        ]),
      },
    ];

    const insertStmt = db.prepare(
      'INSERT INTO module_templates (name, description, category, icon, fields, is_preset, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)'
    );
    seedPresets.forEach((p, i) => {
      insertStmt.run(p.name, p.description, p.category, p.icon, p.fields, i);
    });
    console.log('[LabNote] Seeded', seedPresets.length, 'pre-built module templates');
  }

  // -- Create unique index for experiment_module_data --
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_exp_module ON experiment_module_data(experiment_id, module_key)');

  // Batch migration: query each table's columns only once
  type Migration = { table: string; column: string; definition: string };
  const migrations: Migration[] = [
    { table: 'projects',    column: 'innovations',       definition: "TEXT DEFAULT ''" },
    { table: 'projects',    column: 'tasks',             definition: "TEXT DEFAULT ''" },
    { table: 'projects',    column: 'progress',          definition: "INTEGER DEFAULT 0" },
    { table: 'experiments', column: 'result_images',     definition: "TEXT" },
    { table: 'experiments', column: 'structure_image',     definition: "TEXT" },
    { table: 'experiments', column: 'subtitle',          definition: "TEXT DEFAULT ''" },
    { table: 'experiments', column: 'module_layout',     definition: "TEXT" },
    { table: 'reactants',   column: 'structure_image',   definition: "TEXT" },
    { table: 'reactants',   column: 'molecular_weight',  definition: "REAL" },
    { table: 'reactants',   column: 'molar_amount',      definition: "REAL" },
    { table: 'catalysts',   column: 'molecular_weight',  definition: "REAL" },
    { table: 'catalysts',   column: 'molar_amount',      definition: "REAL" },
    { table: 'tags',        column: 'type',              definition: "TEXT NOT NULL DEFAULT 'experiment'" },
  ];

  const tableColumns: Record<string, string[]> = {};
  for (const table of [...new Set(migrations.map((m) => m.table))]) {
    tableColumns[table] = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  }

  for (const { table, column, definition } of migrations) {
    if (!tableColumns[table].includes(column)) {
      console.log(`[LabNote] Migrating: adding ${column} to ${table}`);
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  // Ensure tags.name does not have a lone UNIQUE constraint;
  // use a compound UNIQUE on (name, type) instead.
  const tagIndexes = db.prepare("PRAGMA index_list('tags')").all() as { name: string; unique: number }[];
  const hasNameUnique = tagIndexes.some((idx) => {
    if (!idx.unique) return false;
    const cols = db.prepare(`PRAGMA index_info('${idx.name}')`).all() as { name: string }[];
    return cols.length === 1 && cols[0].name === 'name';
  });
  if (hasNameUnique) {
    console.log('[LabNote] Migrating: rebuilding tags table to allow same name with different type');
    db.exec(`
      CREATE TABLE tags_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#3b82f6',
        type TEXT NOT NULL DEFAULT 'experiment',
        UNIQUE(name, type)
      );
      INSERT INTO tags_new (id, name, color, type) SELECT id, name, color, type FROM tags;
      DROP TABLE tags;
      ALTER TABLE tags_new RENAME TO tags;
    `);
  }
}

export function getDb(): Database.Database {
  return db;
}
