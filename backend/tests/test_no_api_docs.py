async def test_the_live_site_publishes_no_api_docs(client):
    for path in ("/docs", "/redoc", "/openapi.json"):
        r = await client.get(path)
        body = r.text.lower()
        assert "swagger" not in body and "redoc" not in body and '"openapi"' not in body, path
