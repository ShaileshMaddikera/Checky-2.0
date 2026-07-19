"""
agent.py — Checky LiveKit Worker

Connects to a LiveKit room, subscribes to the user's audio + video track,
and pipes them into Gemini via the Google Realtime (Live) API.

Gemini "sees" the live camera feed and "hears" the microphone.
When the user says "Hey Checky, check this out", Gemini identifies the product
and calls check_price() in tools.py.

Run:
    python agent.py dev           # development mode (auto-reconnect)
    python agent.py start         # production mode

Requires in .env:
    LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
    GOOGLE_API_KEY  (from aistudio.google.com)
"""

import asyncio
import json
import logging
import os
from typing import Annotated

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import google as google_plugin

import tools as shopping_tools

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("checky-agent")

SYSTEM_PROMPT = """You are Checky, a real-time smart shopping assistant.

You can HEAR what the user says, and you have a small camera thumbnail feed you
can SEE when they point it at a product.

Your personality:
- Friendly, sharp, and concise — like a knowledgeable shopping companion.
- Speak in short sentences. No long monologues.
- Use casual language. You're a helpful friend, not a corporate bot.

Your job — the user can trigger a price check two ways:
1. By SAYING a product name out loud, e.g. "Hey Checky, check the price of Sprite
   Zero" or "how much is a can of Coke" — use the product name exactly as they said it.
2. By pressing the scan button while pointing the camera at a product — when that
   happens you'll be prompted to look at the CURRENT camera frame and read the
   actual product packaging text. Only name what you can actually read right now;
   never guess and never fall back to a remembered/example product.

Either way, immediately call check_price() with that product name, then speak the
top result concisely, e.g. "[product] is $[price] on [retailer]." — using the real
result, never a placeholder. If you didn't catch what was said, or the camera frame
is unclear, say so and ask the user to repeat it or hold the item steadier — do NOT
guess.

IMPORTANT:
- Only call check_price when the user explicitly asks (by voice or scan button).
- Never fall back to a remembered example or a previous product if you're unsure —
  say you're not sure instead.
- Keep spoken responses under 2 sentences.
- The check_price tool also updates the visual UI — you don't need to list all results verbally.
"""


class CheckyAgent(Agent):
    """Checky agent with the check_price tool attached."""

    def __init__(self) -> None:
        super().__init__(instructions=SYSTEM_PROMPT)

    @function_tool
    async def check_price(
        self,
        product_name: Annotated[
            str,
            "The product name, brand, and size/variant — either exactly as the user "
            "said it out loud, or exactly as read off the current camera frame. Never "
            "a guess or a remembered example.",
        ],
    ) -> str:
        """
        Look up the cached price and product details across multiple retailers (like Amazon and Walmart) for a specific product.
        Call this when the user names a product they want priced, or after a camera scan identifies one.
        """
        return await shopping_tools.check_price(product_name)


async def entrypoint(ctx: JobContext):
    logger.info(f"[checky] Agent joining room: {ctx.room.name}")

    # Connect to the LiveKit room and subscribe to all audio + video tracks
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

    # Give the room reference to tools so they can publish data channel messages
    shopping_tools.set_room(ctx.room)

    # Notify the UI that the agent is connected and ready
    try:
        await ctx.room.local_participant.publish_data(
            json.dumps({"action": "agent_ready"}).encode(),
            reliable=True,
        )
    except Exception as e:
        logger.warning(f"Could not publish agent_ready: {e}")

    # Initialize Gemini Realtime model via Google AI Studio
    model = google_plugin.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-latest",
        voice="Puck",                     # Natural-sounding voice for Checky
        temperature=0.7,
        instructions=SYSTEM_PROMPT,
    )

    # Create and start the agent session
    agent = CheckyAgent()
    session = AgentSession(llm=model)

    @session.on("user_input_transcribed")
    def _on_user_input_transcribed(ev):
        if ev.is_final:
            logger.info(f"🗣️  Heard user say: {ev.transcript}")

    @session.on("agent_state_changed")
    def _on_agent_state_changed(ev):
        logger.info(f"🤖 Agent state: {ev.new_state}")
        # Let the UI reflect real voice-turn state (listening/thinking/speaking),
        # e.g. to show a "Gemini is responding" indicator while it's actually talking.
        asyncio.create_task(shopping_tools._publish({"action": "agent_state", "state": ev.new_state}))

    await session.start(agent, room=ctx.room)
    logger.info("[checky] Agent started — watching camera and listening...")

    @ctx.room.on("data_received")
    def on_data_received(data_packet):
        try:
            payload = json.loads(data_packet.data.decode())
            if payload.get("action") == "manual_search" and payload.get("query"):
                logger.info(f"⌨️  Manual text search triggered for: {payload['query']}")
                # Fire the check_price function directly!
                asyncio.create_task(shopping_tools.check_price(payload['query']))
            elif payload.get("action") == "scan_request":
                logger.info("📷 Scan button pressed — asking Gemini to identify the product on camera")
                # generate_reply() is synchronous — it fires immediately and returns a
                # SpeechHandle to track completion, it is NOT a coroutine to await/wrap.
                session.generate_reply(
                    instructions=(
                        "The user just pressed the scan button. Look very carefully at the "
                        "CURRENT camera frame right now and read the actual product packaging "
                        "text/label. Only identify what you can actually read — if the frame is "
                        "unclear, say so instead of guessing. Then immediately call check_price "
                        "with that exact product name."
                    )
                )
        except Exception as e:
            logger.warning(f"Error handling data channel message: {e}")

    # Keep the agent alive
    await asyncio.sleep(float("inf"))


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint)
    )
