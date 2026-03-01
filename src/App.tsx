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
import { GripVertical, Plus, Upload, PlusCircle, Filter, ChevronLeft, ChevronRight, Folder, Tag, X } from 'lucide-react';
import './App.css';

// --- Data Types & Default Config ---

type ElementDef = {
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
  elements: Record<string, ElementDef>;
};

const DEFAULT_CONFIG: ConfigObj = {
  project_name: "Ludonomia",
  nameSets: {
    "Locomotion": {
      template: ["Sound Type", "CharacterID", "SurfaceType", "Action"],
      delimiter: "_",
      group: "Movement",
      tags: ["Foley", "Core"]
    },
    "Weapons": {
      template: ["Sound Type", "WeaponID", "FireMode", "Distance"],
      delimiter: "_",
      group: "Combat",
      tags: ["Guns", "Explosives"]
    }
  },
  elements: {
    "Sound Type": {
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

interface SortableElementProps {
  id: string;
  element: string;
  terms: string[];
  selectedValue: string;
  onChange: (val: string) => void;
  onAddTerm: (term: string) => void;
}

function SortableElementItem({ id, element, terms, selectedValue, onChange, onAddTerm }: SortableElementProps) {
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
        <span>{element}</span>
        <div className="drag-handle">
          <GripVertical size={18} />
        </div>
      </div>
      <select
        className="term-select"
        value={selectedValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>Select {element}...</option>
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

  // The ordered elements for the current name set
  const [templateOrder, setTemplateOrder] = useState<string[]>(config.nameSets["Locomotion"].template);

  // State for user-selected terms for each element
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const defaultSels: Record<string, string> = {};
    Object.keys(config.elements).forEach(wc => {
      // default select first term
      defaultSels[wc] = config.elements[wc].terms[0];
    });
    return defaultSels;
  });

  // UI state for Namesets
  const [filterGroup, setFilterGroup] = useState<string>("All");
  const [filterTag, setFilterTag] = useState<string>("");
  const [isCreatingNameSet, setIsCreatingNameSet] = useState<boolean>(false);
  const [newNameSetName, setNewNameSetName] = useState<string>("");

  // UI state for Project Browser
  const [isProjectBrowserOpen, setIsProjectBrowserOpen] = useState<boolean>(true);
  const [projectBrowserTab, setProjectBrowserTab] = useState<'namesets' | 'elements'>('namesets');

  // UI state for Elements
  const [isCreatingElement, setIsCreatingElement] = useState<boolean>(false);
  const [newElementName, setNewElementName] = useState<string>("");

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
          parsedResult = parsedResult.replace(/"categories"/g, '"elements"');
        }

        const loadedConfig = JSON.parse(parsedResult) as ConfigObj;

        if (!loadedConfig.nameSets || !loadedConfig.elements) {
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
        Object.keys(loadedConfig.elements).forEach(wc => {
          defaultSels[wc] = loadedConfig.elements[wc].terms[0] || "";
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
  const handleSelectionChange = (element: string, value: string) => {
    setSelections(prev => ({ ...prev, [element]: value }));
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

  const handleCreateElement = () => {
    const trimmed = newElementName.trim();
    if (!trimmed) return;
    if (config.elements[trimmed]) {
      alert("Element already exists!");
      return;
    }
    setConfig(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [trimmed]: { terms: [] }
      }
    }));
    setIsCreatingElement(false);
    setNewElementName("");
  };

  const handleRemoveElementTerm = (element: string, termToRemove: string) => {
    setConfig(prev => {
      const wc = prev.elements[element];
      return {
        ...prev,
        elements: {
          ...prev.elements,
          [element]: {
            ...wc,
            terms: wc.terms.filter(t => t !== termToRemove)
          }
        }
      };
    });
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
  const handleAddTerm = (element: string, term: string) => {
    setConfig(prev => {
      const wc = prev.elements[element];
      if (!wc.terms.includes(term)) {
        return {
          ...prev,
          elements: {
            ...prev.elements,
            [element]: {
              ...wc,
              terms: [...wc.terms, term]
            }
          }
        };
      }
      return prev;
    });
    // Auto-select the newly added term
    handleSelectionChange(element, term);
  };

  // Compute final filename preview
  const finalFilename = useMemo(() => {
    return templateOrder
      .map(wc => `{${wc}}`)
      .join(' ');
  }, [templateOrder]);

  return (
    <div className="app-container">
      <header className="top-bar glass-panel">
        <div className="top-bar-left">
          <h1>Ludonomia</h1>
          <label className="load-project-btn" title="Load a .json project file">
            <Upload size={16} /> Load Project
            <input
              type="file"
              accept=".json"
              onChange={handleLoadProject}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div className="top-bar-center">
          <div className="nameset-config">
            <label className="config-label">Active NameSet</label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <select
                className="term-select active-nameset-select"
                value={activeNameSet}
                onChange={(e) => handleNameSetChange(e.target.value)}
              >
                {Object.keys(config.nameSets || {}).map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="nameset-config">
            <label className="config-label">Group</label>
            <input
              type="text"
              className="term-input config-input"
              value={config.nameSets[activeNameSet]?.group || ""}
              onChange={e => handleUpdateNameSetMeta('group', e.target.value)}
              placeholder="E.g. Combat"
            />
          </div>
          <div className="nameset-config">
            <label className="config-label">Tags</label>
            <input
              type="text"
              className="term-input config-input"
              value={(config.nameSets[activeNameSet]?.tags || []).join(', ')}
              onChange={e => {
                const tagsArray = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                handleUpdateNameSetMeta('tags', tagsArray);
              }}
              placeholder="E.g. ui, core"
            />
          </div>
        </div>

        <div className="top-bar-right">
          <div className="project-name">
            {config.project_name}
          </div>
        </div>
      </header>

      <div className="workspace">
        <aside className={`project-browser glass-panel ${isProjectBrowserOpen ? 'open' : 'closed'}`}>
          <div className="browser-header">
            <h2>Project Browser</h2>
            <button className="icon-btn" onClick={() => setIsProjectBrowserOpen(!isProjectBrowserOpen)}>
              {isProjectBrowserOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>

          {isProjectBrowserOpen && (
            <>
              <div className="browser-tabs">
                <button
                  className={`tab-btn ${projectBrowserTab === 'namesets' ? 'active' : ''}`}
                  onClick={() => setProjectBrowserTab('namesets')}
                >
                  <Folder size={16} /> NameSets
                </button>
                <button
                  className={`tab-btn ${projectBrowserTab === 'elements' ? 'active' : ''}`}
                  onClick={() => setProjectBrowserTab('elements')}
                >
                  <Tag size={16} /> Elements
                </button>
              </div>

              <div className="browser-content">
                {projectBrowserTab === 'namesets' && (
                  <div className="namesets-browser">
                    <div className="filter-section browser-section">
                      <label className="section-title"><Filter size={14} /> Filters</label>
                      <select
                        value={filterGroup}
                        onChange={(e) => setFilterGroup(e.target.value)}
                        className="term-select"
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
                      />
                    </div>

                    <div className="list-section browser-section">
                      <div className="section-header">
                        <label className="section-title">NameSets</label>
                        <button className="icon-btn" onClick={() => setIsCreatingNameSet(!isCreatingNameSet)} title="Create New NameSet">
                          <PlusCircle size={16} />
                        </button>
                      </div>

                      {isCreatingNameSet && (
                        <div className="create-inline">
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

                      <div className="item-list">
                        {Object.keys(config.nameSets || {})
                          .filter(ns => {
                            const nsData = config.nameSets[ns];
                            const matchesGroup = filterGroup === "All" || nsData.group === filterGroup;
                            const matchesTag = !filterTag.trim() || (nsData.tags && nsData.tags.some(t => t.toLowerCase().includes(filterTag.toLowerCase())));
                            return matchesGroup && matchesTag;
                          })
                          .map(ns => (
                            <button
                              key={ns}
                              className={`list-item ${activeNameSet === ns ? 'active' : ''}`}
                              onClick={() => handleNameSetChange(ns)}
                            >
                              {ns}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {projectBrowserTab === 'elements' && (
                  <div className="elements-browser">
                    <div className="list-section browser-section">
                      <div className="section-header">
                        <label className="section-title">All Elements</label>
                        <button className="icon-btn" onClick={() => setIsCreatingElement(!isCreatingElement)} title="Create New Element">
                          <PlusCircle size={16} />
                        </button>
                      </div>

                      {isCreatingElement && (
                        <div className="create-inline">
                          <input
                            type="text"
                            className="term-input"
                            placeholder="New Element name..."
                            value={newElementName}
                            onChange={e => setNewElementName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCreateElement();
                              if (e.key === 'Escape') setIsCreatingElement(false);
                            }}
                            autoFocus
                          />
                          <button className="add-btn" onClick={handleCreateElement}><Plus size={16} /></button>
                        </div>
                      )}

                      <div className="item-list full-height">
                        {Object.keys(config.elements || {}).map(wc => (
                          <div key={wc} className="element-card">
                            <div className="element-card-header">{wc}</div>
                            <div className="element-terms">
                              {config.elements[wc].terms.map(term => (
                                <span key={term} className="term-badge">
                                  {term}
                                  <button onClick={() => handleRemoveElementTerm(wc, term)}><X size={12} /></button>
                                </span>
                              ))}
                            </div>
                            <div className="add-term-container mini">
                              <input
                                type="text"
                                className="term-input"
                                placeholder="Add term..."
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim();
                                    if (val) {
                                      handleAddTerm(wc, val);
                                      e.currentTarget.value = '';
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        <main className={`editor-main ${!isProjectBrowserOpen ? 'expanded' : ''}`}>
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
                    <SortableElementItem
                      key={wcName}
                      id={wcName}
                      element={wcName}
                      terms={config.elements[wcName]?.terms || []}
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
