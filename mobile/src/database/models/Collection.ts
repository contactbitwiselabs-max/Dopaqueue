// @ts-nocheck
import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class Collection extends Model {
  static table = 'collections'

  @field('name') name
  @field('icon') icon
  @field('color') color
  @field('created_at') createdAt
  @field('updated_at') updatedAt
}
