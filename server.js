// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true });
const dotenv = require('dotenv');

const { authorize, getUnreadEmails, getLabels, getEmail, markEmailAsRead } = require('./utils/gmail');
const { auth, addUrlToPocket } = require('./utils/pocket');

fastify.get('/update-newsletters', async (request, reply) => {
  const auth = await authorize();
  const labels = await getLabels(auth);
  const newslettersLabel = labels.find((label) => label.name === 'Newsletters');
  const unreadNewsletters = await getUnreadEmails(auth, newslettersLabel);
  const newsLettersUrls = unreadNewsletters.map(async (newsletter) => {
    const email = await getEmail(auth, newsletter.id);
    await markEmailAsRead(auth, newsletter.id);
    const listPostHeader = email.payload.headers.find((header) => header.name === 'List-Post');
    const newsletterUrl = listPostHeader.value.replace('<', '').replace('>', '');
    return newsletterUrl;
  });
  const urls = await Promise.all(newsLettersUrls);
  const results = [];
  urls.forEach(async (url) => {
    const result = await addUrlToPocket(url);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    results.push(result);
  });
  return results;
});

fastify.get('/pocket-auth', async (request, reply) => {
  const res = await auth();
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
