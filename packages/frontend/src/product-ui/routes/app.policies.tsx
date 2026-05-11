import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Power, Save, SlidersHorizontal, X } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { getSupabaseClient } from "../../app/supabase-client";

export const Route = createFileRoute("/app/policies")({
  head: () => ({ meta: [{ title: "Policies - ArcPay" }] }),
  component: PoliciesPage,
});

const TOKENS = ["USDC", "AUDD", "PUSD", "SOL", "USDT"] as const;
const NETWORKS = ["Mainnet", "Devnet"] as const;
const ACTIONS = ["Send", "Swap", "Yield deposit", "Yield withdraw", "Shield", "Issue viewing key"] as const;
const POLICY_STORAGE_KEY = "arcpay-policy-settings";

type PolicySettings = {
  allowlist: string[];
  blocked: string[];
  daily: number;
  minScore: number;
  networks: string[];
  paused: boolean;
  perTx: number;
  requireApproval: number;
  tokens: string[];
};

const DEFAULT_POLICY_SETTINGS: PolicySettings = {
  allowlist: ["7Hk3R...9bX2Lq", "9Tu4Q...2qPkVm"],
  blocked: ["Yield withdraw"],
  daily: 50000,
  minScore: 60,
  networks: ["Mainnet"],
  paused: false,
  perTx: 15000,
  requireApproval: 2500,
  tokens: ["USDC", "AUDD", "PUSD"],
};

function parsePolicySettings(value: unknown): PolicySettings | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<PolicySettings>;

  return {
    allowlist: Array.isArray(raw.allowlist) ? raw.allowlist.map(String) : DEFAULT_POLICY_SETTINGS.allowlist,
    blocked: Array.isArray(raw.blocked) ? raw.blocked.map(String) : DEFAULT_POLICY_SETTINGS.blocked,
    daily: Number.isFinite(raw.daily) ? Number(raw.daily) : DEFAULT_POLICY_SETTINGS.daily,
    minScore: Number.isFinite(raw.minScore) ? Number(raw.minScore) : DEFAULT_POLICY_SETTINGS.minScore,
    networks: Array.isArray(raw.networks) ? raw.networks.map(String) : DEFAULT_POLICY_SETTINGS.networks,
    paused: Boolean(raw.paused),
    perTx: Number.isFinite(raw.perTx) ? Number(raw.perTx) : DEFAULT_POLICY_SETTINGS.perTx,
    requireApproval: Number.isFinite(raw.requireApproval)
      ? Number(raw.requireApproval)
      : DEFAULT_POLICY_SETTINGS.requireApproval,
    tokens: Array.isArray(raw.tokens) ? raw.tokens.map(String) : DEFAULT_POLICY_SETTINGS.tokens,
  };
}

