// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true });
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const process = require('process');

const { authorize: authGmail, getUnreadEmails, getLabels, getEmail, markEmailAsRead } = require('./services/gmail');
const { getRequestToken, addUrlToPocket, getAccessToken } = require('./services/pocket');

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
  const results = [];
  urls.forEach(async (url) => {
    const result = await addUrlToPocket(url);
    if (result.status === 1) {
      await markEmailAsRead(auth, newsletter.id);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    results.push(result);
  });
  return result;
});

// Endpoint to check token is valid for pocket
fastify.get('/test-pocket', async (request, reply) => {
  const url =
    'https://techcrunch.com/2023/06/09/techcrunch-roundup-okr-basics-betting-on-apple-vision-pro-why-smooth-onboarding-is-bad/';
  const result = await addUrlToPocket(url);
  return result;
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
