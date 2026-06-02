const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');

test('POST /marketing/chat forwards payload with roma-ai source', async () => {
  let receivedPayload = null;
  const app = createApp({
    marketingChatImpl: async (payload) => {
      receivedPayload = payload;
      return { response: 'ok', state: 'approval', options: { main: 'A' } };
    }
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/marketing/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hola', sessionId: 's1' })
  });
  const body = await response.json();
  server.close();

  assert.equal(response.status, 200);
  assert.deepEqual(receivedPayload, {
    message: 'hola',
    sessionId: 's1',
    source: 'roma-ai'
  });
  assert.equal(body.response, 'ok');
  assert.equal(body.state, 'approval');
});
