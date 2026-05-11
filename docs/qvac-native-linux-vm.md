# QVAC Native Linux VM Proof

QVAC confirmed Linux x64 is tested, while WSL is currently untested. If cloud is
blocked, use VMware Workstation with Ubuntu Server. This is the cleanest route
for the final QVAC proof without pretending WSL is acceptable.

Official Ubuntu download pages:

- Ubuntu Server: `https://ubuntu.com/download/server/manual`
- Ubuntu Desktop: `https://ubuntu.com/download/desktop`

Use Server, not Desktop. As of the current official Ubuntu download page,
Ubuntu Server 24.04.4 LTS is listed as a 3GB download. Ubuntu Desktop is much
larger, around 5.9GB, and is unnecessary for QVAC.

## VM Settings

Recommended minimum:

- OS: Ubuntu Server 24.04 LTS, amd64 / x86_64.
- CPU: 4 cores if available; 2 cores minimum.
- RAM: 8GB if available; 4GB minimum.
- Disk: 40GB thin-provisioned.
- Network: NAT is fine.
- Do not use WSL for this proof.

During Ubuntu install:

- Create user `pridator` or any normal sudo user.
- Enable OpenSSH server if the installer asks. This makes file transfer easier.
- Skip Docker/Kubernetes snaps.

## Install Runtime Prerequisites

Run inside the VM:

```bash
sudo apt update
sudo apt install -y curl git ca-certificates build-essential libvulkan1 mesa-vulkan-drivers

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

node -v
npm -v
uname -a
```

Expected:

- `uname -m` returns `x86_64`.
- `node -v` is Node 22.x.

## Copy ArcPay Into The VM

Fastest option from Windows PowerShell, after SSH is enabled in the VM:

```powershell
scp -r C:\Users\RICHEY_SON\Desktop\ArcPay user@VM_IP:~/ArcPay
```

If `scp` is not available, zip the repo excluding `node_modules`, copy it into
the VM, then unzip.

Do not copy private wallet keys unless needed for a proof. QVAC does not need a
wallet private key.

## Run The QVAC Proof

Inside the VM:

```bash
cd ~/ArcPay
npm install
ARCPAY_REQUIRE_LIVE_QVAC=true \
QVAC_SDK_PATH="$HOME/arcpay-qvac-runtime/node_modules/@qvac/sdk" \
QVAC_MODEL_SRC="registry://hf/unsloth/Qwen3-0.6B-GGUF/blob/50968a4468ef4233ed78cd7c3de230dd1d61a56b/Qwen3-0.6B-Q4_0.gguf" \
QVAC_MODEL_CONFIG_JSON='{"ctx_size":2048}' \
QVAC_PROOF_TIMEOUT_MS=300000 \
npm run proof:qvac -w @arcpay/agent
```

The native Azure proof used:

- Ubuntu 24.04 x86_64 on Azure.
- Node `v22.22.2`.
- `@qvac/sdk@0.10.2`.
- `libvulkan1` and `mesa-vulkan-drivers` for the native llama.cpp addon.
- QVAC Qwen3 600M Q4 model from the QVAC registry.

Passing output:

```text
PASSED QVAC: QVAC returned live treasury decision CONVERT_NOW.
Decision: {"action":"CONVERT_NOW","confidence":1,"reason":"Convert now to maximize gains using the AUDD/USDC rate of 1.002, which provides a 5.2% Kamino APY. No pending payments exist, and converting now maximizes current opportunities."}
```

If the script passes, save:

- terminal output;
- QVAC decision JSON/action;
- installed SDK version;
- VM proof line from `uname -a`.

## If Install Fails

Capture:

```bash
cd ~/ArcPay
npm -v
node -v
uname -a
tail -220 ~/.npm/_logs/*debug-0.log
```

Then send the failure to QVAC with:

```text
Hi QVAC team, I moved from WSL to native Ubuntu Server 24.04 x64 in VMware as
requested. The host is x86_64 and I used the canonical npm install path.

Command:
npm i @qvac/sdk

Proof command:
bash scripts/qvac-runtime-proof.sh

Here is the npm/debug output:
<paste log>
```
