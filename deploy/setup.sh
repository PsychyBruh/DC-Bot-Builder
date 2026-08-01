#!/usr/bin/env bash
# DC Bot Builder — full Proxmox LXC setup
# Run this ONCE on the Proxmox host as root.
# It creates the LXC, clones from GitHub, installs deps, and starts the bot.

set -euo pipefail

# ---------- config (override with env vars) ----------
CTID="${CTID:-202}"
HOSTNAME="${HOSTNAME:-dc-bot-builder}"
TEMPLATE="${TEMPLATE:-local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst}"
STORAGE="${STORAGE:-local-lvm}"
DISK_SIZE="${DISK_SIZE:-8}"
MEMORY="${MEMORY:-1024}"
CORES="${CORES:-2}"
BRIDGE="${BRIDGE:-vmbr0}"
IP="${IP:-dhcp}"
ONBOOT="${ONBOOT:-1}"
PROJECT_DIR="${PROJECT_DIR:-/opt/dc-bot-builder}"
NODE_MAJOR="${NODE_MAJOR:-20}"

say() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root on the Proxmox host."
command -v pct >/dev/null 2>&1 || die "pct not found — are you on a Proxmox host?"
command -v pveam >/dev/null 2>&1 || die "pveam not found — are you on a Proxmox host?"

# ---------- resolve template ----------
resolve_template() {
  local storage="${TEMPLATE%%:*}"
  local tname="${TEMPLATE#*:}"
  local basename="${tname##*/}"

  # Step 1: exact match is already downloaded?
  if pveam list "$storage" 2>/dev/null | grep -qF "$basename"; then
    echo "Using template: $TEMPLATE"
    return 0
  fi

  # Step 2: any Debian 12 templates already downloaded?
  local installed
  installed=$(pveam list "$storage" 2>/dev/null | grep -i "debian-12" | awk '{print $1}' || true)
  if [[ -n "$installed" ]]; then
    echo "Specific template not found, but Debian 12 templates are already downloaded:"
    local i=0 names=()
    while IFS= read -r line; do
      [[ -n "$line" ]] || continue
      i=$((i + 1))
      names+=("$line")
      printf "  %d) %s\n" "$i" "$line"
    done <<< "$installed"
    echo ""
    local pick=1
    if [[ $i -gt 1 ]]; then
      read -r -p "Pick a template [1-$i, default=1]: " pick
      pick="${pick:-1}"
    fi
    TEMPLATE="${storage}:vztmpl/${names[$((pick - 1))]}"
    echo "Using template: $TEMPLATE"
    return 0
  fi

  # Step 3: nothing installed — go online
  echo "No Debian 12 templates downloaded yet."
  echo "Refreshing online index..."
  pveam update 2>&1 || true

  local candidates
  candidates=$(pveam available --section system 2>/dev/null | grep debian-12 | awk '{print $2}' || true)
  if [[ -z "$candidates" ]]; then
    candidates=$(pveam available --section system 2>/dev/null | grep debian | awk '{print $2}' || true)
  fi
  if [[ -z "$candidates" ]]; then
    echo ""
    echo "No Debian templates found online."
    echo "Manually download one with: pveam download $storage <template-name>"
    echo "Then re-run."
    exit 1
  fi

  echo "Available Debian templates:"
  local i=0 names=()
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    i=$((i + 1))
    names+=("$line")
    printf "  %d) %s\n" "$i" "$line"
  done <<< "$candidates"

  local pick=1
  if [[ $i -gt 1 ]]; then
    echo ""
    read -r -p "Pick a template [1-$i, default=1]: " pick
    pick="${pick:-1}"
  fi
  local selected="${names[$((pick - 1))]}"

  say "Downloading $selected"
  pveam download "$storage" "$selected"
  TEMPLATE="${storage}:vztmpl/${selected}"
  echo "Template resolved: $TEMPLATE"
}

say "Template setup"
TEMPLATE="${TEMPLATE:-local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst}"
resolve_template

# ---------- prompts ----------
say "GitHub repo"
GIT_URL="${GIT_URL:-https://github.com/PsychyBruh/DC-Bot-Builder.git}"
read -r -p "Git clone URL [$GIT_URL]: " GIT_INPUT
GIT_URL="${GIT_INPUT:-$GIT_URL}"

