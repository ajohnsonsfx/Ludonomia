import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Upload, PlusCircle, Filter } from 'lucide-react';
import './App.css';

// --- Data Types & Default Config ---

type WildcardDef = {
  terms: string[];
};

type NameSetDef = {
  template: string[];
  delimiter: string;
  group?: string;
  tags?: string[];
};

type ConfigObj = {
  project_name: string;
  nameSets: Record<string, NameSetDef>;
  wildcards: Record<string, WildcardDef>;
};

const DEFAULT_CONFIG: ConfigObj = {
  project_name: "Ludonomia",
  nameSets: {
    "Locomotion": {
      template: ["Wildcard", "CharacterID", "SurfaceType", "Action"],
      delimiter: "_",
      group: "Movement",
      tags: ["Foley", "Core"]
    },
    "Weapons": {
      template: ["Wildcard", "WeaponID", "FireMode", "Distance"],
      delimiter: "_",
      group: "Combat",
      tags: ["Guns", "Explosives"]
    }
  },
  wildcards: {
    "Wildcard": {
      terms: ["SFX", "VO", "MX", "AMB"]
    },
    "SurfaceType": {
      terms: ["Dirt", "Rock", "Metal", "Wood", "Water", "Grass"]
    },
    "CharacterID": {
      terms: ["Hero", "EnemyA", "Boss1", "NPC"]
    },
    "Action": {
      terms: ["Footstep", "Jump", "Land", "Slide", "Foley"]
    },
    "WeaponID": {
      terms: ["Pistol", "Rifle", "Shotgun", "RocketLauncher"]
    },
    "FireMode": {
      terms: ["Single", "Burst", "Auto", "Reload"]
    },
    "Distance": {
      terms: ["Close", "Med", "Far"]
    }
  }
};

// --- Sortable Item Component ---

interface SortableWildcardProps {
  id: string;
  wildcard: string;
  terms: string[];
  selectedValue: string;
  onChange: (val: string) => void;
  onAddTerm: (term: string) => void;
}

