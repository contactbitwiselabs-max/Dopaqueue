import React, { useState, useEffect, useTransition, useOptimistic } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Plus, Trash2, Edit2, Hexagon, X, Check } from 'lucide-react';
import { getCollections, addCollection, updateCollection, deleteCollection } from '../../shared/storage.js';
import type { SavedCollection } from '../../types';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { FadeIn, SlideUp, StaggerList, StaggerItem } from '../../components/motion';
import { useI18n } from '../../shared/i18n';

export default function Collections() {
  const { t } = useI18n();
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [colorInput, setColorInput] = useState('#84cc16'); // Default lime

  // C2: React 19 useTransition for non-blocking updates
  const [isPending, startTransition] = useTransition();
  
  // C2: React 19 useOptimistic for optimistic UI updates
  const [optimisticCollections, setOptimisticCollections] = useOptimistic<SavedCollection[]>(
    collections,
    (currentCollections, newCollection: SavedCollection) => {
      if (newCollection.id.startsWith('optimistic-')) {
        return [...currentCollections, newCollection];
      }
      return currentCollections.map(c => c.id === newCollection.id ? newCollection : c);
    }
  );
  
  // Display collections combines regular + optimistic (deduped by id)
  const displayCollections = [...collections, ...optimisticCollections.filter(oc => !collections.some(c => c.id === oc.id))];

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
      startTransition(() => {
        updateCollection(editingId, { name: nameInput.trim(), color: colorInput });
        // Optimistic update
        const existingCol = getCollections().find(c => c.id === editingId);
        if (existingCol) {
          setOptimisticCollections({ ...existingCol, name: nameInput.trim(), color: colorInput });
        }
      });
    } else {
      const tempId = `optimistic-${Date.now()}`;
      const newCollection: SavedCollection = {
        id: tempId,
        name: nameInput.trim(),
        color: colorInput,
        createdAt: Date.now(),
        itemCount: 0,
      };
      
      startTransition(() => {
        addCollection({ name: nameInput.trim(), color: colorInput });
        // Optimistic update
        setOptimisticCollections(newCollection);
      });
    }
    
    setIsCreating(false);
    setEditingId(null);
    setNameInput('');
    setColorInput('#84cc16');
    // Don't refresh immediately - let the optimistic update show instantly
    // The actual data will sync when storage updates
  };

  const handleEdit = (col: SavedCollection) => {
    setEditingId(col.id);
    setNameInput(col.name);
    setColorInput(col.color || '#84cc16');
    setIsCreating(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('confirm.delete'))) {
      startTransition(() => {
        deleteCollection(id);
        // Optimistic update - remove from display
        setOptimisticCollections(col => col.filter(c => c.id !== id));
      });
    }
  };

  return (
    <FadeIn className="w-full h-full p-8 max-w-6xl mx-auto flex flex-col gap-8 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Folder className="w-8 h-8 text-lime-400" />
            {t('dashboard.circles')}
            {isPending && <span className="text-sm font-normal text-lime-400 animate-pulse">({t('action.save')}...)</span>}
          </h1>
          <p className="text-[var(--dq-text-muted)]">{t('dashboard.circles')}</p>
        </div>
        <Button onClick={() => { setIsCreating(true); setEditingId(null); setNameInput(''); setColorInput('#84cc16'); }} className="gap-2">
          <Plus className="w-4 h-4" /> {t('action.add')} {t('dashboard.circles')}
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
                  <h3 className="text-lg font-bold">{editingId ? t('action.edit') : t('action.add')} {t('dashboard.circles')}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}><X className="w-4 h-4" /></Button>
                </div>
                
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--dq-text-subtle)] uppercase tracking-wider mb-2">{t('dashboard.circles')}</label>
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
                  <Button variant="ghost" onClick={() => setIsCreating(false)}>{t('action.cancel')}</Button>
                  <Button variant="default" onClick={handleSave} disabled={!nameInput.trim()}>
                    {editingId ? t('action.save') : t('action.create')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayCollections.map(col => (
          <StaggerItem key={col.id}>
            <Card className="glass-card group overflow-hidden border border-[var(--dq-border)] hover:border-lime-500/20 transition-all h-full flex flex-col">
              <div className="h-16 w-full opacity-20 transition-opacity group-hover:opacity-30" style={{ background: `linear-gradient(to bottom right, ${col.color || '#84cc16'}, transparent)` }} />
              <CardContent className="p-5 flex-1 flex flex-col -mt-10 relative z-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-lg border border-white/10" style={{ backgroundColor: col.color || '#84cc16' }}>
                  <Folder className="w-5 h-5 text-zinc-900" />
                </div>
                <h3 className="font-bold text-lg mb-1 truncate text-[var(--dq-text)]">{col.name}</h3>
                <p className="text-xs text-[var(--dq-text-muted)] mb-4">
                  {t('action.create')} {new Date(col.createdAt).toLocaleDateString()}
                </p>

                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[var(--dq-border)]">
                  <Button size="xs" variant="ghost" onClick={() => handleEdit(col)} className="flex-1 gap-1">
                    <Edit2 className="w-3.5 h-3.5" /> {t('action.edit')}
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => handleDelete(col.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
        {displayCollections.length === 0 && !isCreating && (
          <div className="col-span-full py-12 text-center flex flex-col items-center text-[var(--dq-text-muted)]">
            <Hexagon className="w-12 h-12 mb-4 opacity-50" />
            <p>{t('dashboard.circles')}</p>
            <Button variant="link" className="text-lime-400 mt-2" onClick={() => setIsCreating(true)}>{t('action.add')} {t('action.create')}</Button>
          </div>
        )}
      </StaggerList>
    </FadeIn>
  );
}