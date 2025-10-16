#!/bin/bash

# Chat Message Fix Verification Script
# This script helps verify that the chat message fixes are working correctly

echo "======================================"
echo "Chat Message Fix Verification"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if servers are running
echo "1. Checking if servers are running..."
echo ""

# Check Next.js server (port 9002)
if lsof -Pi :9002 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✓${NC} Next.js server running on port 9002"
else
    echo -e "${RED}✗${NC} Next.js server NOT running on port 9002"
    echo "  Run: npm run dev:next"
fi

# Check Socket.IO server (port 3001)
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✓${NC} Socket.IO server running on port 3001"
else
    echo -e "${RED}✗${NC} Socket.IO server NOT running on port 3001"
    echo "  Run: npm run dev:socket"
fi

echo ""
echo "======================================"
echo "2. Checking for TypeScript errors..."
echo "======================================"
echo ""

# Check for TypeScript errors in modified files
npx tsc --noEmit --pretty false 2>&1 | grep -E "(messages-page.tsx|chats/route.ts)" || echo -e "${GREEN}✓${NC} No TypeScript errors in modified files"

echo ""
echo "======================================"
echo "3. File Modification Verification"
echo "======================================"
echo ""

# Check if files were modified
if [ -f "src/components/messages-page.tsx" ]; then
    if grep -q "messageConfirmed" "src/components/messages-page.tsx"; then
        echo -e "${GREEN}✓${NC} messages-page.tsx: messageConfirmed handler added"
    else
        echo -e "${RED}✗${NC} messages-page.tsx: messageConfirmed handler NOT found"
    fi
    
    if grep -q "message.senderId === currentUser.id" "src/components/messages-page.tsx"; then
        echo -e "${GREEN}✓${NC} messages-page.tsx: Sender check added"
    else
        echo -e "${RED}✗${NC} messages-page.tsx: Sender check NOT found"
    fi
else
    echo -e "${RED}✗${NC} messages-page.tsx NOT found"
fi

if [ -f "src/app/api/messages/chats/route.ts" ]; then
    if grep -q "formattedChats" "src/app/api/messages/chats/route.ts"; then
        echo -e "${GREEN}✓${NC} chats/route.ts: ChatId formatting added"
    else
        echo -e "${RED}✗${NC} chats/route.ts: ChatId formatting NOT found"
    fi
else
    echo -e "${RED}✗${NC} chats/route.ts NOT found"
fi

echo ""
echo "======================================"
echo "4. Documentation Files"
echo "======================================"
echo ""

docs=("CHAT_MESSAGE_FIX.md" "CHAT_MESSAGE_QUICK_FIX.md" "CHAT_MESSAGE_FLOW_DIAGRAM.md" "CHAT_FIX_COMPLETE_SUMMARY.md")

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✓${NC} $doc created"
    else
        echo -e "${RED}✗${NC} $doc NOT found"
    fi
done

echo ""
echo "======================================"
echo "5. Manual Testing Checklist"
echo "======================================"
echo ""
echo "To manually test the fixes:"
echo ""
echo -e "${YELLOW}Test 1: Real-time Message Reception${NC}"
echo "  1. Open two browser windows"
echo "  2. Login as different users in each"
echo "  3. Send message from User A to User B"
echo "  4. Verify User B sees message immediately"
echo ""
echo -e "${YELLOW}Test 2: Message Persistence${NC}"
echo "  1. User A sends message to User B"
echo "  2. Reload User A's page (Cmd+Shift+R)"
echo "  3. Verify message still visible"
echo "  4. Reload User B's page"
echo "  5. Verify message still visible"
echo ""
echo -e "${YELLOW}Test 3: Check Browser Console${NC}"
echo "  1. Open browser DevTools (F12)"
echo "  2. Check Console for:"
echo "     - 'Connected to Socket.IO server'"
echo "     - No socket errors"
echo "     - No 'Ignoring newPersonalMessage for own message' (unless testing)"
echo ""
echo -e "${YELLOW}Test 4: Check Network Tab${NC}"
echo "  1. Open browser DevTools (F12)"
echo "  2. Go to Network tab"
echo "  3. Send a message"
echo "  4. Check for socket events (wss:// connection)"
echo "  5. No API errors (500, 404)"
echo ""
echo "======================================"
echo "6. Debugging Tips"
echo "======================================"
echo ""
echo "If messages not appearing:"
echo "  • Check browser console for socket connection errors"
echo "  • Check server logs for 'Personal message sent from...'"
echo "  • Verify both users joined their rooms (check for 'User XXX joined user room')"
echo "  • Check MongoDB connection is working"
echo ""
echo "If messages disappear on reload:"
echo "  • Check Network tab: GET /api/messages/chats/[chatId]/messages"
echo "  • Check if messageConfirmed event is being received"
echo "  • Check MongoDB has the messages (use MongoDB Compass)"
echo ""
echo "======================================"
echo "Verification Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Start servers if not running: npm run dev"
echo "2. Run manual tests listed above"
echo "3. Check browser console and network tab"
echo "4. Review documentation in the created .md files"
echo ""
