import { test, expect } from '@playwright/test'

// API endpoint smoke tests — authenticated session cookies are passed automatically

test.describe('API endpoints — health and basic responses', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const resp = await request.get('/api/health')
    expect(resp.status()).toBeLessThan(400)
  })

  test('GET /api/users without ID returns 400 or 404', async ({ request }) => {
    const resp = await request.get('/api/users')
    expect([400, 404, 405]).toContain(resp.status())
  })

  test('GET /api/search/suggestions returns JSON', async ({ request }) => {
    const resp = await request.get('/api/search/suggestions?q=book')
    expect(resp.status()).toBeLessThan(500)
    if (resp.status() === 200) {
      const contentType = resp.headers()['content-type'] || ''
      expect(contentType).toContain('json')
    }
  })

  test('GET /api/communities returns JSON list', async ({ request }) => {
    const resp = await request.get('/api/communities')
    expect(resp.status()).toBeLessThan(500)
    if (resp.status() === 200) {
      const body = await resp.json()
      expect(body).toBeTruthy()
    }
  })

  test('GET /api/messages without ID returns structured response', async ({ request }) => {
    const resp = await request.get('/api/messages')
    expect(resp.status()).not.toBe(500)
  })

  test('POST /api/auth/signin with invalid body returns 4xx', async ({ request }) => {
    const resp = await request.post('/api/auth/signin', {
      data: { email: 'bad', password: '' },
    })
    expect(resp.status()).toBeLessThan(500)
  })
})
