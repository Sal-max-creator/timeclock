import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(server: Server, app: Express) {
  // --- Employees ---
  app.get("/api/employees", async (_req, res) => {
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  app.post("/api/employees", async (req, res) => {
    const { name, pin } = req.body;
    if (!name || !pin) {
      return res.status(400).json({ message: "Name and PIN are required" });
    }
    if (pin.length < 4 || pin.length > 6) {
      return res.status(400).json({ message: "PIN must be 4-6 digits" });
    }
    // Check for duplicate PIN
    const existing = await storage.getEmployeeByPin(pin);
    if (existing) {
      return res.status(400).json({ message: "PIN already in use" });
    }
    const employee = await storage.createEmployee({ name, pin, isActive: true });
    res.status(201).json(employee);
  });

  app.put("/api/employees/:id", async (req, res) => {
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

  app.delete("/api/employees/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteEmployee(id);
    if (!deleted) return res.status(404).json({ message: "Employee not found" });
    res.json({ success: true });
  });

  // --- Clock In/Out ---
  app.post("/api/clock", async (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: "PIN is required" });

    const employee = await storage.getEmployeeByPin(pin);
    if (!employee) return res.status(404).json({ message: "Invalid PIN" });

    if (employee.isClockedIn) {
      // Clock out
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
      // Clock in
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

  // --- Time entries ---
  app.get("/api/time-entries", async (req, res) => {
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

  // --- Status ---
  app.get("/api/status", async (_req, res) => {
    const employees = await storage.getEmployees();
    const clockedIn = employees.filter(e => e.isClockedIn);
    const clockedOut = employees.filter(e => !e.isClockedIn);
    res.json({ clockedIn, clockedOut, total: employees.length });
  });
}
