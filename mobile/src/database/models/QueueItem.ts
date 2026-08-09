import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class QueueItem extends Model {
  static table = 'queue_items'

  @field('url') url!: string
  @field('title') title!: string
  @field('thumbnail') thumbnail?: string
  @field('saved_at') savedAt!: number
  @field('type') type?: string
  @field('urgency') urgency?: string
  @field('note') note?: string
  @field('watched') watched!: boolean
  @field('channel_name') channelName?: string
  @field('author') author?: string
  @field('platform') platform?: string
  @field('deleted') deleted!: boolean
  @field('collection') collection?: string
  @field('expiry_date') expiryDate?: number
}
