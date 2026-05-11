import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Wallet,
  Send,
  FileText,
  Users,
  ArrowLeftRight,
  TrendingUp,
  EyeOff,
  ShieldAlert,
  SlidersHorizontal,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";

const NAV = [
  { label: "Overview", to: "/app/dashboard", icon: LayoutDashboard },
  { label: "Wallet", to: "/app/wallet", icon: Wallet },
  { label: "Payments", to: "/app/payments", icon: Send },
  { label: "Invoices", to: "/app/invoices", icon: FileText },
  { label: "Contractors", to: "/app/contractors", icon: Users },
  { label: "Swaps", to: "/app/swaps", icon: ArrowLeftRight },
  { label: "Yield", to: "/app/yield", icon: TrendingUp },
  { label: "Privacy", to: "/app/privacy", icon: EyeOff },
  { label: "Risk", to: "/app/risk", icon: ShieldAlert },
  { label: "Policies", to: "/app/policies", icon: SlidersHorizontal },
  { label: "Audit", to: "/app/audit", icon: ScrollText },
  { label: "Settings", to: "/app/settings", icon: SettingsIcon },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {NAV.map((item) => (
            <CommandItem
              key={item.to}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: item.to });
              }}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
