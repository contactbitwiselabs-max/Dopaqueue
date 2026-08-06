// @ts-nocheck
import React, { useEffect, useState, useTransition, useOptimistic } from 'react';
import { LogOut, Cloud, Download, Folder, AlertCircle, Check } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import {
  getCurrentUser,
  signOut,
  signInWithGoogle,
  isLoggedIn,
  getUserEmail,
  getUserName,
} from '../../shared/auth';
import { syncWithCloud } from '../../shared/sync';
import { exportToMarkdown, exportToCSV, exportToJSON, exportToNotion, exportToObsidian, downloadFile, buildExportFilename } from '../../shared/export';
import { getSavedVideos, getSavedChannels, getGameState, updateGameState } from '../../shared/storage';
import { DEFAULT_DAILY_BUDGET } from '../../shared/constants';
import { getChannelGroups, createChannelGroup, deleteChannelGroup } from '../../shared/groups';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Switch } from '../../components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { ExportFormat } from '../../types';
import { useI18n } from '../../shared/i18n';

interface SettingsPageProps {
  user?: User | null;
  onSignOut?: () => Promise<void>;
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
  onStatus?: (status: any) => void;
}

export default function SettingsPage({ user: userProp, onSignOut: onSignOutProp, onSync: onSyncProp, isSyncing: isSyncingProp, onStatus }: SettingsPageProps) {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(userProp || null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'success' | 'error' | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [cloudEnabled, setCloudEnabled] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [exportTemplate, setExportTemplate] = useState('');
  const [savedSettingsMsg, setSavedSettingsMsg] = useState(false);
  const [groups, setGroups] = useState<Map<string, string[]>>(new Map());
  const [budgetMinutesTotal, setBudgetMinutesTotal] = useState(60);
  const [savedBudgetMsg, setSavedBudgetMsg] = useState(false);
  const [clearKeyword, setClearKeyword] = useState('');

  // C2: React 19 useTransition for non-blocking updates
  const [isPending, startTransition] = useTransition();
  
  // C2: React 19 useOptimistic for optimistic UI updates
  const [optimisticBudget, setOptimisticBudget] = useOptimistic<number>(budgetMinutesTotal);

  useEffect(() => {
    async function loadUserAndSettings() {
      if (!userProp) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } else {
        setUser(userProp);
      }

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['dq_sync_enabled', 'dq_last_sync', 'dq_webhook_url', 'dq_export_template'], (res) => {
          setCloudEnabled(res.dq_sync_enabled !== false);
          if (res.dq_last_sync) {
            setLastSyncTime(new Date(res.dq_last_sync));
          }
          if (res.dq_webhook_url) setWebhookUrl(res.dq_webhook_url);
          if (res.dq_export_template) setExportTemplate(res.dq_export_template);
        });
      }

      setGroups(getChannelGroups());

      const game = getGameState();
      setBudgetMinutesTotal(game?.budgetMinutesTotal || DEFAULT_DAILY_BUDGET);
    }

    loadUserAndSettings();
  }, [userProp]);

  const handleSaveBudget = () => {
    setOptimisticBudget(budgetMinutesTotal);
    startTransition(() => {
      updateGameState({ budgetMinutesTotal });
    });
    setSavedBudgetMsg(true);
    setTimeout(() => setSavedBudgetMsg(false), 2500);
  };

  const handleClearData = () => {
    if (clearKeyword === 'DELETE') {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.clear(() => {
          window.location.reload();
        });
      }
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err: any) {
      setSyncError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      if (onSignOutProp) {
        await onSignOutProp();
      } else {
        await signOut();
      }
      setUser(null);
      setSyncStatus(null);
    } catch (err: any) {
      setSyncError(err.message);
    }
  };

  const handleSync = async () => {
    if (!user) {
      setSyncError('Please sign in first to enable cloud sync.');
      return;
    }

    setSyncing(true);
    setSyncStatus(null);
    setSyncError(null);

    try {
      if (onSyncProp) {
        await onSyncProp();
      } else {
        await syncWithCloud();
      }
      setSyncStatus('success');
      setLastSyncTime(new Date());

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ dq_last_sync: new Date().toISOString() });
      }

      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err: any) {
      setSyncError(err.message || 'Sync failed');
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleSyncEnabled = async (enabled: boolean) => {
    setCloudEnabled(enabled);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ dq_sync_enabled: enabled });
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const videos = getSavedVideos();
      let content, filename, mimeType;

      const items = videos.map((v) => ({
        ...v,
      })) as any[];

      switch (format) {
        case 'markdown':
          content = exportToMarkdown(items, 'My Saved Videos');
          filename = buildExportFilename('markdown', 'videos');
          mimeType = 'text/markdown';
          break;
        case 'csv':
          content = exportToCSV(items);
          filename = buildExportFilename('csv', 'videos');
          mimeType = 'text/csv';
          break;
        case 'json':
          content = exportToJSON(items);
          filename = buildExportFilename('json', 'videos');
          mimeType = 'application/json';
          break;
        case 'notion':
          content = exportToNotion(items);
          filename = buildExportFilename('markdown', 'videos-notion');
          mimeType = 'text/markdown';
          break;
        case 'obsidian':
          content = exportToObsidian(items);
          filename = buildExportFilename('markdown', 'videos-obsidian');
          mimeType = 'text/markdown';
          break;
        default:
          return;
      }

      downloadFile(content, filename, mimeType);
    } catch (err: any) {
      setSyncError(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await createChannelGroup(newGroupName);
      setNewGroupName('');
      setGroups(getChannelGroups());
    } catch (err: any) {
      setSyncError(err.message);
    }
  };

  const handleDeleteGroup = async (groupName: string) => {
    if (!window.confirm(`Delete group "${groupName}"?`)) return;
    try {
      await deleteChannelGroup(groupName);
      setGroups(getChannelGroups());
    } catch (err: any) {
      setSyncError(err.message);
    }
  };

  const isActuallySyncing = syncing || isSyncingProp;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-[var(--dq-text)]">{t('settings.title')}</h2>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{t('auth.signin')}</CardTitle>
          <CardDescription>Manage your sign-in and profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoggedIn(user) ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11">
                  <AvatarImage src={user?.user_metadata?.avatar_url || user?.user_metadata?.picture} alt={getUserName(user) || 'User'} />
                  <AvatarFallback>{(getUserEmail(user)?.[0] || 'U').toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-[var(--dq-text-muted)]">{t('auth.signin')}</p>
                  <p className="text-lg font-medium text-[var(--dq-text)]">{getUserName(user)}</p>
                  <p className="text-sm text-[var(--dq-text-subtle)]">{getUserEmail(user)}</p>
                </div>
              </div>
              <Button variant="destructive" onClick={handleSignOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                {t('action.signout')}
              </Button>
            </div>
          ) : (
            <Button variant="premium" onClick={handleSignIn} className="gap-2">
              <Cloud className="w-4 h-4" />
              {t('auth.google')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Cloud className="w-5 h-5 text-lime-400" /> {t('settings.sync')}</CardTitle>
          <CardDescription>{t('settings.sync')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={cloudEnabled}
              onCheckedChange={handleToggleSyncEnabled}
              disabled={!isLoggedIn(user)}
            />
            <span className="text-[var(--dq-text)] text-sm">{t('settings.sync')}</span>
          </div>

          <Button
            variant="secondary"
            onClick={handleSync}
            disabled={isActuallySyncing || !isLoggedIn(user)}
            loading={isActuallySyncing}
            className="gap-2"
          >
            {!isActuallySyncing && <Cloud className="w-4 h-4" />}
            {isActuallySyncing ? t('toast.synced') : t('action.sync')}
          </Button>

          {syncStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400 text-sm font-medium">
              <Check className="w-4 h-4" />
              {t('toast.synced')}
            </div>
          )}

          {syncError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{syncError}</div>
            </div>
          )}

          {lastSyncTime && (
            <p className="text-xs text-[var(--dq-text-muted)]">{t('settings.sync')}: {lastSyncTime.toLocaleString()}</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('settings.budget')}</CardTitle>
            {(savedBudgetMsg || isPending) && (
              <span className="text-xs text-lime-400 font-medium">
                {savedBudgetMsg ? `✓ ${t('action.save')}` : t('action.save')}
              </span>
            )}
          </div>
          <CardDescription>{t('settings.budget')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="10"
              max="1440"
              value={optimisticBudget}
              onChange={(e) => setBudgetMinutesTotal(parseInt(e.target.value) || 0)}
              className="w-24 text-center"
            />
            <span className="text-sm text-[var(--dq-text-muted)]">{t('settings.budget')}</span>
          </div>
          <Button variant="secondary" onClick={handleSaveBudget}>
            {t('action.save')} {t('settings.budget')}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5 text-lime-400" /> Export Data</CardTitle>
          <CardDescription>Download your saved videos and transcripts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(['markdown', 'csv', 'json', 'notion', 'obsidian'] as ExportFormat[]).map(fmt => (
              <Button
                key={fmt}
                variant="outline"
                onClick={() => handleExport(fmt)}
                disabled={exporting}
                className="capitalize"
              >
                {fmt}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Vault Webhook Integration</CardTitle>
            {savedSettingsMsg && <span className="text-xs text-lime-400 font-medium">âœ“ Saved</span>}
          </div>
          <CardDescription>Push notes directly to your Obsidian or Notion vault.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--dq-text-muted)] uppercase tracking-wider">Webhook URL</label>
            <Input
              type="url"
              placeholder="https://hook.eu1.make.com/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--dq-text-muted)] uppercase tracking-wider flex justify-between">
              <span>Template</span>
              <span className="text-[10px] lowercase normal-case text-[var(--dq-text-subtle)]">{'{{title}}, {{url}}, {{tags}}'}</span>
            </label>
            <textarea
              rows={5}
              placeholder={`---\ntitle: "{{title}}"\nurl: "{{url}}"\ntags: [{{tags}}]\n---\n`}
              value={exportTemplate}
              onChange={(e) => setExportTemplate(e.target.value)}
              className="w-full bg-[var(--dq-surface)] border border-[var(--dq-border)] rounded-xl p-3 text-xs font-mono text-[var(--dq-text)] focus:outline-none focus:border-lime-500/50 transition-colors"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ dq_webhook_url: webhookUrl, dq_export_template: exportTemplate }, () => {
                  setSavedSettingsMsg(true);
                  setTimeout(() => setSavedSettingsMsg(false), 2500);
                });
              }
            }}
          >
            Save Integration
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Folder className="w-5 h-5 text-lime-400" /> Channel Groups</CardTitle>
          <CardDescription>Organize your whitelisted channels.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              placeholder="New group name..."
            />
            <Button onClick={handleCreateGroup}>Create</Button>
          </div>
          {groups.size > 0 ? (
            <div className="space-y-2">
              {Array.from(groups.keys()).map((groupName) => (
                <div key={groupName} className="flex items-center justify-between p-3 rounded-xl bg-[var(--dq-surface)] border border-[var(--dq-border)] hover:border-[var(--dq-lime-border)] transition-colors">
                  <div>
                    <p className="text-[var(--dq-text)] font-medium text-sm">{groupName}</p>
                    <p className="text-xs text-[var(--dq-text-muted)]">{groups.get(groupName)?.length || 0} items</p>
                  </div>
                  <Button variant="ghost" size="xs" onClick={() => handleDeleteGroup(groupName)} className="text-red-400 hover:text-red-300">
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--dq-text-muted)] italic">No groups yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card border-red-500/20 bg-red-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400"><AlertCircle className="w-5 h-5" /> Danger Zone</CardTitle>
          <CardDescription>Permanently delete all your saved videos, settings, and progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-[var(--dq-text-subtle)]">
            This action cannot be undone. To confirm, type <strong>DELETE</strong> below.
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              value={clearKeyword}
              onChange={(e) => setClearKeyword(e.target.value)}
              placeholder="Type DELETE"
              className="border-red-500/20 focus:border-red-500/50"
            />
            <Button 
              onClick={handleClearData} 
              disabled={clearKeyword !== 'DELETE'}
              className={clearKeyword === 'DELETE' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-500/20 text-red-500/50 cursor-not-allowed'}
            >
              Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

