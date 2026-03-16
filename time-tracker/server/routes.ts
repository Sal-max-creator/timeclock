import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Triton4139";

// Track admin sessions by a simple token
const adminTokens = new Set<string>();

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-admin-token"] as string;
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(server: Server, app: Express) {
  // --- Admin Auth ---
  app.post("/api/admin/login", async (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      const token = generateToken();
      adminTokens.add(token);
      return res.json({ success: true, token });
    }
    return res.status(401).json({ message: "Wrong password" });
  });

  app.post("/api/admin/logout", async (req, res) => {
    const token = req.headers["x-admin-token"] as string;
    if (token) adminTokens.delete(token);
    res.json({ success: true });
  });

  app.get("/api/admin/verify", async (req, res) => {
    const token = req.headers["x-admin-token"] as string;
    if (token && adminTokens.has(token)) {
      return res.json({ authenticated: true });
    }
    return res.status(401).json({ authenticated: false });
  });

  // --- Employees (admin-protected) ---
  app.get("/api/employees", requireAdmin, async (_req, res) => {
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  app.post("/api/employees", requireAdmin, async (req, res) => {
    const { name, pin } = req.body;
    if (!name || !pin) {
      return res.status(400).json({ message: "Name and PIN are required" });
    }
    if (pin.length < 4 || pin.length > 6) {
      return res.status(400).json({ message: "PIN must be 4-6 digits" });
    }
    const existing = await storage.getEmployeeByPin(pin);
    if (existing) {
      return res.status(400).json({ message: "PIN already in use" });
    }
    const employee = await storage.createEmployee({ name, pin, isActive: true });
    res.status(201).json(employee);
  });

  app.put("/api/employees/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, pin } = req.body;
    if (pin) {
      const existing = await storage.getEmployeeByPin(pin);
      if (existing && existing.id !== id) {
        return res.status(400).json({ message: "PIN already in use" });
      }
    }
    const updated = await storage.updateEmployee(id, { name, pin });
    if (!updated) return res.status(404).json({ message: "Employee not found" });
    res.json(updated);
  });

  app.delete("/api/employees/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteEmployee(id);
    if (!deleted) return res.status(404).json({ message: "Employee not found" });
    res.json({ success: true });
  });

  // --- Time entries (admin-protected) ---
  app.get("/api/time-entries", requireAdmin, async (req, res) => {
    const { start, end, employeeId } = req.query;
    const empId = employeeId ? parseInt(employeeId as string) : undefined;

    if (start && end) {
      const entries = await storage.getTimeEntriesByDateRange(
        new Date(start as string),
        new Date(end as string),
        empId
      );
      res.json(entries);
    } else {
      const entries = await storage.getTimeEntries(empId);
      res.json(entries);
    }
  });

  // --- Clock In/Out (public - employees use this) ---
  app.post("/api/clock", async (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: "PIN is required" });

    const employee = await storage.getEmployeeByPin(pin);
    if (!employee) return res.status(404).json({ message: "Invalid PIN" });

    if (employee.isClockedIn) {
      const activeEntry = await storage.getActiveEntry(employee.id);
      if (activeEntry) {
        await storage.updateTimeEntry(activeEntry.id, { clockOut: new Date() });
      }
      await storage.setClockStatus(employee.id, false);
      const updatedEmployee = await storage.getEmployee(employee.id);
      return res.json({
        action: "clock_out",
        employee: updatedEmployee,
        message: `${employee.name} clocked out`,
      });
    } else {
      await storage.createTimeEntry({
        employeeId: employee.id,
        clockIn: new Date(),
        clockOut: null,
      });
      await storage.setClockStatus(employee.id, true);
      const updatedEmployee = await storage.getEmployee(employee.id);
      return res.json({
        action: "clock_in",
        employee: updatedEmployee,
        message: `${employee.name} clocked in`,
      });
    }
  });

  // --- Status (public - kiosk displays this) ---
  app.get("/api/status", async (_req, res) => {
    const employees = await storage.getEmployees();
    const clockedIn = employees.filter(e => e.isClockedIn);
    const clockedOut = employees.filter(e => !e.isClockedIn);
    res.json({ clockedIn, clockedOut, total: employees.length });
  });
}
