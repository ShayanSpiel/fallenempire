#!/bin/bash

echo "🔄 Restarting Next.js app to apply region name fixes..."
echo ""

# Kill existing dev server
echo "1️⃣ Killing existing dev server..."
pkill -f "next dev" || echo "   No dev server running"

# Clear Next.js cache
echo ""
echo "2️⃣ Clearing Next.js cache..."
rm -rf .next
echo "   ✅ Cache cleared"

# Start dev server
echo ""
echo "3️⃣ Starting dev server..."
npm run dev
