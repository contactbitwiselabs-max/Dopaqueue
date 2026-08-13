import { synchronize } from '@nozbe/watermelondb/sync'
import { database } from './index'
import supabase from '../shared/supabase'

export async function syncDatabase() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      // Fetch changes from Supabase since lastPulledAt
      
      const { data: queueItems, error: queueError } = await supabase
        .from('queue_items')
        .select('*')
        .gt('updated_at', lastPulledAt ? new Date(lastPulledAt).toISOString() : new Date(0).toISOString())
        
      const { data: collections, error: collectionsError } = await supabase
        .from('collections')
        .select('*')
        .gt('updated_at', lastPulledAt ? new Date(lastPulledAt).toISOString() : new Date(0).toISOString())

      if (queueError) throw new Error(queueError.message)
      if (collectionsError) throw new Error(collectionsError.message)

      return {
        changes: {
          queue_items: {
            created: queueItems || [], // For simplicity, pushing all modified to created for now, refine based on true lastPulledAt 
            updated: [],
            deleted: [], // Needs soft delete logic
          },
          collections: {
            created: collections || [],
            updated: [],
            deleted: [],
          }
        } as any,
        timestamp: Date.now(),
      }
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      // Push local changes to Supabase
      const c = changes as any;
      
      // Handle QueueItems
      if (c.queue_items.created.length > 0) {
        await supabase.from('queue_items').insert(c.queue_items.created)
      }
      if (c.queue_items.updated.length > 0) {
        // Handle upserts
        for (const item of c.queue_items.updated) {
           await supabase.from('queue_items').update(item).eq('id', item.id)
        }
      }
      
      // Handle Collections
      if (c.collections.created.length > 0) {
        await supabase.from('collections').insert(c.collections.created)
      }
      if (c.collections.updated.length > 0) {
        for (const item of c.collections.updated) {
           await supabase.from('collections').update(item).eq('id', item.id)
        }
      }
    },
    migrationsEnabledAtVersion: 1,
  })
}
