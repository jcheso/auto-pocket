// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true });
const dotenv = require('dotenv');
const process = require('process');

const {
  authorize: authGmail,
  getUnreadEmails,
  getLabels,
  getEmail,
  markEmailAsRead,
  getEmailBody,
} = require('./services/gmail');
const { getRequestToken, addUrlToPocket, getAccessToken, readAccessToken } = require('./services/pocket');

const getUrlsFromBody = (body) => {
  // the body is a block of text, we need to find the url that occurs after one of the keywords
  let urls = [];
  // extract all of the URLs
  let urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = urlRegex.exec(body)) !== null) {
    urls.push(match[1]);
  }
  // remove and urls that contain unsubscribe or signup
  urls = urls.filter(
    (url) =>
      !url.includes('unsubscribe') &&
      !url.includes('signup') &&
      !url.includes('form') &&
      !url.includes('email') &&
      !url.includes('twitter') &&
      !url.includes('tldr.tech')
  );
  // drop the characters after ']'
  urls = urls.map((url) => url.split(']')[0]);
  // remove duplicates
  urls = [...new Set(urls)];
  return urls;
};

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
    const body = await getEmailBody(newsletter.id);
    let urls = getUrlsFromBody(body);
    const listPostHeader = email.payload.headers.find((header) => header.name === 'List-Post');
    if (listPostHeader) {
      urls = urls.push(listPostHeader.value.replace('<', '').replace('>', ''));
    }
    return { urls, id: newsletter.id };
  });
  let newsletters = await Promise.all(newslettersUrls);
  newsletters = newsletters.filter((newsletters) => newsletters);
  const pocketAccessToken = await readAccessToken();
  newsletters.forEach(async (newsletter) => {
    newsletter.urls.forEach(async (url) => {
      await addUrlToPocket(url, pocketAccessToken);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await markEmailAsRead(auth, newsletter.id);
    });
  });
  return 'Added newsletters to Pocket';
});

fastify.get('/callback', async (request, reply) => {
  return { Code: 200, Message: 'Token saved' };
});

fastify.get('/healthz', async (request, reply) => {
  return { Code: 200, Message: 'OK' };
});

// fastify.get('/pocket-auth-request', async (request, reply) => {
//   const res = await getRequestToken();
//   return res;
// });

// fastify.get('/pocket-auth-access', async (request, reply) => {
//   const res = await getAccessToken();
//   return res;
// });

// fastify.get('/gmail-auth', async (request, reply) => {
//   const res = await authGmail();
//   return res;
// });

const start = async () => {
  dotenv.config();
  // Automatically update newsletters every hour
  setInterval(async () => {
    await fastify.inject({
      method: 'GET',
      url: '/update-newsletters',
    });
  }, 3600000);

  fastify.listen({ port: 8080, host: '127.0.0.1' }, function (err, address) {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
  });
};
start();
