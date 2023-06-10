// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true });
const { authorize, getUnreadEmails, getLabels, getEmail } = require('./utils/gmail');

fastify.get('/update-newsletters', async (request, reply) => {
  const auth = await authorize();
  const labels = await getLabels(auth);
  const newslettersLabel = labels.find((label) => label.name === 'Newsletters');
  const unreadNewsletters = await getUnreadEmails(auth, newslettersLabel);
  const newsLettersUrls = unreadNewsletters.map(async (newsletter) => {
    const email = await getEmail(auth, newsletter.id);
    const listPostHeader = email.payload.headers.find((header) => header.name === 'List-Post');
    const newsletterUrl = listPostHeader.value.replace('<', '').replace('>', '');
    return newsletterUrl;
  });
  const urls = await Promise.all(newsLettersUrls);
  return { urls };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
