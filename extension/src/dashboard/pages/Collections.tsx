import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Plus, Trash2, Edit2, Hexagon, X, Check } from 'lucide-react';
import { getCollections, addCollection, updateCollection, deleteCollection } from '../../shared/storage.js';
import type { SavedCollection } from '../../types';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { FadeIn, SlideUp, StaggerList, StaggerItem } from '../../components/motion';

export default function Collections() {
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [colorInput, setColorInput] = useState('#84cc16'); // Default lime

  const PRESET_COLORS = [
    '#84cc16', // lime
    '#3b82f6', // blue
    '#ef4444', // red
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ];

  const refresh = () => setCollections(getCollections());
  useEffect(() => refresh(), []);

  const handleSave = () => {
    if (!nameInput.trim()) return;
    
    if (editingId) {
      updateCollection(editingId, { name: nameInput.trim(), color: colorInput });
    } else {
      addCollection({ name: nameInput.trim(), color: colorInput });
    }
    
    setIsCreating(false);
    setEditingId(null);
    setNameInput('');
    setColorInput('#84cc16');
    refresh();
  };

  const handleEdit = (col: SavedCollection) => {
    setEditingId(col.id);
    setNameInput(col.name);
    setColorInput(col.color || '#84cc16');
    setIsCreating(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this collection? Items will not be deleted, just removed from the collection.')) {
      deleteCollection(id);
      refresh();
    }
  };

  return (
    <FadeIn className="w-full h-full p-8 max-w-6xl mx-auto flex flex-col gap-8 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Folder className="w-8 h-8 text-lime-400" />
            Collections
          </h1>
          <p className="text-[var(--dq-text-muted)]">Organize your saved content into custom collections.</p>
        </div>
        <Button onClick={() => { setIsCreating(true); setEditingId(null); setNameInput(''); setColorInput('#84cc16'); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Collection
        </Button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="glass-card mb-8 border-lime-500/30">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold">{editingId ? 'Edit Collection' : 'Create Collection'}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}><X className="w-4 h-4" /></Button>
                </div>
                
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--dq-text-subtle)] uppercase tracking-wider mb-2">Name</label>
                      <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="e.g. Design Inspiration, Recipes..." autoFocus />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-[var(--dq-text-subtle)] uppercase tracking-wider mb-2">Theme Color</label>
                      <div className="flex flex-wrap gap-3">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColorInput(c)}
                            className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${colorInput === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                          >
                            {colorInput === c && <Check className="w-4 h-4 text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                  <Button variant="default" onClick={handleSave} disabled={!nameInput.trim()}>
                    {editingId ? 'Save Changes' : 'Create'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {collections.map(col => (
          <StaggerItem key={col.id}>
            <Card className="glass-card group overflow-hidden border border-[var(--dq-border)] hover:border-lime-500/20 transition-all h-full flex flex-col">
              <div className="h-16 w-full opacity-20 transition-opacity group-hover:opacity-30" style={{ background: `linear-gradient(to bottom right, ${col.color || '#84cc16'}, transparent)` }} />
              <CardContent className="p-5 flex-1 flex flex-col -mt-10 relative z-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-lg border border-white/10" style={{ backgroundColor: col.color || '#84cc16' }}>
                  <Folder className="w-5 h-5 text-zinc-900" />
                </div>
                
                <h3 className="font-bold text-lg mb-1 truncate text-[var(--dq-text)]">{col.name}</h3>
                <p className="text-xs text-[var(--dq-text-muted)] mb-4">
                  Created {new Date(col.createdAt).toLocaleDateString()}
                </p>

                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[var(--dq-border)]">
                  <Button size="xs" variant="ghost" onClick={() => handleEdit(col)} className="flex-1 gap-1">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => handleDelete(col.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
        {collections.length === 0 && !isCreating && (
          <div className="col-span-full py-12 text-center flex flex-col items-center text-[var(--dq-text-muted)]">
            <Hexagon className="w-12 h-12 mb-4 opacity-50" />
            <p>No collections yet.</p>
            <Button variant="link" className="text-lime-400 mt-2" onClick={() => setIsCreating(true)}>Create your first one</Button>
          </div>
        )}
      </StaggerList>
    </FadeIn>
  );
}
