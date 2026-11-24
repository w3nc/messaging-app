// Storage is mocked, so no files are written and no Cloudinary calls are made.
jest.mock('../src/lib/storage', () => ({
  saveImage: jest.fn(async (buffer, mimetype, folder) => `https://test.local/${folder}/fake.${mimetype.split('/')[1]}`),
  UPLOAD_DIR: '/tmp/unused',
}));

const request = require('supertest');
const app = require('../src/app');
const { saveImage } = require('../src/lib/storage');
const { createUser, authHeader, createConversation } = require('./helpers');

// Smallest valid files, built from their real first bytes (magic numbers).
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);

beforeEach(() => saveImage.mockClear());

describe('POST /conversations/:id/images', () => {
  it('sends a PNG image with an optional caption', async () => {
    const { user: bob } = await createUser();
    const { user: alice, token } = await createUser();
    const convo = await createConversation([alice, bob]);

    const res = await request(app)
      .post(`/conversations/${convo.id}/images`)
      .set(authHeader(token))
      .field('text', 'Look at this')
      .attach('image', PNG, { filename: 'pic.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.message.imageUrl).toBe('https://test.local/chat/fake.png');
    expect(res.body.message.text).toBe('Look at this');
    expect(saveImage).toHaveBeenCalledTimes(1);
  });

  it('rejects a text file renamed to .jpg (fake image) with 400', async () => {
    const { user: bob } = await createUser();
    const { user: alice, token } = await createUser();
    const convo = await createConversation([alice, bob]);

    const res = await request(app)
      .post(`/conversations/${convo.id}/images`)
      .set(authHeader(token))
      .attach('image', Buffer.from('this is plain text, not a picture at all'), {
        filename: 'fake.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(saveImage).not.toHaveBeenCalled();
  });

  it('rejects a non-image type with 400', async () => {
    const { user: bob } = await createUser();
    const { user: alice, token } = await createUser();
    const convo = await createConversation([alice, bob]);

    const res = await request(app)
      .post(`/conversations/${convo.id}/images`)
      .set(authHeader(token))
      .attach('image', Buffer.from('%PDF-1.4 some pdf'), { filename: 'a.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
  });

  it('returns 403 to a non-member', async () => {
    const { user: bob } = await createUser();
    const { user: alice } = await createUser();
    const { token: outsider } = await createUser();
    const convo = await createConversation([alice, bob]);

    const res = await request(app)
      .post(`/conversations/${convo.id}/images`)
      .set(authHeader(outsider))
      .attach('image', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
  });
});

describe('POST /me/avatar', () => {
  it('stores a profile picture and returns the user with avatarUrl', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .post('/me/avatar')
      .set(authHeader(token))
      .attach('image', JPEG, { filename: 'me.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBe('https://test.local/avatars/fake.jpeg');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 400 when no file is sent', async () => {
    const { token } = await createUser();
    const res = await request(app).post('/me/avatar').set(authHeader(token));
    expect(res.status).toBe(400);
  });
});
