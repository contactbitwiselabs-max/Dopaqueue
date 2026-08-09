import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class Collection extends Model {
  static table = 'collections'

  @field('name') name!: string
  @field('icon') icon?: string
  @field('color') color?: string
  @field('created_at') createdAt!: number
  @field('updated_at') updatedAt!: number
}
