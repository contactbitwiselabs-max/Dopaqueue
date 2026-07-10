// @ts-nocheck
import React, { useEffect, useState } from 'react';
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
import { exportToMarkdown, exportToCSV, exportToJSON, exportToNotion, downloadFile, buildExportFilename } from '../../shared/export';
import { getSavedVideos, getSavedChannels, getGameState, updateGameState } from '../../shared/storage';
import { DEFAULT_DAILY_BUDGET } from '../../shared/constants';
import { getChannelGroups, createChannelGroup, deleteChannelGroup } from '../../shared/groups';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { ExportFormat } from '../../types';

interface SettingsPageProps {
  user?: User | null;
  onSignOut?: () => Promise<void>;
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
  onStatus?: (status: any) => void;
}

export default function SettingsPage({ user: userProp, onSignOut: onSignOutProp, onSync: onSyncProp, isSyncing: isSyncingProp, onStatus }: SettingsPageProps) {
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
    updateGameState({ budgetMinutesTotal });
    setSavedBudgetMsg(true);
    setTimeout(() => setSavedBudgetMsg(false), 2500);
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
        <h2 className="text-3xl font-bold text-[var(--dq-text)]">Settings</h2>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your sign-in and profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoggedIn(user) ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--dq-text-muted)]">Logged in as</p>
                <p className="text-lg font-medium text-[var(--dq-text)]">{getUserName(user)}</p>
                <p className="text-sm text-[var(--dq-text-subtle)]">{getUserEmail(user)}</p>
              </div>
              <Button variant="destructive" onClick={handleSignOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Button variant="premium" onClick={handleSignIn} className="gap-2">
              <Cloud className="w-4 h-4" />
              Sign In with Google
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Cloud className="w-5 h-5 text-lime-400" /> Cloud Sync</CardTitle>
          <CardDescription>Sync your queue across devices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={cloudEnabled}
              onCheckedChange={handleToggleSyncEnabled}
              disabled={!isLoggedIn(user)}
            />
            <span className="text-[var(--dq-text)] text-sm">Enable cloud backup and sync</span>
          </div>

          <Button
            variant="secondary"
            onClick={handleSync}
            disabled={isActuallySyncing || !isLoggedIn(user)}
            loading={isActuallySyncing}
            className="gap-2"
          >
            {!isActuallySyncing && <Cloud className="w-4 h-4" />}
            {isActuallySyncing ? 'Syncing...' : 'Sync Now'}
          </Button>

          {syncStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400 text-sm font-medium">
              <Check className="w-4 h-4" />
              Synced successfully!
            </div>
          )}

          {syncError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{syncError}</div>
            </div>
          )}

          {lastSyncTime && (
            <p className="text-xs text-[var(--dq-text-muted)]">Last synced: {lastSyncTime.toLocaleString()}</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daily Scroll Limit</CardTitle>
            {savedBudgetMsg && <span className="text-xs text-lime-400 font-medium">✓ Saved</span>}
          </div>
          <CardDescription>Adjust your daily scrolling budget in minutes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="10"
              max="1440"
              value={budgetMinutesTotal}
              onChange={(e) => setBudgetMinutesTotal(parseInt(e.target.value) || 0)}
              className="w-24 text-center"
            />
            <span className="text-sm text-[var(--dq-text-muted)]">minutes / day</span>
          </div>
          <Button variant="secondary" onClick={handleSaveBudget}>
            Update Limit
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5 text-lime-400" /> Export Data</CardTitle>
          <CardDescription>Download your saved videos and transcripts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['markdown', 'csv', 'json', 'notion'] as ExportFormat[]).map(fmt => (
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
    </div>
  );
}

