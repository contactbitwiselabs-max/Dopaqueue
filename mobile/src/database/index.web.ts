import { Database } from '@nozbe/watermelondb'
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

import schema from './schema'
import QueueItem from './models/QueueItem'
import Collection from './models/Collection'

const adapter = new LokiJSAdapter({
  schema,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  onQuotaExceededError: (error) => {
    console.error('Quota exceeded', error)
  },
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
