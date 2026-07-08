import React, { useEffect, useState } from 'react';
import { LogOut, Cloud, Download, Folder, AlertCircle, Check } from 'lucide-react';
import {
  getCurrentUser,
  signOut,
  signInWithGoogle,
  isLoggedIn,
  getUserEmail,
  getUserName,
} from '../../shared/auth.js';
import { syncWithCloud } from '../../shared/sync.js';
import { exportToMarkdown, exportToCSV, exportToJSON, exportToNotion, downloadFile, buildExportFilename } from '../../shared/export.js';
import { getQueue, getSavedVideos, getSavedChannels } from '../../shared/storage.js';
import { getChannelGroups, createChannelGroup, deleteChannelGroup } from '../../shared/groups.js';

export default function SettingsPage({ user: userProp, onSignOut: onSignOutProp, onSync: onSyncProp, isSyncing: isSyncingProp, onStatus }) {
  const [user, setUser] = useState(userProp || null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // 'success' | 'error' | null
  const [syncError, setSyncError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [cloudEnabled, setCloudEnabled] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [exportTemplate, setExportTemplate] = useState('');
  const [savedSettingsMsg, setSavedSettingsMsg] = useState(false);

  useEffect(() => {
    async function loadUserAndSettings() {
      // If parent passed a user prop, prefer it (avoids duplicate auth lookups)
      if (!userProp) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      }

      // Load sync settings from chrome.storage
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

      // Load groups
      setGroups(getChannelGroups());
    }

    loadUserAndSettings();
  }, [userProp]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      setSyncError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      // Prefer the parent's handler (which also clears dashboard state)
      if (onSignOutProp) {
        await onSignOutProp();
      } else {
        await signOut();
      }
      setUser(null);
      setSyncStatus(null);
    } catch (err) {
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
      // Prefer the parent's sync handler so the dashboard's spinner
      // and toast stay in sync with the settings page.
      if (onSyncProp) {
        await onSyncProp();
      } else {
        await syncWithCloud();
      }
      setSyncStatus('success');
      setLastSyncTime(new Date());

      // Persist sync time
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ dq_last_sync: new Date().toISOString() });
      }

      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      setSyncError(err.message || 'Sync failed');
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleSyncEnabled = async (enabled) => {
    setCloudEnabled(enabled);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ dq_sync_enabled: enabled });
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const videos = getSavedVideos();
      let content, filename, mimeType;

      // Merge videos with their cached scrape data for transcript/channel
      const items = videos.map((v) => ({
        ...v,
        // transcript and channel would be populated from scrape_cache in real implementation
      }));

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
    } catch (err) {
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
    } catch (err) {
      setSyncError(err.message);
    }
  };

  const handleDeleteGroup = async (groupName) => {
    if (!window.confirm(`Delete group "${groupName}"?`)) return;
    try {
      await deleteChannelGroup(groupName);
      setGroups(getChannelGroups());
    } catch (err) {
      setSyncError(err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-white">Settings</h1>

      {/* Auth Section */}
      <section className="bg-zinc-900/50 rounded-xl p-6 border border-white/5">
        <h2 className="text-xl font-semibold text-white mb-4">Account</h2>

        {isLoggedIn(user) ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Logged in as</p>
                <p className="text-lg font-medium text-white">{getUserName(user)}</p>
                <p className="text-sm text-zinc-500">{getUserEmail(user)}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors"
          >
            <Cloud className="w-4 h-4" />
            Sign In with Google
          </button>
        )}
      </section>

      {/* Cloud Sync Section */}
      <section className="bg-zinc-900/50 rounded-xl p-6 border border-white/5">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Cloud className="w-5 h-5" /> Cloud Sync
        </h2>

        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={cloudEnabled}
              onChange={(e) => handleToggleSyncEnabled(e.target.checked)}
              disabled={!isLoggedIn(user)}
              className="w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-white text-sm">Enable cloud backup and sync</span>
          </label>

          <button
            onClick={handleSync}
            disabled={syncing || !isLoggedIn(user)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                Sync Now
              </>
            )}
          </button>

          {syncStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <Check className="w-4 h-4" />
              Synced successfully!
            </div>
          )}

          {syncError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{syncError}</div>
            </div>
          )}

          {lastSyncTime && (
            <p className="text-xs text-zinc-400">Last synced: {lastSyncTime.toLocaleString()}</p>
          )}
        </div>
      </section>

      {/* Export Section */}
      <section className="bg-zinc-900/50 rounded-xl p-6 border border-white/5">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" /> Export Data
        </h2>

        <p className="text-sm text-zinc-400 mb-4">Download your saved videos and transcripts</p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleExport('markdown')}
            disabled={exporting}
            className="px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm transition-colors disabled:opacity-50"
          >
            📄 Markdown
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm transition-colors disabled:opacity-50"
          >
            📊 CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm transition-colors disabled:opacity-50"
          >
            🔗 JSON
          </button>
          <button
            onClick={() => handleExport('notion')}
            disabled={exporting}
            className="px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm transition-colors disabled:opacity-50"
          >
            💼 Notion
          </button>
        </div>
      </section>

      {/* Vault Webhook & Template Customizer Section */}
      <section className="bg-zinc-900/50 rounded-xl p-6 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            🔗 Vault Two-Way Sync Webhook & Export Templates
          </h2>
          {savedSettingsMsg && (
            <span className="text-xs text-green-400 font-medium">✓ Vault settings saved</span>
          )}
        </div>
        <p className="text-sm text-zinc-400">
          Configure a custom Webhook URL (Notion API / Obsidian Local REST API / Zapier) and YAML Frontmatter template to push notes directly to your vault.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Webhook URL</label>
          <input
            type="url"
            placeholder="https://hook.eu1.make.com/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Custom Markdown / YAML Frontmatter Template</label>
            <span className="text-[11px] text-zinc-500">Placeholders: &#123;&#123;title&#125;&#125;, &#123;&#123;url&#125;&#125;, &#123;&#123;tags&#125;&#125;, &#123;&#123;summary&#125;&#125;, &#123;&#123;actions&#125;&#125;</span>
          </div>
          <textarea
            rows={5}
            placeholder={`---\ntitle: "{{title}}"\nurl: "{{url}}"\ntags: [{{tags}}]\n---\n# {{title}}\n\n## Summary\n{{summary}}\n\n## Action Checklist\n{{actions}}`}
            value={exportTemplate}
            onChange={(e) => setExportTemplate(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-purple-500"
          />
        </div>

        <button
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
              chrome.storage.local.set({ dq_webhook_url: webhookUrl, dq_export_template: exportTemplate }, () => {
                setSavedSettingsMsg(true);
                setTimeout(() => setSavedSettingsMsg(false), 2500);
              });
            }
          }}
          className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-semibold text-xs transition-colors"
        >
          Save Vault Settings
        </button>
      </section>

      {/* Channel Groups Section */}
      <section className="bg-zinc-900/50 rounded-xl p-6 border border-white/5">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Folder className="w-5 h-5" /> Channel Groups
        </h2>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
              placeholder="New group name..."
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleCreateGroup}
              className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm transition-colors"
            >
              Create
            </button>
          </div>

          {groups.size > 0 ? (
            <div className="space-y-2">
              {Array.from(groups.keys()).map((groupName) => (
                <div key={groupName} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-white/5">
                  <div>
                    <p className="text-white font-medium">{groupName}</p>
                    <p className="text-xs text-zinc-400">{groups.get(groupName).length} items</p>
                  </div>
                  <button
                    onClick={() => handleDeleteGroup(groupName)}
                    className="text-red-400 hover:text-red-300 text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No groups yet. Create one to organize your channels!</p>
          )}
        </div>
      </section>

      {/* Data Section */}
      <section className="bg-zinc-900/50 rounded-xl p-6 border border-white/5">
        <h2 className="text-xl font-semibold text-white mb-4">Data</h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-zinc-800">
            <p className="text-2xl font-bold text-white">{getSavedVideos().length}</p>
            <p className="text-xs text-zinc-400">Videos Saved</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800">
            <p className="text-2xl font-bold text-white">{getSavedChannels().length}</p>
            <p className="text-xs text-zinc-400">Channels Saved</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800">
            <p className="text-2xl font-bold text-white">{groups.size}</p>
            <p className="text-xs text-zinc-400">Groups</p>
          </div>
        </div>
      </section>
    </div>
  );
}
