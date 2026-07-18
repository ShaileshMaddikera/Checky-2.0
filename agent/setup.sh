#!/usr/bin/env bash
# setup.sh — one-time setup for the Checky Python agent
set -e

echo "🐍 Creating Python virtual environment..."
python3 -m venv .venv

echo "📦 Installing dependencies..."
.venv/bin/pip install --quiet "livekit-agents[google]>=1.0.0" "requests>=2.32.0" "python-dotenv>=1.0.0"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. cp .env.example .env"
echo "  2. Fill in your API keys in agent/.env"
echo "  3. source .venv/bin/activate"
echo "  4. python agent.py dev"
