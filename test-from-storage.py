import asyncio
from notebooklm.client import NotebookLMClient
from pathlib import Path

async def main():
    try:
        async with await NotebookLMClient.from_storage(timeout=240) as client:
            print("Client auth successful!", client.auth.session_id)
    except Exception as e:
        print("Error:", e)
        
asyncio.run(main())
