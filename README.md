# Quickchat

A WhatsApp-style messaging web app. Sign up, chat 1-to-1 or in groups, send photos and files, add friends, and edit your profile.

Built with React (Vite) on the front, and Express, Prisma and PostgreSQL on the back.

## What you need

- Node.js 20 or newer
- PostgreSQL 14 or newer, running on your PC
- A Cloudinary account (optional; without it, images are saved in the server's `uploads` folder)

## Setup (first time)

1. Create two databases in PostgreSQL: `quickchat` (for development) and `test_quickchat` (for tests only). Never point tests at the dev database.
2. Copy `server/.env.example` to `server/.env` and fill in:
   - `DATABASE_URL` for the dev database
   - `TEST_DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/test_quickchat`
   - `JWT_SECRET` (any long random text)
3. Install and set up the server:
   ```
   cd server
   npm install
   npx prisma migrate deploy
   npm run db:seed
   npm run dev
   ```
4. In a second terminal, install and start the client:
   ```
   cd client
   npm install
   npm run dev
   ```
5. Open the address Vite shows (usually http://localhost:5173).

Demo users from the seed all use the password `Demo1234`. Try `ana`, `ben`, `carla`, `dan` or `eli`.

## Create and migrate the test database

```
createdb test_quickchat          # or create it in pgAdmin
cd server
set DATABASE_URL=%TEST_DATABASE_URL%   # Windows; on Mac/Linux: export DATABASE_URL=$TEST_DATABASE_URL
npx prisma migrate deploy
```

The test setup runs the migrations for you as well, against `TEST_DATABASE_URL` only.

## Run the tests

```
cd server
npm test              # run all tests once (Jest, one file at a time)
npm run test:watch    # re-run when files change
```

The tests use Jest and SuperTest. Integration tests call the Express app directly, and the database is emptied before each test. Unit tests check the pure helpers (validators, formatting, unread counts, online status) without a database.

## Deploy

**API and database (Render or Railway)**

1. Create a PostgreSQL database and copy its connection URL into `DATABASE_URL`.
2. Create a Web Service from the `server` folder. Build command: `npm install && npx prisma migrate deploy`. Start command: `npm start`.
3. Set `JWT_SECRET`, `CLIENT_ORIGIN` (your client's web address), and Cloudinary keys if you use them.

**Client (Vercel or Netlify)**

1. Import the `client` folder as a Vite project. Build command: `npm run build`. Output folder: `dist`.
2. Set `VITE_API_URL` to your API's web address, for example `https://quickchat-api.onrender.com`.
3. Redeploy the client after changing that value.

## Keep in mind

- Change the demo passwords before any real launch, or delete the demo users.
- Keep `.env` files out of Git. Only `.env.example` belongs in the repo.
- The chat checks for new messages every 5 seconds. It is not instant, by design.
