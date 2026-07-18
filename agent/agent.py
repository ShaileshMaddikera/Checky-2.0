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

SYSTEM_PROMPT = """You are Checky, a real-time smart shopping assistant running on smart glasses.

You can SEE the user's live camera feed and HEAR what they say.

Your personality:
- Friendly, sharp, and concise — like a knowledgeable shopping companion.
- Speak in short sentences. No long monologues.
- Use casual language. You're a helpful friend, not a corporate bot.

Your job:
1. Watch the camera feed continuously.
2. When the user says something like "Hey Checky", "check this", "what's the price",
   "how much is this", or "check this out" — identify the product they're pointing at
   from the video frame (brand name, product name, size/variant if visible).
3. Immediately call check_price() with the product name you identified.
4. After getting results, speak the top result concisely:
   Example: "That's Advil 200mg 50-count — $8.49 on Amazon."
5. If you can't read the product clearly, ask the user to hold it steadier or closer.

IMPORTANT:
- Only call check_price when the user explicitly asks to check a product.
- Don't narrate what you see unless asked.
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
            "The product name, brand, size/variant as read from the video frame. "
            "Be as specific as possible, e.g. 'Advil Ibuprofen 200mg 50 tablets'.",
        ],
    ) -> str:
        """
        Look up the Amazon price and product details for a specific product.
        Call this when the user wants to check or compare prices for something visible in the camera.
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
        model="gemini-2.5-flash",    # Gemini 2.5 Flash with Live API
        voice="Puck",                     # Natural-sounding voice for Checky
        temperature=0.7,
        instructions=SYSTEM_PROMPT,
    )

    # Create and start the agent session
    agent = CheckyAgent()
    session = AgentSession(llm=model)

    @session.on("user_speech_committed")
    def _on_user_speech_committed(msg):
        logger.info(f"🗣️  Heard user say: {msg.content}")

    @session.on("agent_speech_started")
    def _on_agent_speech_started():
        logger.info("🤖 Agent speaking...")

    session.start(agent, room=ctx.room)
    logger.info("[checky] Agent started — watching camera and listening...")

    @ctx.room.on("data_received")
    def on_data_received(data_packet):
        try:
            payload = json.loads(data_packet.data.decode())
            if payload.get("action") == "manual_search" and payload.get("query"):
                logger.info(f"⌨️  Manual text search triggered for: {payload['query']}")
                # Fire the check_price function directly!
                asyncio.create_task(shopping_tools.check_price(payload['query']))
        except Exception as e:
            logger.warning(f"Error handling manual text search data: {e}")

    # Keep the agent alive
    await asyncio.sleep(float("inf"))


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint)
    )
