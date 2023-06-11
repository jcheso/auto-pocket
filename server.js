// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true });
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const process = require('process');

const { authorize: authGmail, getUnreadEmails, getLabels, getEmail, markEmailAsRead } = require('./services/gmail');
const { getRequestToken, addUrlToPocket, getAccessToken, readAccessToken } = require('./services/pocket');

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
  const newslettersUrls = unreadNewsletters.map(async (newsletter) => {
    const email = await getEmail(auth, newsletter.id);
    const listPostHeader = email.payload.headers.find((header) => header.name === 'List-Post');
    if (!listPostHeader) {
      return null;
    }
    const url = listPostHeader.value.replace('<', '').replace('>', '');
    return { url, id: newsletter.id };
  });
  let newsletters = await Promise.all(newslettersUrls);
  newsletters = newsletters.filter((newsletters) => newsletters);
  const results = [];
  const pocketAccessToken = await readAccessToken();
  newsletters.forEach(async (newsletter) => {
    const result = await addUrlToPocket(newsletter.url, pocketAccessToken);
    if (result.Code === '200') {
      await markEmailAsRead(auth, newsletter.id);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    results.push(result);
  });
  return results;
});

fastify.get('/pocket-auth-request', async (request, reply) => {
  const res = await getRequestToken();
  return res;
});

fastify.get('/pocket-auth-access', async (request, reply) => {
  const res = await getAccessToken();
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
  try {
    dotenv.config();
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
