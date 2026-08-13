import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import { schema } from './schema'
import QueueItem from './models/QueueItem'
import Collection from './models/Collection'

const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
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

const PRESET_COLLECTIONS = [
  { name: 'Learn & Grow',    icon: 'brain',   color: '#7C3AED' },
  { name: 'Entertainment',   icon: 'popcorn', color: '#DC2626' },
  { name: 'Coding',          icon: 'code',    color: '#2563EB' },
  { name: 'Books & Articles',icon: 'book',    color: '#9333EA' },
  { name: 'Ideas & Inspiration', icon: 'idea', color: '#D97706' },
  { name: 'Work & Career',   icon: 'work',    color: '#0D9488' },
];

export async function seedDatabase() {
  const collectionsCount = await database.collections.get<Collection>('collections').query().fetchCount();
  
  if (collectionsCount === 0) {
    await database.write(async () => {
      for (const preset of PRESET_COLLECTIONS) {
        await database.collections.get<Collection>('collections').create(c => {
          c.name = preset.name;
          c.color = preset.color;
          (c as any).icon = preset.icon;
        });
      }
    });
  }
}
