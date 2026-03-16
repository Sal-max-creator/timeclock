import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  ArrowLeft,
  Clock,
  Plus,
  Trash2,
  Users,
  LogIn,
  LogOut,
  Timer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import type { Employee, TimeEntry } from "@shared/schema";

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage() {
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: timeEntries = [], isLoading: loadingEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries"],
  });

  const { data: status } = useQuery<{
    clockedIn: Employee[];
    clockedOut: Employee[];
    total: number;
  }>({
    queryKey: ["/api/status"],
    refetchInterval: 10000,
  });

  const addEmployeeMutation = useMutation({
    mutationFn: async (data: { name: string; pin: string }) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
      setNewName("");
      setNewPin("");
      setDialogOpen(false);
      toast({ title: "Employee added" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
      toast({ title: "Employee removed" });
    },
  });

  const handleAddEmployee = () => {
    if (!newName.trim() || !newPin.trim()) return;
    addEmployeeMutation.mutate({ name: newName.trim(), pin: newPin.trim() });
  };

  // Calculate today's entries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEntries = timeEntries.filter(
    (e) => new Date(e.clockIn) >= today
  );

  // Sort entries newest first
  const sortedEntries = [...timeEntries].sort(
    (a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()
  );

  // Calculate total hours per employee for today
  const employeeHoursToday = new Map<number, number>();
  todayEntries.forEach((entry) => {
    const clockOut = entry.clockOut
      ? new Date(entry.clockOut).getTime()
      : Date.now();
    const duration = clockOut - new Date(entry.clockIn).getTime();
    const current = employeeHoursToday.get(entry.employeeId) || 0;
    employeeHoursToday.set(entry.employeeId, current + duration);
  });

  const getEmployeeName = (id: number): string => {
    const emp = employees.find((e) => e.id === id);
    return emp?.name || `Employee #${id}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Kiosk
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">TimeClock Admin</span>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total">
                    {status?.total || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p
                    className="text-2xl font-bold text-emerald-600 dark:text-emerald-400"
                    data-testid="stat-in"
                  >
                    {status?.clockedIn.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Clocked In</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p
                    className="text-2xl font-bold text-amber-600 dark:text-amber-400"
                    data-testid="stat-out"
                  >
                    {status?.clockedOut.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Clocked Out</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Employees</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="add-employee-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Employee</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="John Smith"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pin">PIN (4-6 digits)</Label>
                    <Input
                      id="pin"
                      type="password"
                      placeholder="1234"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setNewPin(val);
                      }}
                      data-testid="input-pin"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleAddEmployee}
                    disabled={
                      !newName.trim() ||
                      newPin.length < 4 ||
                      addEmployeeMutation.isPending
                    }
                    data-testid="confirm-add-btn"
                  >
                    {addEmployeeMutation.isPending
                      ? "Adding..."
                      : "Add Employee"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingEmployees ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : employees.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Users className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No employees yet. Add your first employee to get started.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Today's Hours</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id} data-testid={`employee-row-${emp.id}`}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>
                        {emp.isClockedIn ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                            Out
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {employeeHoursToday.has(emp.id)
                          ? formatDuration(employeeHoursToday.get(emp.id)!)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEmployeeMutation.mutate(emp.id)}
                          data-testid={`delete-employee-${emp.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Time Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Time Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEntries ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : sortedEntries.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No time entries yet.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.slice(0, 50).map((entry) => {
                    const clockOutTime = entry.clockOut
                      ? new Date(entry.clockOut).getTime()
                      : null;
                    const duration = clockOutTime
                      ? clockOutTime - new Date(entry.clockIn).getTime()
                      : Date.now() - new Date(entry.clockIn).getTime();

                    return (
                      <TableRow key={entry.id} data-testid={`entry-row-${entry.id}`}>
                        <TableCell className="font-medium">
                          {getEmployeeName(entry.employeeId)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(entry.clockIn)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatTime(entry.clockIn)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {entry.clockOut ? (
                            formatTime(entry.clockOut)
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                              Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatDuration(duration)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="border-t px-6 py-3 flex items-center justify-center">
        <PerplexityAttribution />
      </footer>
    </div>
  );
}
