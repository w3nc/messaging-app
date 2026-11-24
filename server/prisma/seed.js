// Fills the dev database with 5 demo users, friends, chats and a group.
// Safe to run twice: if the demo users already exist, it stops and changes nothing.
// Demo password for every user: Demo1234 (change it before any real launch).
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

const DEMO_PASSWORD = 'Demo1234';

const people = [
  { username: 'ana', email: 'ana@demo.quickchat', displayName: 'Ana Reyes', title: 'Barista owner', bio: 'Coffee, cats and early mornings.', avatarColor: '#00a884' },
  { username: 'ben', email: 'ben@demo.quickchat', displayName: 'Ben Santos', title: 'Web developer', bio: 'Shipping small things every week.', avatarColor: '#53bdeb' },
  { username: 'carla', email: 'carla@demo.quickchat', displayName: 'Carla Cruz', title: 'Designer', bio: 'Posters, logos and bad puns.', avatarColor: '#f15c6d' },
  { username: 'dan', email: 'dan@demo.quickchat', displayName: 'Dan Lim', title: 'Teacher', bio: 'Teaching maths, mostly on weekends.', avatarColor: '#ffb74d' },
  { username: 'eli', email: 'eli@demo.quickchat', displayName: 'Eli Tan', title: 'Photographer', bio: 'Always carrying a camera.', avatarColor: '#9575cd' },
];

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: people[0].username } });
  if (existing) {
    console.log('Demo users already exist. Nothing changed.');
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = {};
  for (const p of people) {
    users[p.username] = await prisma.user.create({ data: { ...p, passwordHash } });
  }
  const [ana, ben, carla, dan, eli] = ['ana', 'ben', 'carla', 'dan', 'eli'].map((k) => users[k]);

  // Friendships go both ways.
  const pairs = [[ana, ben], [ana, carla], [ben, dan], [carla, eli]];
  for (const [a, b] of pairs) {
    await prisma.friendship.createMany({
      data: [
        { userId: a.id, friendId: b.id },
        { userId: b.id, friendId: a.id },
      ],
    });
  }

  // One request still waiting, so the Friend requests section has something to show.
  await prisma.friendship.create({ data: { userId: dan.id, friendId: ana.id, status: 'pending' } });

  // 1-to-1 chats with a few messages each.
  const chats = [
    [ana, ben, [[ana, 'Hey Ben, are you free for the demo today?'], [ben, 'Yes! Give me 30 minutes.'], [ana, 'Perfect, see you then.']]],
    [ana, carla, [[carla, 'I sent the new poster draft.'], [ana, 'Looks great, thank you!']]],
    [ben, dan, [[dan, 'Can you check my quiz page?'], [ben, 'Sure, I will look after lunch.']]],
  ];
  for (const [a, b, msgs] of chats) {
    const convo = await prisma.conversation.create({
      data: { isGroup: false, members: { create: [{ userId: a.id }, { userId: b.id }] } },
    });
    for (const [sender, text] of msgs) {
      await prisma.message.create({ data: { conversationId: convo.id, senderId: sender.id, text } });
    }
  }

  // One group chat.
  const group = await prisma.conversation.create({
    data: {
      isGroup: true,
      name: 'Weekend Crew',
      members: { create: [ana, ben, carla, eli].map((u) => ({ userId: u.id })) },
    },
  });
  await prisma.message.create({ data: { conversationId: group.id, senderId: eli.id, text: 'Who is bringing the camera on Saturday?' } });
  await prisma.message.create({ data: { conversationId: group.id, senderId: carla.id, text: 'Me! I will bring snacks too.' } });

  console.log(`Seeded ${people.length} demo users (password: ${DEMO_PASSWORD}), 3 chats and 1 group.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