# If HTTPS, offer to embed a PAT so pulls work without auth
if [[ "$GIT_URL" == https://* ]]; then
  read -r -p "Personal Access Token (optional, leave blank to skip): " GIT_PAT
  if [[ -n "$GIT_PAT" ]]; then
    GIT_URL="${GIT_URL/#https:\/\//https://x-access-token:${GIT_PAT}@}"
  fi
fi

say "Tokens"
while [[ -z "${DISCORD_TOKEN:-}" ]]; do read -r -p "Discord bot token: " DISCORD_TOKEN; done
while [[ -z "${ANTHROPIC_API_KEY:-}" ]]; do read -r -p "Anthropic API key: " ANTHROPIC_API_KEY; done
read -r -p "Discord client ID (optional, press Enter to skip): " CLIENT_ID

# ---------- 1. container ----------
say "1/5 Creating LXC $CTID ($HOSTNAME)"
if pct status "$CTID" >/dev/null 2>&1; then
  echo "Container $CTID already exists, skipping create."
else
  pct create "$CTID" "$TEMPLATE" \
    --hostname "$HOSTNAME" \
    --storage "$STORAGE" \
    --rootfs "${STORAGE}:${DISK_SIZE}" \
    --memory "$MEMORY" \
    --cores "$CORES" \
    --net0 "name=eth0,bridge=$BRIDGE,ip=$IP" \
    --features nesting=1 \
    --onboot "$ONBOOT" \
    --unprivileged 1 \
    --ostype debian
fi

pct start "$CTID" 2>/dev/null || true
echo -n "Waiting for container to start"
for i in $(seq 1 30); do
  sleep 1
  if pct status "$CTID" 2>/dev/null | grep -q "running"; then
    echo " ready"
    break
  fi
  echo -n "."
done
echo ""
pctexec() { pct exec "$CTID" -- bash -lc "$*"; }

# ---------- 2. packages ----------
say "2/5 Installing base packages + Node.js $NODE_MAJOR"
pctexec "set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -yq --no-install-recommends curl ca-certificates gnupg git build-essential
curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
apt-get install -yq nodejs
node -v && npm -v
"

# ---------- 3. clone ----------
say "3/5 Cloning repo"
pctexec "set -e
rm -rf '$PROJECT_DIR'
git clone '$GIT_URL' '$PROJECT_DIR'
"

# ---------- 4. deps + .env ----------
say "4/5 Installing npm deps and writing .env"
pctexec "set -e
cd '$PROJECT_DIR'
npm ci --omit=dev || npm install --omit=dev
mkdir -p data
cat > .env <<ENVEOF
DISCORD_TOKEN=$DISCORD_TOKEN
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
CLIENT_ID=$CLIENT_ID
ENVEOF
chmod 600 .env
"

# ---------- 5. systemd + botctl ----------
say "5/5 Installing systemd service and botctl"

pctexec "cat > /etc/systemd/system/dc-bot-builder.service <<'SERVICEEOF'
[Unit]
Description=DC Bot Builder
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
EnvironmentFile=$PROJECT_DIR/.env
StandardOutput=journal
StandardError=journal
TimeoutStopSec=15
KillMode=mixed

[Install]
WantedBy=multi-user.target
SERVICEEOF
"

# Write botctl
pctexec "cat > /usr/local/bin/botctl <<'BOTCTLEOF'
#!/usr/bin/env bash
# botctl — manage the DC Bot Builder service
SERVICE=dc-bot-builder
DIR=$PROJECT_DIR
usage() {
  cat <<EOF
botctl — control DC Bot Builder

  status              systemd status
  start               start bot
  stop                stop bot
  restart             restart bot
  logs [N]            tail last N lines then follow (default 100)
  logs-nf [N]         show last N lines, no follow
  update              git pull + npm ci + restart
  cmd '<shell>'       run one command in project dir
  env                 print .env (redacted)
  shell               interactive shell in project dir
EOF
}
case \"\${1:-}\" in
  status)   systemctl --no-pager status \"\$SERVICE\" ;;
  start)    systemctl start \"\$SERVICE\" ;;
  stop)     systemctl stop \"\$SERVICE\" ;;
  restart)  systemctl restart \"\$SERVICE\" ;;
  logs)     journalctl -u \"\$SERVICE\" -n \"\${2:-100}\" --no-pager -f ;;
  logs-nf)  journalctl -u \"\$SERVICE\" -n \"\${2:-100}\" --no-pager ;;
  update)
    cd \"\$DIR\"
    if [[ -d .git ]]; then
      bash deploy/update-bot.sh
    else
      echo \"No git repo — can't update.\"; exit 1
    fi
    ;;
  cmd)      [[ \$# -ge 2 ]] && cd \"\$DIR\" && bash -lc \"\$2\" || { echo \"Usage: botctl cmd '<cmd>'\"; exit 1; } ;;
  shell)    cd \"\$DIR\" && bash ;;
  env)      [[ -f \"\$DIR/.env\" ]] && sed -E 's/(KEY|TOKEN)=.+/\1=***REDACTED***/' \"\$DIR/.env\" || echo \"No .env\" ;;
  *)        usage ;;
esac
BOTCTLEOF
chmod +x /usr/local/bin/botctl
systemctl daemon-reload
systemctl enable dc-bot-builder.service
systemctl restart dc-bot-builder.service
sleep 2
systemctl --no-pager status dc-bot-builder.service | head -n 6 || true
"

# ---------- done ----------
say "DONE"
echo ""
echo "  Container $CTID is ready."
echo "  Bot is running inside as a systemd service."
echo ""
echo "  From the Proxmox host:"
echo "    pct exec $CTID -- botctl status"
echo "    pct exec $CTID -- botctl logs"
echo "    pct exec $CTID -- botctl restart"
echo "    pct exec $CTID -- botctl update"
echo ""
echo "  Or enter the container:"
echo "    pct enter $CTID"
echo ""
