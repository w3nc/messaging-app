// Storage is mocked, so no files are written and no Cloudinary calls are made.
jest.mock('../src/lib/storage', () => ({
  saveImage: jest.fn(async () => 'https://test.local/avatars/fake.png'),
  UPLOAD_DIR: '/tmp/unused',
}));

const request = require('supertest');
const app = require('../src/app');
const { createUser, authHeader } = require('./helpers');

// Smallest valid PNG, built from its real first bytes (magic numbers).
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

describe('DELETE /me/avatar', () => {
  it('removes the profile photo and returns the user without it', async () => {
    const { token } = await createUser();
    await request(app)
      .post('/me/avatar')
      .set(authHeader(token))
      .attach('image', PNG, { filename: 'me.png', contentType: 'image/png' })
      .expect(200);

    const res = await request(app).delete('/me/avatar').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBeNull();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('needs a signed-in user', async () => {
    const res = await request(app).delete('/me/avatar');
    expect(res.status).toBe(401);
  });
});
