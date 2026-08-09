import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './schema'
import QueueItem from './models/QueueItem'
import Collection from './models/Collection'

const adapter = new SQLiteAdapter({
  schema,
  // (You might want to add migrations here later)
  jsi: true, // Use JSI for maximum performance
  onSetUpError: error => {
    console.error("Database setup failed", error)
  }
})

export const database = new Database({
  adapter,
  modelClasses: [
    QueueItem,
    Collection,
  ],
})
