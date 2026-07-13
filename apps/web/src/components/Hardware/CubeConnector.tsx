"use client";

import { useState } from "react";
import { Bluetooth, BluetoothConnected, Info } from "lucide-react";
import { GanCubeAdapter } from "@cubeforge/hardware-hal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// Global singleton adapter to keep connection alive across re-renders
// In a full app, this might be in a global store (Zustand/Context).
export const globalCubeAdapter = new GanCubeAdapter();

export function CubeConnector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [errorMsg, setErrorMsg] = useState("");
  const [showMacInput, setShowMacInput] = useState(false);
  const [manualMac, setManualMac] = useState("");

  const connectCube = async () => {
    try {
      setStatus("connecting");
      setErrorMsg("");
      
      await globalCubeAdapter.connect(showMacInput ? manualMac : undefined);
      
      setStatus("connected");
      setShowMacInput(false);
      toast.success("Cube Connected!");
      
      // Request initial facelets just to verify connection
      globalCubeAdapter.requestFacelets().catch(() => {});
      
      setOpen(false); // Close dialog on success
    } catch (e: unknown) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : String(e);
      
      setStatus("disconnected");
      
      const requiresExperimental = 
        errMsg === "MAC_REQUIRED" || 
        errMsg.includes("requestDevice") || 
        errMsg.includes("bluetooth") || 
        !("bluetooth" in navigator);
      
      if (requiresExperimental) {
        setErrorMsg("Browser blocks automatic MAC reading or Web Bluetooth is disabled.");
        setShowMacInput(true);
      } else {
        setErrorMsg("Failed to connect: " + errMsg);
      }
    }
  };

  const instructions = /Edg\//i.test(navigator.userAgent) 
    ? "edge://flags/#enable-experimental-web-platform-features"
    : "chrome://flags/#enable-experimental-web-platform-features";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 rounded-md border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink hidden sm:flex",
            status === "connected" && "text-blue-500 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:text-blue-600",
            className
          )}
          aria-label="Connect Smart Cube"
        >
          {status === "connected" ? (
            <BluetoothConnected className="size-4" />
          ) : (
            <Bluetooth className="size-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Smart Cube</DialogTitle>
          <DialogDescription>
            Connect your Bluetooth-enabled speedcube (e.g. GAN Smart Cube) to use it as a timer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <span className={cn(
              "text-sm capitalize",
              status === "connected" ? "text-blue-500" : "text-ink-3"
            )}>
              {status}
            </span>
          </div>

          {errorMsg && (
            <Alert variant="destructive" className="py-2">
              <Info className="size-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                {errorMsg}
              </AlertDescription>
            </Alert>
          )}

          {showMacInput && (
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3 text-sm">
              <p className="text-ink-2">
                Your browser blocks automatic MAC reading. To fix this permanently, copy and paste this in a new tab and enable the flag:
              </p>
              <code className="rounded bg-ink/5 p-1.5 font-mono text-xs text-ink break-all">
                {instructions}
              </code>
              <div className="space-y-1.5 mt-2">
                <p className="text-ink-2 text-xs">Or enter the MAC address manually (e.g. AA:BB:CC:DD:EE:FF):</p>
                <Input
                  value={manualMac}
                  onChange={(e) => setManualMac(e.target.value)}
                  placeholder="MAC Address"
                  className="h-8"
                />
              </div>
            </div>
          )}

          <Button 
            onClick={connectCube} 
            disabled={status === "connecting" || (showMacInput && !manualMac)}
            className="w-full mt-2"
          >
            {status === "connecting" ? "Connecting..." : "Connect Cube"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
