import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Clock, LogIn, LogOut, Settings, CheckCircle2, XCircle, Delete } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import tritonLogo from "@assets/triton-logo.png";
import type { Employee } from "@shared/schema";

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center" data-testid="live-clock">
      <div className="text-5xl font-bold tracking-tight tabular-nums">
        {time.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })}
      </div>
      <div className="text-sm text-muted-foreground mt-1">
        {time.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
    </div>
  );
}

type ClockResult = {
  action: "clock_in" | "clock_out";
  employee: Employee;
  message: string;
};

export default function KioskPage() {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<ClockResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status } = useQuery<{
    clockedIn: Employee[];
    clockedOut: Employee[];
    total: number;
  }>({
    queryKey: ["/api/status"],
    refetchInterval: 10000,
  });

  const clockMutation = useMutation({
    mutationFn: async (pinCode: string) => {
      const res = await apiRequest("POST", "/api/clock", { pin: pinCode });
      return res.json() as Promise<ClockResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setPin("");
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
      setTimeout(() => setResult(null), 4000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Invalid PIN",
        variant: "destructive",
      });
      setPin("");
    },
  });

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length < 6) {
        setPin((prev) => prev + digit);
      }
    },
    [pin]
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (pin.length >= 4) {
      clockMutation.mutate(pin);
    }
  }, [pin, clockMutation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (result) {
        setResult(null);
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter") {
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit, handleBackspace, handleSubmit, result]);

  if (result) {
    const isClockIn = result.action === "clock_in";
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-8 transition-colors ${
          isClockIn
            ? "bg-emerald-50 dark:bg-emerald-950/30"
            : "bg-amber-50 dark:bg-amber-950/30"
        }`}
        onClick={() => setResult(null)}
        data-testid="result-overlay"
      >
        <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          {isClockIn ? (
            <CheckCircle2 className="w-24 h-24 text-emerald-500 mx-auto" />
          ) : (
            <LogOut className="w-24 h-24 text-amber-500 mx-auto" />
          )}
          <div>
            <h1 className="text-3xl font-bold" data-testid="result-name">
              {result.employee.name}
            </h1>
            <p
              className={`text-xl mt-2 font-medium ${
                isClockIn
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
              data-testid="result-action"
            >
              {isClockIn ? "Clocked In" : "Clocked Out"}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={tritonLogo} alt="Triton Construction" className="h-9 object-contain" />
          <span className="font-semibold text-lg" data-testid="app-title">
            TimeClock
          </span>
        </div>
        <Link href="/admin">
          <Button variant="ghost" size="sm" data-testid="admin-link">
            <Settings className="w-4 h-4 mr-2" />
            Admin
          </Button>
        </Link>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
          <LiveClock />

          <div className="w-full max-w-xs space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3 font-medium">
                Enter your PIN
              </p>
              <div
                className="flex justify-center gap-3"
                data-testid="pin-display"
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-150 ${
                      i < pin.length
                        ? "bg-primary scale-110"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3" data-testid="number-pad">
              {digits.map((digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  className="h-16 text-xl font-semibold hover-elevate"
                  onClick={() => handleDigit(digit)}
                  data-testid={`digit-${digit}`}
                >
                  {digit}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-16"
                onClick={handleBackspace}
                data-testid="backspace-btn"
              >
                <Delete className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                className="h-16 text-xl font-semibold hover-elevate"
                onClick={() => handleDigit("0")}
                data-testid="digit-0"
              >
                0
              </Button>
              <Button
                className="h-16 text-base font-semibold"
                onClick={handleSubmit}
                disabled={pin.length < 4 || clockMutation.isPending}
                data-testid="submit-btn"
              >
                {clockMutation.isPending ? (
                  <span className="animate-spin">...</span>
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l bg-card p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Who's In
          </h2>
          {status && status.clockedIn.length > 0 ? (
            <div className="space-y-2 mb-6">
              {status.clockedIn.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30"
                  data-testid={`status-in-${emp.id}`}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium">{emp.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-6">
              No one clocked in
            </p>
          )}

          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Who's Out
          </h2>
          {status && status.clockedOut.length > 0 ? (
            <div className="space-y-2">
              {status.clockedOut.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50"
                  data-testid={`status-out-${emp.id}`}
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                  <span className="text-sm text-muted-foreground">
                    {emp.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {status?.total === 0
                ? "No employees added yet"
                : "Everyone is clocked in"}
            </p>
          )}
        </aside>
      </main>

    </div>
  );
}
