import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  username: text('username').primaryKey().notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
});

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey().notNull(),
  user: text('user').notNull(),
  message: text('message').notNull(),
  mediaType: text('media_type', { enum: ['image', 'video'] }).notNull(),
  objectKey: text('object_key').notNull(),
  contentType: text('content_type').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_posts_object_key').on(table.objectKey),
  index('idx_posts_user_created').on(table.user, table.createdAt),
  index('idx_posts_created').on(table.createdAt),
]);