function SortableWildcardItem({ id, wildcard, terms, selectedValue, onChange, onAddTerm }: SortableWildcardProps) {
  const [newTerm, setNewTerm] = useState("");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-item ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="item-header">
        <span>{wildcard}</span>
        <div className="drag-handle">
          <GripVertical size={18} />
        </div>
      </div>
      <select
        className="term-select"
        value={selectedValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>Select {wildcard}...</option>
        {terms.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <div className="add-term-container">
        <input
          type="text"
          className="term-input"
          placeholder="New term..."
          value={newTerm}
          onChange={e => setNewTerm(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && newTerm.trim()) {
              onAddTerm(newTerm.trim());
              setNewTerm("");
            }
          }}
        />
        <button
          className="add-btn"
          onClick={() => {
            if (newTerm.trim()) {
              onAddTerm(newTerm.trim());
              setNewTerm("");
            }
          }}
          title="Add Specific Term"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

// --- Main App Component ---

function App() {
  const [config, setConfig] = useState<ConfigObj>(DEFAULT_CONFIG);
  const [activeNameSet, setActiveNameSet] = useState<string>("Locomotion");

  // The ordered wildcards for the current name set
  const [templateOrder, setTemplateOrder] = useState<string[]>(config.nameSets["Locomotion"].template);

  // State for user-selected terms for each wildcard
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const defaultSels: Record<string, string> = {};
    Object.keys(config.wildcards).forEach(wc => {
      // default select first term
      defaultSels[wc] = config.wildcards[wc].terms[0];
    });
    return defaultSels;
  });

  // UI state for Namesets
  const [filterGroup, setFilterGroup] = useState<string>("All");
  const [filterTag, setFilterTag] = useState<string>("");
  const [isCreatingNameSet, setIsCreatingNameSet] = useState<boolean>(false);
  const [newNameSetName, setNewNameSetName] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle Load Project
  const handleLoadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;

        // Minor migration layer so old JSON config schemas still sort of work
        let parsedResult = result;
        if (result.includes('"presets"')) {
          parsedResult = parsedResult.replace(/"presets"/g, '"nameSets"');
        }
        if (result.includes('"categories"')) {
          parsedResult = parsedResult.replace(/"categories"/g, '"wildcards"');
        }

        const loadedConfig = JSON.parse(parsedResult) as ConfigObj;

        if (!loadedConfig.nameSets || !loadedConfig.wildcards) {
          throw new Error("Invalid project format");
        }

        // Migrate older configs to ensure group and tags exist
        Object.keys(loadedConfig.nameSets).forEach(k => {
          if (loadedConfig.nameSets[k].group === undefined) loadedConfig.nameSets[k].group = "";
          if (loadedConfig.nameSets[k].tags === undefined) loadedConfig.nameSets[k].tags = [];
        });

        setConfig(loadedConfig);

        const firstNameSet = Object.keys(loadedConfig.nameSets)[0];
        if (firstNameSet) {
          setActiveNameSet(firstNameSet);
          setTemplateOrder(loadedConfig.nameSets[firstNameSet].template);
        } else {
          setActiveNameSet("");
          setTemplateOrder([]);
        }

        const defaultSels: Record<string, string> = {};
        Object.keys(loadedConfig.wildcards).forEach(wc => {
          defaultSels[wc] = loadedConfig.wildcards[wc].terms[0] || "";
        });
        setSelections(defaultSels);

      } catch (err) {
        console.error("Failed to load project file", err);
        alert("Failed to load project: Invalid JSON file format.");
      }

      event.target.value = '';
    };
    reader.readAsText(file);
  };

  // Handle Name Set Change
  const handleNameSetChange = (nameSetName: string) => {
    setActiveNameSet(nameSetName);
    setTemplateOrder(config.nameSets[nameSetName].template);
  };

  // Handle Drag Reorder
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTemplateOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle Selection Change
  const handleSelectionChange = (wildcard: string, value: string) => {
    setSelections(prev => ({ ...prev, [wildcard]: value }));
  };

  // Handle creating new nameset
  const handleCreateNameSet = () => {
    const trimmed = newNameSetName.trim();
    if (!trimmed) return;
    if (config.nameSets[trimmed]) {
      alert("Nameset already exists!");
      return;
    }
    const currentTemplate = config.nameSets[activeNameSet]?.template || [];
    const currentDelimiter = config.nameSets[activeNameSet]?.delimiter || "_";

    setConfig(prev => ({
      ...prev,
      nameSets: {
        ...prev.nameSets,
        [trimmed]: {
          template: [...currentTemplate],
          delimiter: currentDelimiter,
          group: "",
          tags: []
        }
      }
    }));
    setActiveNameSet(trimmed);
    setTemplateOrder([...currentTemplate]);
    setIsCreatingNameSet(false);
    setNewNameSetName("");
  };

  // Handle Update Active NameSet Metadata (Group/Tags)
  const handleUpdateNameSetMeta = (field: 'group' | 'tags', value: string | string[]) => {
    setConfig(prev => ({
      ...prev,
      nameSets: {
        ...prev.nameSets,
        [activeNameSet]: {
          ...prev.nameSets[activeNameSet],
          [field]: value
        }
      }
    }));
  };

  // Handle adding new term to config
  const handleAddTerm = (wildcard: string, term: string) => {
    setConfig(prev => {
      const wc = prev.wildcards[wildcard];
      if (!wc.terms.includes(term)) {
        return {
          ...prev,
          wildcards: {
            ...prev.wildcards,
            [wildcard]: {
              ...wc,
              terms: [...wc.terms, term]
            }
          }
        };
      }
      return prev;
    });
    // Auto-select the newly added term
    handleSelectionChange(wildcard, term);
  };

  // Compute final filename preview
  const finalFilename = useMemo(() => {
    return templateOrder
      .map(wc => `{${wc}}`)
      .join(' ');
  }, [templateOrder]);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Ludonomia</h1>
        <div className="project-info">
          <p>Project: {config.project_name}</p>
          <label className="load-project-btn" title="Load a .json project file">
            <Upload size={16} /> Load Project...
            <input
              type="file"
              accept=".json"
              onChange={handleLoadProject}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar glass-panel">
          <h2>Configuration</h2>

          <div className="filter-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Filter size={14} /> Filters</label>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="term-select"
              style={{ padding: '0.4rem', fontSize: '0.9rem' }}
            >
              <option value="All">All Groups</option>
              {Array.from(new Set(Object.values(config.nameSets).map(ns => ns.group).filter(Boolean))).map(g => (
                <option key={g as string} value={g as string}>{g as string}</option>
              ))}
            </select>
            <input
              type="text"
              className="term-input"
              placeholder="Filter by tag..."
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              style={{ padding: '0.4rem', fontSize: '0.9rem' }}
            />
          </div>

          <div className="name-set-selector">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Active Name Set</label>
              <button
                onClick={() => setIsCreatingNameSet(!isCreatingNameSet)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0' }}
                title="Create New NameSet"
              >
                <PlusCircle size={16} />
              </button>
            </div>

            {isCreatingNameSet && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="text"
                  className="term-input"
                  placeholder="New NameSet name..."
                  value={newNameSetName}
                  onChange={e => setNewNameSetName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateNameSet();
                    if (e.key === 'Escape') setIsCreatingNameSet(false);
                  }}
                  autoFocus
                />
                <button className="add-btn" onClick={handleCreateNameSet}><Plus size={16} /></button>
              </div>
            )}

            <select
              value={activeNameSet}
              onChange={(e) => handleNameSetChange(e.target.value)}
            >
              {Object.keys(config.nameSets || {})
                .filter(ns => {
                  const nsData = config.nameSets[ns];
                  const matchesGroup = filterGroup === "All" || nsData.group === filterGroup;
                  const matchesTag = !filterTag.trim() || (nsData.tags && nsData.tags.some(t => t.toLowerCase().includes(filterTag.toLowerCase())));
                  return matchesGroup && matchesTag;
                })
                .map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
            </select>
          </div>

          <div className="active-nameset-meta" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Group</label>
            <input
              type="text"
              className="term-input"
              value={config.nameSets[activeNameSet]?.group || ""}
              onChange={e => handleUpdateNameSetMeta('group', e.target.value)}
              placeholder="E.g. Combat"
            />

            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tags (comma separated)</label>
            <input
              type="text"
              className="term-input"
              value={(config.nameSets[activeNameSet]?.tags || []).join(', ')}
              onChange={e => {
                const tagsArray = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                handleUpdateNameSetMeta('tags', tagsArray);
              }}
              placeholder="E.g. ui, core"
            />
          </div>

          <div style={{ marginTop: 'auto', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <p>Drag the handles on the right of each wildcard to reorder your naming convention.</p>
          </div>
        </aside>

        <main className="editor-main">
          <div className="preview-bar">
            <span>NameSet Template</span>
            <div className="preview-text">{finalFilename}</div>
          </div>

          <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)' }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="dnd-container">
                <SortableContext
                  items={templateOrder}
                  strategy={horizontalListSortingStrategy}
                >
                  {templateOrder.map((wcName) => (
                    <SortableWildcardItem
                      key={wcName}
                      id={wcName}
                      wildcard={wcName}
                      terms={config.wildcards[wcName]?.terms || []}
                      selectedValue={selections[wcName]}
                      onChange={(val) => handleSelectionChange(wcName, val)}
                      onAddTerm={(val) => handleAddTerm(wcName, val)}
                    />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