function PoliciesPage() {
  const [paused, setPaused] = useState(DEFAULT_POLICY_SETTINGS.paused);
  const [daily, setDaily] = useState(DEFAULT_POLICY_SETTINGS.daily);
  const [perTx, setPerTx] = useState(DEFAULT_POLICY_SETTINGS.perTx);
  const [minScore, setMinScore] = useState(DEFAULT_POLICY_SETTINGS.minScore);
  const [requireApproval, setRequireApproval] = useState(DEFAULT_POLICY_SETTINGS.requireApproval);
  const [tokens, setTokens] = useState<string[]>(DEFAULT_POLICY_SETTINGS.tokens);
  const [networks, setNetworks] = useState<string[]>(DEFAULT_POLICY_SETTINGS.networks);
  const [blocked, setBlocked] = useState<string[]>(DEFAULT_POLICY_SETTINGS.blocked);
  const [allowlist, setAllowlist] = useState<string[]>(DEFAULT_POLICY_SETTINGS.allowlist);
  const [newAddr, setNewAddr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "loading" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const applySettings = (settings: PolicySettings) => {
    setPaused(settings.paused);
    setDaily(settings.daily);
    setPerTx(settings.perTx);
    setMinScore(settings.minScore);
    setRequireApproval(settings.requireApproval);
    setTokens(settings.tokens);
    setNetworks(settings.networks);
    setBlocked(settings.blocked);
    setAllowlist(settings.allowlist);
  };

  const getSettings = (): PolicySettings => ({
    allowlist,
    blocked,
    daily,
    minScore,
    networks,
    paused,
    perTx,
    requireApproval,
    tokens,
  });

  useEffect(() => {
    const stored = parsePolicySettings(JSON.parse(localStorage.getItem(POLICY_STORAGE_KEY) ?? "null"));

    if (stored) {
      applySettings(stored);
    }

    let mounted = true;

    async function loadRemoteSettings() {
      try {
        const supabase = getSupabaseClient();
        const { data: userResult } = await supabase.auth.getUser();
        const userId = userResult.user?.id;

        if (!userId) return;

        const { data, error } = await supabase
          .from("user_policy_settings")
          .select("settings")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;

        const settings = parsePolicySettings(data?.settings);

        if (mounted && settings) {
          applySettings(settings);
          setDirty(false);
          setSaveMessage("Loaded cloud policy settings.");
        }
      } catch (error) {
        console.warn("Unable to load cloud policy settings.", error);
      }
    }

    void loadRemoteSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const toggle = (arr: string[], setArr: (v: string[]) => void) => (v: string) => {
    setDirty(true);
    setSaveState("idle");
    setSaveMessage("");
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const onChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
    setSaveState("idle");
    setSaveMessage("");
  };

  const savePolicies = async () => {
    const settings = getSettings();
    setSaveState("loading");
    setSaveMessage("");

    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(settings));

    try {
      const supabase = getSupabaseClient();
      const { data: userResult, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      const userId = userResult.user?.id;

      if (!userId) {
        setDirty(false);
        setSaveState("saved");
        setSaveMessage("Policy settings saved locally. Sign in to sync them to Supabase.");
        return;
      }

      const { error } = await supabase.from("user_policy_settings").upsert({
        user_id: userId,
        settings,
      });

      if (error) throw error;

      setDirty(false);
      setSaveState("saved");
      setSaveMessage("Policy settings saved to Supabase.");
    } catch (error) {
      console.error("Policy save failed.", error);
      setSaveState("error");
      setSaveMessage("Policy settings could not sync to Supabase. Local copy is still saved.");
    }
  };

  return (
    <div>
      <PageHeader
        icon={SlidersHorizontal}
        eyebrow="Treasury intelligence"
        title="Policies"
        description="The enterprise control panel. Set spend limits, allowed surfaces, allowlists, and emergency pause."
        actions={
          <button
            disabled={!dirty || saveState === "loading"}
            className="inline-flex items-center gap-2 bg-foreground text-background text-sm font-medium px-4 py-2.5 rounded-full hover:opacity-90 disabled:opacity-40"
            onClick={savePolicies}
          >
            <Save className="w-4 h-4" /> {saveState === "loading" ? "Saving..." : "Save changes"}
          </button>
        }
      />

      {saveMessage && (
        <div
          className={`rounded-2xl border p-4 mb-6 text-sm ${
            saveState === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-success/40 bg-success/10 text-success"
          }`}
        >
          {saveMessage}
        </div>
      )}

      {paused && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 mb-6 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Power className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <div className="font-medium text-sm">Treasury paused</div>
              <div className="text-xs text-muted-foreground">All money-moving actions are blocked across the workspace.</div>
            </div>
          </div>
          <button onClick={() => { setPaused(false); setDirty(true); }} className="text-xs px-3 py-1.5 rounded-full bg-foreground text-background hover:opacity-90">Resume</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Spend limits" desc="Caps applied across the workspace.">
          <Slider label="Daily spend limit" value={daily} onChange={onChange(setDaily)} max={250000} step={1000} format={(v) => `$${v.toLocaleString()}`} />
          <Slider label="Per-transaction max" value={perTx} onChange={onChange(setPerTx)} max={100000} step={500} format={(v) => `$${v.toLocaleString()}`} />
          <Slider label="Require human approval over" value={requireApproval} onChange={onChange(setRequireApproval)} max={50000} step={500} format={(v) => `$${v.toLocaleString()}`} />
        </Card>

        <Card title="Risk floor" desc="Minimum GoldRush score required for any counterparty.">
          <Slider label="Minimum GoldRush score" value={minScore} onChange={onChange(setMinScore)} max={100} step={1} format={(v) => `${v} / 100`} />
          <div className="text-xs text-muted-foreground">Anything below the floor is sent to the review queue automatically.</div>
        </Card>

        <Card title="Allowed tokens" desc="Only these tokens can move out of the treasury.">
          <div className="flex flex-wrap gap-2">
            {TOKENS.map((t) => (
              <button key={t} onClick={() => toggle(tokens, setTokens)(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${tokens.includes(t) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{t}</button>
            ))}
          </div>
        </Card>

        <Card title="Allowed networks" desc="Lock movement to specific Solana clusters.">
          <div className="flex flex-wrap gap-2">
            {NETWORKS.map((n) => (
              <button key={n} onClick={() => toggle(networks, setNetworks)(n)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${networks.includes(n) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{n}</button>
            ))}
          </div>
        </Card>

        <Card title="Blocked actions" desc="Disable specific surfaces entirely.">
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <button key={a} onClick={() => toggle(blocked, setBlocked)(a)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${blocked.includes(a) ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>{a}</button>
            ))}
          </div>
        </Card>

        <Card title="Contractor allowlist" desc="Only these wallets can be paid via batch payroll.">
          <div className="flex gap-2">
            <input value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder="Solana address" className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm font-mono outline-none focus:ring-2 focus:ring-ring" />
            <button onClick={() => { if (newAddr.trim()) { setAllowlist((p) => [newAddr.trim(), ...p]); setNewAddr(""); setDirty(true); } }} className="bg-foreground text-background rounded-full px-4 text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {allowlist.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 bg-muted text-xs font-mono px-2.5 py-1 rounded-full">{a}<button onClick={() => { setAllowlist((p) => p.filter((x) => x !== a)); setDirty(true); }} className="hover:text-destructive"><X className="w-3 h-3" /></button></span>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Power className="w-5 h-5 text-destructive mt-0.5" />
          <div>
            <div className="font-medium text-sm">Emergency pause</div>
            <div className="text-xs text-muted-foreground">Instantly block all money-moving actions across every connected wallet.</div>
          </div>
        </div>
        <button onClick={() => { setPaused((p) => !p); setDirty(true); }} className={`text-sm font-medium px-5 py-2.5 rounded-full ${paused ? "bg-muted text-foreground" : "bg-destructive text-destructive-foreground hover:brightness-110"}`}>{paused ? "Resume treasury" : "Pause treasury"}</button>
      </div>
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5 mb-4">{desc}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Slider({ label, value, onChange, max, step, format }: { label: string; value: number; onChange: (v: number) => void; max: number; step: number; format: (v: number) => string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{format(value)}</span>
      </div>
      <input type="range" min={0} max={max} step={step} value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} className="w-full mt-1.5 accent-primary" />
    </div>
  );
}
