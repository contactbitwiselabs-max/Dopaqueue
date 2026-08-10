import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'queue_items',
      columns: [
        { name: 'url', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'thumbnail', type: 'string', isOptional: true },
        { name: 'saved_at', type: 'number' },
        { name: 'type', type: 'string', isOptional: true },
        { name: 'urgency', type: 'string', isOptional: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'watched', type: 'boolean' },
        { name: 'channel_name', type: 'string', isOptional: true },
        { name: 'author', type: 'string', isOptional: true },
        { name: 'platform', type: 'string', isOptional: true },
        { name: 'deleted', type: 'boolean' },
        { name: 'collection', type: 'string', isOptional: true },
        { name: 'expiry_date', type: 'number', isOptional: true },
        { name: 'is_pinned', type: 'boolean', isOptional: true },
        { name: 'tags', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'collections',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'icon', type: 'string', isOptional: true },
        { name: 'color', type: 'string', isOptional: true },
        { name: 'cover_image', type: 'string', isOptional: true },
        { name: 'parent_id', type: 'string', isOptional: true },
        { name: 'is_smart', type: 'boolean', isOptional: true },
        { name: 'filter_rules', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    })
  ]
})
