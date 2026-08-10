// @ts-nocheck
import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class Collection extends Model {
  static table = 'collections'

  @field('name') name!: string;
  @field('icon') icon?: string;
  @field('cover_image') coverImage?: string;
  @field('parent_id') parentId?: string;
  @field('is_smart') isSmart?: boolean;
  @field('filter_rules') filterRules?: string;
  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
