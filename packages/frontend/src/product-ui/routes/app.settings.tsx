import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Bell, Globe2, KeyRound, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { useNetwork } from "@/store/network";
import { getOptionalSupabaseClient } from "../../app/supabase-client";
import { ensureCurrentUserAccount } from "@/lib/account";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings - ArcPay" }] }),
  component: SettingsPage,
});

type IntegrationKey = "quicknode" | "birdeye" | "goldrush" | "dflow" | "kamino" | "lpAgent" | "cloak" | "ika" | "pusd";

const INTEGRATIONS: { key: IntegrationKey; label: string; description: string }[] = [
  { key: "quicknode", label: "QuickNode", description: "RPC and webhook events" },
  { key: "birdeye", label: "Birdeye", description: "Token prices and market intelligence" },
  { key: "goldrush", label: "GoldRush", description: "Counterparty risk scoring" },
  { key: "dflow", label: "DFlow", description: "MEV-aware swap routing" },
  { key: "kamino", label: "Kamino", description: "Yield vault recommendations" },
  { key: "lpAgent", label: "LP Agent", description: "Meteora Zap-In/Zap-Out data" },
  { key: "cloak", label: "Cloak", description: "Private payment routes" },
  { key: "ika", label: "Ika", description: "dWallet policy approvals" },
  { key: "pusd", label: "PUSD", description: "Palm USD treasury rail" },
];

const DEFAULT_INTEGRATIONS: Record<IntegrationKey, boolean> = {
  quicknode: true,
  birdeye: true,
  goldrush: true,
  dflow: true,
  kamino: true,
  lpAgent: true,
  cloak: true,
  ika: true,
  pusd: true,
};

function SettingsPage() {
  const network = useNetwork((state) => state.mode);
  const setNetwork = useNetwork((state) => state.setMode);
  const [userId, setUserId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("Multi-agent agency");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [riskAlerts, setRiskAlerts] = useState(true);
  const [autoYieldSweeps, setAutoYieldSweeps] = useState(false);
  const [requireWallet, setRequireWallet] = useState(true);
  const [integrations, setIntegrations] = useState(DEFAULT_INTEGRATIONS);
  const [status, setStatus] = useState("Sign in to sync settings across devices.");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = getOptionalSupabaseClient();
    let mounted = true;

    async function loadSettings() {
      if (!supabase) {
        setStatus("Supabase env is not configured in this frontend runtime.");
        return;
      }

      const account = await ensureCurrentUserAccount(supabase);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!mounted) return;

      setUserId(user?.id ?? null);

      if (!user) return;
      if (account?.workspaceName) setWorkspaceName(account.workspaceName);

      const { data, error } = await supabase
        .from("user_workspace_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setStatus(`Settings load failed: ${error.message}`);
        return;
      }

      if (data) {
        setWorkspaceName(data.workspace_name);
        setNetwork(data.default_network);
        setEmailNotifications(data.email_notifications);
        setRiskAlerts(data.risk_alerts);
        setAutoYieldSweeps(data.auto_yield_sweeps);
        setRequireWallet(data.require_wallet_for_actions);
        setIntegrations({ ...DEFAULT_INTEGRATIONS, ...data.enabled_integrations });
        setStatus("Settings loaded.");
      } else {
        setStatus("Default settings created for this workspace.");
      }
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, [setNetwork]);

  async function saveSettings() {
    if (!userId) {
      setStatus("Sign in first, then save workspace settings.");
      return;
    }

    const supabase = getOptionalSupabaseClient();
    if (!supabase) {
      setStatus("Supabase env is not configured in this frontend runtime.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("user_workspace_settings")
      .upsert(
        {
          user_id: userId,
          workspace_name: workspaceName,
          default_network: network,
          email_notifications: emailNotifications,
          risk_alerts: riskAlerts,
          auto_yield_sweeps: autoYieldSweeps,
          require_wallet_for_actions: requireWallet,
          enabled_integrations: integrations,
        },
        { onConflict: "user_id" },
      );
    setSaving(false);

    if (error) {
      setStatus(`Settings save failed: ${error.message}`);
      return;
    }

    setStatus("Settings saved. Workspace preferences are synced.");
  }

  function toggleIntegration(key: IntegrationKey) {
    setIntegrations((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div>
      <PageHeader
        icon={SettingsIcon}
        eyebrow="Workspace"
        title="Settings"
        description="Control workspace identity, default network behavior, notification rules, and enabled provider rails."
        actions={
          <button
            className="inline-flex items-center gap-2 bg-foreground text-background text-sm font-medium px-4 py-2.5 rounded-full hover:opacity-90 disabled:opacity-50"
            disabled={saving}
            onClick={() => void saveSettings()}
            type="button"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <KeyRound className="w-4 h-4 text-primary" />
            <div>
              <div className="text-sm font-medium">Workspace profile</div>
              <div className="text-xs text-muted-foreground">Used in approvals, audit exports, and invoice/payment metadata.</div>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace name</span>
            <input
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setWorkspaceName(event.target.value)}
              value={workspaceName}
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
            <Toggle label="Email notifications" description="Send payment, risk, and policy alerts." enabled={emailNotifications} onToggle={() => setEmailNotifications((v) => !v)} icon={Bell} />
            <Toggle label="Risk alerts" description="Notify when GoldRush score drops below policy." enabled={riskAlerts} onToggle={() => setRiskAlerts((v) => !v)} icon={ShieldCheck} />
            <Toggle label="Auto yield sweeps" description="Queue yield actions when idle funds pass policy." enabled={autoYieldSweeps} onToggle={() => setAutoYieldSweeps((v) => !v)} icon={Globe2} />
            <Toggle label="Require wallet for actions" description="Block signing unless a wallet is connected." enabled={requireWallet} onToggle={() => setRequireWallet((v) => !v)} icon={KeyRound} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-medium">Default network</div>
          <div className="text-xs text-muted-foreground mt-0.5 mb-4">Controls wallet RPC and which feature set appears first.</div>
          <div className="grid grid-cols-2 gap-2">
            {(["devnet", "mainnet"] as const).map((mode) => (
              <button
                className={`rounded-xl border px-4 py-3 text-sm font-medium capitalize ${
                  network === mode ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
                key={mode}
                onClick={() => setNetwork(mode)}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            Current mode: <span className="font-semibold text-foreground">{network}</span>. Mainnet actions still require wallet funds and final review.
          </div>
        </section>

        <section className="lg:col-span-3 rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-medium">Enabled integrations</div>
          <div className="text-xs text-muted-foreground mt-0.5 mb-4">
            Turning off an integration hides it from recommendations and route review, but proof pages remain available.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {INTEGRATIONS.map((item) => (
              <button
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  integrations[item.key] ? "border-primary/40 bg-primary/5" : "border-border bg-background opacity-70"
                }`}
                key={item.key}
                onClick={() => toggleIntegration(item.key)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{item.label}</div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    integrations[item.key] ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                  }`}>
                    {integrations[item.key] ? "Enabled" : "Off"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">{status}</div>
    </div>
  );
}

function Toggle({
  label,
  description,
  enabled,
  onToggle,
  icon: Icon,
}: {
  readonly label: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly onToggle: () => void;
  readonly icon: typeof Bell;
}) {
  return (
    <button
      className={`rounded-2xl border p-4 text-left transition-colors ${
        enabled ? "border-primary/40 bg-primary/5" : "border-border bg-background"
      }`}
      onClick={onToggle}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold">{label}</div>
        </div>
        <span className={`h-6 w-11 rounded-full p-0.5 transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}>
          <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : ""}`} />
        </span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}
