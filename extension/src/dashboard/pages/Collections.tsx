import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Plus, Trash2, Edit2, Hexagon, X, Check, ArrowLeft, Search, Image, Link2, LayoutGrid, FileText, AlertTriangle, ChevronRight } from 'lucide-react';
import { getCollections, addCollection, updateCollection, deleteCollection, subscribe, getSavedVideos, updateQueueItem } from '../../shared/storage.js';
import type { SavedCollection, QueueItem } from '../../types';
import { STORAGE_KEYS } from '../../shared/constants.js';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Badge } from '../../components/ui/badge';
import { FadeIn, SlideUp, StaggerList, StaggerItem } from '../../components/motion';

// ─── Constants ──────────────────────────────────────────────────────
const PRESETS = [
  { name: 'Focus', color: '#3b82f6', image: '/presets/focus.png', emoji: '🎯' },
  { name: 'Entertaining', color: '#ec4899', image: '/presets/entertaining.png', emoji: '🎬' },
  { name: 'Important', color: '#ef4444', image: '/presets/important.png', emoji: '⭐' },
  { name: 'Fun', color: '#f59e0b', image: '/presets/fun.png', emoji: '🎮' },
  { name: 'Reference', color: '#14b8a6', image: '/presets/reference.png', emoji: '📚' },
];

const PRESET_COLORS = [
  '#84cc16', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#10b981',
];

