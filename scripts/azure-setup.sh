#!/bin/bash
# BookEX Azure VM Setup Script
set -e

# Suppress ALL interactive prompts from apt and needrestart
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1
sudo sed -i "s/#\$nrconf{restart} = 'i';/\$nrconf{restart} = 'a';/" /etc/needrestart/needrestart.conf 2>/dev/null || true

echo "=== Step 1: Remove old Node.js ==="
sudo apt-get remove -y libnode-dev libnode72 nodejs 2>/dev/null || true

echo "=== Step 2: Install Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/ns.sh
sudo bash /tmp/ns.sh
sudo apt-get install -y nodejs
node --version
npm --version

echo "=== Step 3: Install PM2 and tsx ==="
sudo npm install -g pm2 tsx

echo "=== Step 4: Clone BookEX ==="
cd ~
rm -rf bookex
git clone https://github.com/prof-rdx/BookEX.git bookex
cd bookex

echo "=== Step 5: Create .env ==="
cat > .env << 'EOF'
MONGODB_URI=mongodb://bookex:S%40bih207402@127.0.0.1:27017/admin
NEXTAUTH_SECRET=Rgn9TdZdQqLWv2SnLjoVJ6iyLltloXYZ123456789
NEXTAUTH_URL=https://book-ex-nine.vercel.app
NEXT_PUBLIC_APP_URL=https://book-ex-nine.vercel.app
SOCKET_PORT=3001
MEDIA_API_URL=https://media.farya.pk
MEDIA_API_SECRET=073f506a39ad4f979ecdfdd245f180ecbaf634b437f9eabe6abe44e9a45ef8bd
RESEND_API_KEY=re_HP8NgRdB_wCDQvHPNaqWz3iHh19XPKUfw
GEMINI_API_KEY=AIzaSyBx6m7-KNfDifbjBFwipbtZo0OYJLmTpz0
EOF

echo "=== Step 6: Install dependencies ==="
npm install

echo "=== Step 7: Start Socket.IO with PM2 ==="
pm2 delete bookex-socket 2>/dev/null || true
pm2 start --name bookex-socket --interpreter tsx server.ts
pm2 save

echo "=== Step 8: PM2 startup on boot ==="
pm2 startup systemd -u sabih --hp /home/sabih | tail -1 | sudo bash -

echo "=== Step 9: Open firewall port 3001 ==="
sudo ufw allow 3001/tcp 2>/dev/null || true

echo ""
echo "=== ALL DONE ==="
pm2 status
