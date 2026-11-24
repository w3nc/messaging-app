const prisma = require('./prisma');

// The one channel everyone lands in: new sign-ups, visitors, and existing users on their next chat list load.
const GLOBAL_CHANNEL_NAME = 'Quickchat Global';

// Finds the global channel (creating it the first time), then makes sure this user is a member.
async function joinGlobalChannel(userId) {
  let channel = await prisma.conversation.findFirst({
    where: { isGlobal: true },
    select: { id: true },
  });
  if (!channel) {
    channel = await prisma.conversation.create({
      data: { isGroup: true, isGlobal: true, name: GLOBAL_CHANNEL_NAME },
      select: { id: true },
    });
  }
  await prisma.member.upsert({
    where: { userId_conversationId: { userId, conversationId: channel.id } },
    update: {},
    create: { userId, conversationId: channel.id },
  });
  return channel.id;
}

module.exports = { joinGlobalChannel, GLOBAL_CHANNEL_NAME };
