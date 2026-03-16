import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pin: text("pin").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isClockedIn: boolean("is_clocked_in").notNull().default(false),
});

export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  clockIn: timestamp("clock_in").notNull(),
  clockOut: timestamp("clock_out"),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  isClockedIn: true,
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
