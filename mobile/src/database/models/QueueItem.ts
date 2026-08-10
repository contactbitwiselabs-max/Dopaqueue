// @ts-nocheck
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class QueueItem extends Model {
  static table = 'queue_items'

  @field('url') url
  @field('title') title
  @field('thumbnail') thumbnail
  @field('saved_at') savedAt
  @field('type') type
  @field('urgency') urgency
  @field('note') note
  @field('watched') watched
  @field('channel_name') channelName
  @field('author') author
  @field('platform') platform
  @field('deleted') deleted
  @field('collection') collection
  @field('expiry_date') expiryDate
}