// ─── Collection Detail View ─────────────────────────────────────────
function CollectionDetail({
  collection,
  allVideos,
  onBack,
}: {
  collection: SavedCollection;
  allVideos: QueueItem[];
  onBack: () => void;
}) {
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const collectionItems = allVideos.filter(v => v.collection === collection.name);
  const unassignedItems = allVideos.filter(v => v.collection !== collection.name);
  const filteredUnassigned = searchQuery.trim()
    ? unassignedItems.filter(item =>
        (item.title || item.url || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : unassignedItems;

  const handleAddItem = (itemId: string) => {
    updateQueueItem(itemId, { collection: collection.name });
  };

  const handleRemoveItem = (itemId: string) => {
    updateQueueItem(itemId, { collection: undefined });
  };

  return (
    <FadeIn className="w-full h-full p-8 max-w-6xl mx-auto flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-[var(--dq-text-muted)] hover:text-[var(--dq-text)]">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border border-white/10 shrink-0"
            style={{ backgroundColor: collection.color || '#84cc16' }}
          >
            <Folder className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{collection.name}</h1>
            <p className="text-xs text-[var(--dq-text-muted)]">
              {collectionItems.length} item{collectionItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={() => { setIsAddingItems(!isAddingItems); setSearchQuery(''); }}
          variant={isAddingItems ? 'default' : 'outline'}
          className={isAddingItems ? 'bg-lime-500 text-black hover:bg-lime-600' : 'gap-2'}
        >
          {isAddingItems ? (
            <><Check className="w-4 h-4 mr-1" /> Done</>
          ) : (
            <><Plus className="w-4 h-4" /> Add Items</>
          )}
        </Button>
      </div>

      {/* Add Items Panel */}
      <AnimatePresence>
        {isAddingItems && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="glass-card border-lime-500/30">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-base font-bold flex-1">Add Items to "{collection.name}"</h3>
                  <Badge variant="secondary">{filteredUnassigned.length} available</Badge>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    placeholder="Search by title or URL..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="max-h-[50vh] min-h-[100px] overflow-y-auto overflow-x-hidden rounded-lg border border-zinc-800/60 bg-black/20 custom-scrollbar">
                  <div className="p-2 space-y-1 w-full">
                    {filteredUnassigned.length === 0 ? (
                      <div className="py-8 text-center text-sm text-[var(--dq-text-muted)]">
                        {searchQuery.trim() ? 'No items match your search.' : 'All items are already in collections.'}
                      </div>
                    ) : (
                      filteredUnassigned.map(item => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8, height: 0 }}
                          className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors group w-full overflow-hidden gap-2"
                        >
                          <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} className="w-8 h-8 rounded object-cover shrink-0" alt="" />
                            ) : item.type === 'screenshot' || item.type === 'image' ? (
                              <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                                <Image className="w-4 h-4 text-zinc-500" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-zinc-500" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.title || 'Untitled'}</p>
                              <p className="truncate text-[10px] text-[var(--dq-text-muted)]">{item.url}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAddItem(item.id)}
                            className="shrink-0 ml-2 text-lime-400 hover:text-lime-300 hover:bg-lime-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add
                          </Button>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collection Items Grid */}
      {collectionItems.length === 0 && !isAddingItems ? (
        <FadeIn className="py-16 text-center border border-dashed border-[var(--dq-border)] rounded-2xl">
          <Folder className="w-12 h-12 mx-auto mb-4 opacity-30 text-[var(--dq-text-muted)]" />
          <p className="font-medium text-[var(--dq-text-muted)]">This collection is empty</p>
          <p className="text-sm text-[var(--dq-text-subtle)] mt-1 mb-4">Add items to get started</p>
          <Button variant="outline" className="gap-2" onClick={() => setIsAddingItems(true)}>
            <Plus className="w-4 h-4" /> Add Items
          </Button>
        </FadeIn>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {collectionItems.map(item => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="glass-card group overflow-hidden border border-[var(--dq-border)] hover:border-zinc-600/50 transition-all h-48 flex flex-col">
                <div className="h-24 relative overflow-hidden bg-zinc-900 flex items-center justify-center shrink-0">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
                  ) : (
                    <div className="text-zinc-600 text-xs">No preview</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 to-transparent" />
                </div>
                <CardContent className="p-3 flex-1 flex flex-col justify-between">
                  <h3 className="font-semibold text-sm line-clamp-2">{item.title || item.url}</h3>
                  <div className="flex justify-between items-center mt-2">
                    <Badge variant="outline" className="text-[10px]">{item.type || 'link'}</Badge>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </FadeIn>
  );
}

// ─── Delete Confirmation Modal ──────────────────────────────────────
function DeleteModal({
  collectionName,
  onConfirm,
  onCancel,
}: {
  collectionName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <Card className="glass-card border-red-500/20 shadow-2xl shadow-red-500/5">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-center mb-2">Delete "{collectionName}"?</h3>
            <p className="text-sm text-[var(--dq-text-muted)] text-center mb-6 leading-relaxed">
              Items in this collection won't be deleted — they'll just be unassigned. This can't be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Collections Page ──────────────────────────────────────────
export default function Collections() {
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [allVideos, setAllVideos] = useState<QueueItem[]>([]);
  
  // Form state
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [colorInput, setColorInput] = useState('#84cc16');
  const [imageInput, setImageInput] = useState<string | undefined>(undefined);
  
  // View state
  const [selectedCollection, setSelectedCollection] = useState<SavedCollection | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Data Loading ───
  const refresh = useCallback(() => {
    setCollections(getCollections());
    setAllVideos(getSavedVideos());
  }, []);

  useEffect(() => {
    refresh();
    const unsubCol = subscribe(STORAGE_KEYS.COLLECTIONS, refresh);
    const unsubQueue = subscribe(STORAGE_KEYS.QUEUE, refresh);
    return () => {
      unsubCol();
      unsubQueue();
    };
  }, [refresh]);

  // Keep selectedCollection in sync with data
  useEffect(() => {
    if (selectedCollection) {
      const updated = collections.find(c => c.id === selectedCollection.id);
      if (!updated) {
        setSelectedCollection(null); // collection was deleted
      } else if (updated.name !== selectedCollection.name || updated.color !== selectedCollection.color || updated.image !== selectedCollection.image) {
        setSelectedCollection(updated);
      }
    }
  }, [collections, selectedCollection]);

  // ─── Handlers ───
  const handleSave = () => {
    if (!nameInput.trim()) return;
    if (editingId) {
      updateCollection(editingId, { name: nameInput.trim(), color: colorInput, image: imageInput });
    } else {
      addCollection({ name: nameInput.trim(), color: colorInput, image: imageInput });
    }
    resetForm();
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setNameInput('');
    setColorInput('#84cc16');
    setImageInput(undefined);
  };

  const handleEdit = (col: SavedCollection) => {
    setEditingId(col.id);
    setNameInput(col.name);
    setColorInput(col.color || '#84cc16');
    setImageInput(col.image);
    setIsCreating(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteCollection(deletingId);
      if (selectedCollection?.id === deletingId) {
        setSelectedCollection(null);
      }
      setDeletingId(null);
    }
  };

  const getItemCount = (collectionName: string) => {
    return allVideos.filter(v => v.collection === collectionName).length;
  };

  const deletingCollection = deletingId ? collections.find(c => c.id === deletingId) : null;

  // ─── Detail View ───
  if (selectedCollection) {
    return (
      <CollectionDetail
        collection={selectedCollection}
        allVideos={allVideos}
        onBack={() => setSelectedCollection(null)}
      />
    );
  }

  // ─── Main List View ───
  return (
    <FadeIn className="w-full h-full p-8 max-w-6xl mx-auto flex flex-col gap-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <Folder className="w-8 h-8 text-lime-400" />
            Collections
          </h1>
          <p className="text-sm text-[var(--dq-text-muted)]">Organize your saves into themed folders</p>
        </div>
        <Button onClick={() => { setIsCreating(true); setEditingId(null); setNameInput(''); setColorInput('#84cc16'); setImageInput(undefined); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Collection
        </Button>
      </div>

      {/* Create / Edit Form */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="glass-card border-lime-500/30">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <h3 className="text-lg font-bold">{editingId ? 'Edit' : 'New'} Collection</h3>
                  <Button variant="ghost" size="sm" onClick={resetForm}><X className="w-4 h-4" /></Button>
                </div>
                
                <div className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--dq-text-subtle)] uppercase tracking-wider mb-2">Name</label>
                    <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="e.g. Design Inspiration, Recipes..." autoFocus />
                  </div>
                  
                  {/* Presets */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--dq-text-subtle)] uppercase tracking-wider mb-2">Quick Start Presets</label>
                    <div className="flex flex-wrap gap-3 mb-4">
                      {PRESETS.map(p => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => {
                            setNameInput(p.name);
                            setColorInput(p.color);
                            setImageInput(p.image);
                          }}
                          className={`relative w-28 h-20 rounded-xl border-2 transition-all overflow-hidden flex flex-col items-center justify-center gap-1 ${
                            imageInput === p.image
                              ? 'border-lime-400 scale-105 shadow-lg shadow-lime-500/10'
                              : 'border-transparent hover:scale-105 opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: p.color }}
                        >
                          <img src={p.image} className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50" alt="" />
                          <span className="relative z-10 text-lg">{p.emoji}</span>
                          <span className="relative z-10 text-[10px] font-bold text-white drop-shadow-md">{p.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Color picker */}
                    <label className="block text-xs font-semibold text-[var(--dq-text-subtle)] uppercase tracking-wider mb-2">Custom Color</label>
                    <div className="flex flex-wrap gap-2.5">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setColorInput(c); setImageInput(undefined); }}
                          className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                            colorInput === c && !imageInput
                              ? 'border-white scale-110 shadow-lg'
                              : 'border-transparent hover:scale-110'
                          }`}
                          style={{ backgroundColor: c }}
                        >
                          {colorInput === c && !imageInput && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="ghost" onClick={resetForm}>Cancel</Button>
                  <Button onClick={handleSave} disabled={!nameInput.trim()} className="bg-lime-500 text-black hover:bg-lime-600 gap-2">
                    <Check className="w-4 h-4" />
                    {editingId ? 'Save Changes' : 'Create Collection'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collections Grid */}
      {collections.length === 0 && !isCreating ? (
        <FadeIn className="py-20 text-center border border-dashed border-[var(--dq-border)] rounded-2xl">
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
            <Hexagon className="w-14 h-14 mx-auto mb-5 opacity-30 text-[var(--dq-text-muted)]" />
          </motion.div>
          <p className="font-medium text-lg text-[var(--dq-text-muted)]">No collections yet</p>
          <p className="text-sm text-[var(--dq-text-subtle)] mt-1 mb-5">Create your first collection to organize your saves</p>
          <Button variant="outline" className="gap-2" onClick={() => setIsCreating(true)}>
            <Plus className="w-4 h-4" /> Create Collection
          </Button>
        </FadeIn>
      ) : (
        <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {collections.map(col => {
            const itemCount = getItemCount(col.name);
            return (
              <StaggerItem key={col.id}>
                <Card
                  className="glass-card group overflow-hidden border border-[var(--dq-border)] hover:border-lime-500/20 transition-all h-full flex flex-col cursor-pointer"
                  onClick={() => setSelectedCollection(col)}
                >
                  {/* Banner */}
                  <div className="h-24 w-full relative overflow-hidden">
                    {col.image ? (
                      <img
                        src={col.image}
                        className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-300"
                        alt=""
                      />
                    ) : (
                      <div
                        className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                        style={{ background: `linear-gradient(135deg, ${col.color || '#84cc16'}, transparent)` }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 to-transparent" />
                    
                    {/* Item count badge */}
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="bg-black/40 backdrop-blur-sm text-[10px] border-white/10">
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <CardContent className="p-5 flex-1 flex flex-col -mt-10 relative z-10">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-lg border border-white/10 shrink-0"
                      style={{ backgroundColor: col.color || '#84cc16' }}
                    >
                      <Folder className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate text-[var(--dq-text)]">{col.name}</h3>
                    <p className="text-[10px] text-[var(--dq-text-muted)] mb-4">
                      Created {new Date(col.createdAt).toLocaleDateString()}
                    </p>

                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-[var(--dq-border)]">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleEdit(col); }}
                        className="flex-1 gap-1 text-[var(--dq-text-muted)] hover:text-[var(--dq-text)]"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleDelete(col.id); }}
                        className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-[var(--dq-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && deletingCollection && (
          <DeleteModal
            collectionName={deletingCollection.name}
            onConfirm={confirmDelete}
            onCancel={() => setDeletingId(null)}
          />
        )}
      </AnimatePresence>
    </FadeIn>
  );
}