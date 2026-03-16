import type { Employee, InsertEmployee, TimeEntry, InsertTimeEntry } from "@shared/schema";
import Database from "better-sqlite3";
import path from "path";

export interface IStorage {
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByPin(pin: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<boolean>;
  setClockStatus(id: number, isClockedIn: boolean): Promise<Employee | undefined>;
  getTimeEntries(employeeId?: number): Promise<TimeEntry[]>;
  getTimeEntriesByDateRange(start: Date, end: Date, employeeId?: number): Promise<TimeEntry[]>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  getActiveEntry(employeeId: number): Promise<TimeEntry | undefined>;
}

function toEmployee(row: any): Employee {
  return {
    id: row.id,
    name: row.name,
    pin: row.pin,
    isActive: row.is_active === 1,
    isClockedIn: row.is_clocked_in === 1,
  };
}

function toTimeEntry(row: any): TimeEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    clockIn: new Date(row.clock_in),
    clockOut: row.clock_out ? new Date(row.clock_out) : null,
  };
}

export class SqliteStorage implements IStorage {
  private db: Database.Database;

  constructor() {
    const dbPath = path.resolve(process.cwd(), "timeclock.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pin TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_clocked_in INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        clock_in TEXT NOT NULL,
        clock_out TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );
    `);
  }

  async getEmployees(): Promise<Employee[]> {
    const rows = this.db.prepare("SELECT * FROM employees WHERE is_active = 1").all();
    return rows.map(toEmployee);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const row = this.db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
    return row ? toEmployee(row) : undefined;
  }

  async getEmployeeByPin(pin: string): Promise<Employee | undefined> {
    const row = this.db.prepare("SELECT * FROM employees WHERE pin = ? AND is_active = 1").get(pin);
    return row ? toEmployee(row) : undefined;
  }

  async createEmployee(data: InsertEmployee): Promise<Employee> {
    const stmt = this.db.prepare("INSERT INTO employees (name, pin, is_active, is_clocked_in) VALUES (?, ?, 1, 0)");
    const result = stmt.run(data.name, data.pin);
    return (await this.getEmployee(result.lastInsertRowid as number))!;
  }

  async updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const existing = await this.getEmployee(id);
    if (!existing) return undefined;

    const name = data.name ?? existing.name;
    const pin = data.pin ?? existing.pin;
    this.db.prepare("UPDATE employees SET name = ?, pin = ? WHERE id = ?").run(name, pin, id);
    return this.getEmployee(id);
  }

  async deleteEmployee(id: number): Promise<boolean> {
    const result = this.db.prepare("UPDATE employees SET is_active = 0 WHERE id = ? AND is_active = 1").run(id);
    return result.changes > 0;
  }

  async setClockStatus(id: number, isClockedIn: boolean): Promise<Employee | undefined> {
    this.db.prepare("UPDATE employees SET is_clocked_in = ? WHERE id = ?").run(isClockedIn ? 1 : 0, id);
    return this.getEmployee(id);
  }

  async getTimeEntries(employeeId?: number): Promise<TimeEntry[]> {
    let rows;
    if (employeeId) {
      rows = this.db.prepare("SELECT * FROM time_entries WHERE employee_id = ? ORDER BY clock_in DESC").all(employeeId);
    } else {
      rows = this.db.prepare("SELECT * FROM time_entries ORDER BY clock_in DESC").all();
    }
    return rows.map(toTimeEntry);
  }

  async getTimeEntriesByDateRange(start: Date, end: Date, employeeId?: number): Promise<TimeEntry[]> {
    const startStr = start.toISOString();
    const endStr = end.toISOString();
    let rows;
    if (employeeId) {
      rows = this.db.prepare("SELECT * FROM time_entries WHERE clock_in >= ? AND clock_in <= ? AND employee_id = ? ORDER BY clock_in DESC").all(startStr, endStr, employeeId);
    } else {
      rows = this.db.prepare("SELECT * FROM time_entries WHERE clock_in >= ? AND clock_in <= ? ORDER BY clock_in DESC").all(startStr, endStr);
    }
    return rows.map(toTimeEntry);
  }

  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    const clockIn = data.clockIn instanceof Date ? data.clockIn.toISOString() : data.clockIn;
    const clockOut = data.clockOut ? (data.clockOut instanceof Date ? data.clockOut.toISOString() : data.clockOut) : null;
    const result = this.db.prepare("INSERT INTO time_entries (employee_id, clock_in, clock_out) VALUES (?, ?, ?)").run(data.employeeId, clockIn, clockOut);
    const row = this.db.prepare("SELECT * FROM time_entries WHERE id = ?").get(result.lastInsertRowid as number);
    return toTimeEntry(row);
  }

  async updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const existing = this.db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as any;
    if (!existing) return undefined;

    const clockOut = data.clockOut ? (data.clockOut instanceof Date ? data.clockOut.toISOString() : data.clockOut) : existing.clock_out;
    this.db.prepare("UPDATE time_entries SET clock_out = ? WHERE id = ?").run(clockOut, id);
    const row = this.db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id);
    return row ? toTimeEntry(row) : undefined;
  }

  async getActiveEntry(employeeId: number): Promise<TimeEntry | undefined> {
    const row = this.db.prepare("SELECT * FROM time_entries WHERE employee_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1").get(employeeId);
    return row ? toTimeEntry(row) : undefined;
  }
}

export const storage = new SqliteStorage();
