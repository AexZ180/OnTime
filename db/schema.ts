import {sqliteTable,text,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const calendars=sqliteTable('calendars',{id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),color:text('color').notNull()},t=>[index('calendars_owner').on(t.owner)]);
export const events=sqliteTable('events',{id:text('id').primaryKey(),owner:text('owner').notNull(),calendar:text('calendar').notNull(),data:text('data').notNull(),token:text('token').notNull()},t=>[index('events_owner').on(t.owner),uniqueIndex('events_token').on(t.token)]);
export const profiles=sqliteTable('profiles',{owner:text('owner').primaryKey(),name:text('name').notNull(),birthday:text('birthday').notNull().default('')});
export const responses=sqliteTable('responses',{event:text('event').notNull(),user:text('user').notNull(),name:text('name').notNull(),status:text('status').notNull()},t=>[uniqueIndex('responses_event_user').on(t.event,t.user)]);
