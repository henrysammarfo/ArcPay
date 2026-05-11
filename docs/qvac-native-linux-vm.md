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
sudo apt install -y curl git ca-certificates build-essential

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
bash scripts/qvac-runtime-proof.sh
```

The script does all of this:

- Confirms the host is native Linux x64.
- Creates a clean `~/arcpay-qvac-runtime`.
- Runs the canonical `npm i @qvac/sdk`.
- Verifies the official QVAC SDK import.
- Runs `npm run proof:qvac -w @arcpay/agent` with
  `QVAC_LINUX_HOST_CONFIRMED=true`.

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

