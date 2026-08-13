// @ts-nocheck
import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class Collection extends Model {
  static table = 'collections'

  @field('name') name
  @field('icon') icon
  @field('color') color
  @field('cover_image') coverImage
  @field('parent_id') parentId
  @field('is_smart') isSmart
  @field('filter_rules') filterRules
  @date('created_at') createdAt
  @date('updated_at') updatedAt
}
