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
import { GripVertical, Plus } from 'lucide-react';
import './App.css';

// --- Data Types & Default Config ---

type CategoryDef = {
  terms: string[];
};

type PresetDef = {
  template: string[];
  delimiter: string;
};

type ConfigObj = {
  project_name: string;
  presets: Record<string, PresetDef>;
  categories: Record<string, CategoryDef>;
};

const DEFAULT_CONFIG: ConfigObj = {
  project_name: "Ludonomia",
  presets: {
    "Locomotion": {
      template: ["Category", "CharacterID", "SurfaceType", "Action"],
      delimiter: "_"
    },
    "Weapons": {
      template: ["Category", "WeaponID", "FireMode", "Distance"],
      delimiter: "_"
    }
  },
  categories: {
    "Category": {
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

interface SortableCategoryProps {
  id: string;
  category: string;
  terms: string[];
  selectedValue: string;
  onChange: (val: string) => void;
  onAddTerm: (term: string) => void;
}

function SortableCategoryItem({ id, category, terms, selectedValue, onChange, onAddTerm }: SortableCategoryProps) {
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
    >
      <div className="item-header">
        <span>{category}</span>
        <div {...attributes} {...listeners} className="drag-handle">
          <GripVertical size={18} />
        </div>
      </div>
      <select
        className="term-select"
        value={selectedValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>Select {category}...</option>
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
  const [activePreset, setActivePreset] = useState<string>("Locomotion");

  // The ordered categories for the current preset
  const [templateOrder, setTemplateOrder] = useState<string[]>(config.presets["Locomotion"].template);

  // State for user-selected terms for each category
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const defaultSels: Record<string, string> = {};
    Object.keys(config.categories).forEach(cat => {
      // default select first term
      defaultSels[cat] = config.categories[cat].terms[0];
    });
    return defaultSels;
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle Preset Change
  const handlePresetChange = (presetName: string) => {
    setActivePreset(presetName);
    setTemplateOrder(config.presets[presetName].template);
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
  const handleSelectionChange = (category: string, value: string) => {
    setSelections(prev => ({ ...prev, [category]: value }));
  };

  // Handle adding new term to config
  const handleAddTerm = (category: string, term: string) => {
    setConfig(prev => {
      const cat = prev.categories[category];
      if (!cat.terms.includes(term)) {
        return {
          ...prev,
          categories: {
            ...prev.categories,
            [category]: {
              ...cat,
              terms: [...cat.terms, term]
            }
          }
        };
      }
      return prev;
    });
    // Auto-select the newly added term
    handleSelectionChange(category, term);
  };

  // Compute final filename preview
  const finalFilename = useMemo(() => {
    const delimiter = config.presets[activePreset].delimiter;
    return templateOrder
      .map(cat => selections[cat] || `[${cat}]`)
      .join(delimiter);
  }, [templateOrder, selections, activePreset, config]);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Ludonomia</h1>
        <p>Project: {config.project_name}</p>
      </header>

      <div className="workspace">
        <aside className="sidebar glass-panel">
          <h2>Configuration</h2>
          <div className="preset-selector">
            <label>Active Preset</label>
            <select
              value={activePreset}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              {Object.keys(config.presets).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 'auto', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <p>Drag the handles on the right of each category to reorder your naming convention.</p>
          </div>
        </aside>

        <main className="editor-main">
          <div className="preview-bar">
            <span>Generated Filename</span>
            <div className="preview-text">{finalFilename}.wav</div>
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
                  {templateOrder.map((catName) => (
                    <SortableCategoryItem
                      key={catName}
                      id={catName}
                      category={catName}
                      terms={config.categories[catName]?.terms || []}
                      selectedValue={selections[catName]}
                      onChange={(val) => handleSelectionChange(catName, val)}
                      onAddTerm={(val) => handleAddTerm(catName, val)}
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
