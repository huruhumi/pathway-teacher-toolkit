import asyncio
import httpx
from pathlib import Path
import json

async def main():
    auth_file = Path.home() / ".notebooklm-mcp" / "auth.json"
    auth_data = json.loads(auth_file.read_text('utf-8'))
    cookies = auth_data.get('cookies', {})
    
    cookie_header = "; ".join(f"{k}={v}" for k, v in cookies.items())
    
    print("Testing WITHOUT User-Agent...")
    async with httpx.AsyncClient() as client:
        r1 = await client.get("https://notebooklm.google.com/", headers={"Cookie": cookie_header}, follow_redirects=True)
        print("URL 1:", r1.url)
        
    print("Testing WITH User-Agent...")
    headers = {
        "Cookie": cookie_header,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient() as client:
        r2 = await client.get("https://notebooklm.google.com/", headers=headers, follow_redirects=True)
        print("URL 2:", r2.url)

asyncio.run(main())
