"""Local stdio MCP smoke test; requires tools/graphify-requirements.txt."""
import asyncio
import os
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    root = Path(__file__).resolve().parent.parent
    graph = root / 'graphify-out' / 'graph.json'
    env = dict(os.environ, GRAPHIFY_BACKEND='none', GRAPHIFY_QUERY_LOG_DISABLE='1')
    params = StdioServerParameters(command=os.environ.get('GRAPHIFY_MCP_BIN', 'graphify-mcp'), args=['--graph', str(graph)], env=env)
    async with stdio_client(params) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            names = {tool.name for tool in (await session.list_tools()).tools}
            assert 'query_graph' in names
            result = await session.call_tool('query_graph', {'question': 'savePaymentProofs', 'token_budget': 800})
            assert not result.is_error
            output = '\n'.join(getattr(part, 'text', '') for part in result.content)
            assert 'savePaymentProofs' in output and 'saveLinkedProofs' in output
            print('PASS: MCP initialize, list_tools and finance attachment query')

if __name__ == '__main__':
    asyncio.run(main())
