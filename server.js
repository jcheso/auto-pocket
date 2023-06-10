// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true });
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const process = require('process');

const { authorize: authGmail, getUnreadEmails, getLabels, getEmail, markEmailAsRead } = require('./utils/gmail');
const { auth: authPocket, addUrlToPocket } = require('./utils/pocket');

fastify.get('/update-newsletters', async (request, reply) => {
  const auth = await authGmail();
  const labels = await getLabels(auth);
  const newslettersLabel = labels.find((label) => label.name === 'Newsletters');
  if (!newslettersLabel) {
    return { Code: 200, Message: 'No newsletters label' };
  }
  const unreadNewsletters = await getUnreadEmails(auth, newslettersLabel);
  if (!unreadNewsletters) {
    return { Code: 200, Message: 'No unread newsletters' };
  }
  const newsLettersUrls = unreadNewsletters.map(async (newsletter) => {
    const email = await getEmail(auth, newsletter.id);
    const listPostHeader = email.payload.headers.find((header) => header.name === 'List-Post');
    if (!listPostHeader) {
      return null;
    }
    const newsletterUrl = listPostHeader.value.replace('<', '').replace('>', '');
    return newsletterUrl;
  });
  const urls = await Promise.all(newsLettersUrls);
  const url = urls[0];
  const result = await addUrlToPocket(url);
  // const results = [];
  // urls.forEach(async (url) => {
  //   const result = await addUrlToPocket(url);
  // if result is success, mark email as read
  //   await new Promise((resolve) => setTimeout(resolve, 1000));
  //   results.push(result);
  // });
  return result;
});

fastify.get('/pocket-auth', async (request, reply) => {
  const res = await authPocket();
  return res;
});

fastify.get('/callback', async (request, reply) => {
  return { Code: 200, Message: 'Token saved' };
});

fastify.get('/gmail-auth', async (request, reply) => {
  const res = await authGmail();
  return res;
});

const start = async () => {
  const POCKET_TOKEN_PATH = path.join(process.cwd(), 'pocket_token.json');
  const GOOGLE_TOKEN_PATH = path.join(process.cwd(), 'token.json');
  try {
    dotenv.config();
    if (!fs.existsSync(GOOGLE_TOKEN_PATH)) {
      await authGmail();
    }
    if (!fs.existsSync(POCKET_TOKEN_PATH)) {
      await authPocket();
    }
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
