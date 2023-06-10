const fs = require('fs').promises;
const path = require('path');
const process = require('process');

const POCKET_TOKEN_PATH = path.join(process.cwd(), 'pocket_token.json');

async function auth() {
  try {
    const requestToken = await fetch('https://getpocket.com/v3/oauth/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: process.env.POCKET_CONSUMER_KEY,
        redirect_uri: process.env.POCKET_REDIRECT_URI,
      }),
    });
    const requestTokenJson = await requestToken.json();
    const token = requestTokenJson.code;
    const tokenPayload = JSON.stringify({
      token,
    });
    const authUrl = `https://getpocket.com/auth/authorize?request_token=${token}&redirect_uri=${process.env.POCKET_REDIRECT_URI}`;
    await fs.writeFile(POCKET_TOKEN_PATH, tokenPayload);
    return { Code: '200', Message: `Please visit the following URL to authorize the app: ${authUrl} ` };
  } catch (err) {
    console.error(err);
  }
}

async function getAccessToken() {
  try {
    const token = await fs.readFile(POCKET_TOKEN_PATH);
    const tokenJson = JSON.parse(token);
    const accessToken = await fetch('https://getpocket.com/v3/oauth/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: process.env.POCKET_CONSUMER_KEY,
        code: tokenJson.token,
      }),
    });
    const accessTokenJson = await accessToken.json();
    return accessTokenJson.access_token;
  } catch (err) {
    console.error(err);
  }
}

async function addUrlToPocket(url) {
  console.log(`Adding ${url} to Pocket`);
  url = encodeURIComponent(url);
  try {
    const pocketAccessToken = await getAccessToken();
    console.log(pocketAccessToken);
    const response = await fetch('https://getpocket.com/v3/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json',
      },
      body: JSON.stringify({
        time: Date.now(),
        consumer_key: process.env.POCKET_CONSUMER_KEY,
        access_token: pocketAccessToken,
        url,
      }),
    });
    // log the status and x-error-code
    console.log(response.status);
    console.log(response.headers.get('x-error-code'));
    const responseJson = await response.json();
    return responseJson;
  } catch (err) {
    console.error(err);
  }
}

module.exports = {
  auth,
  getAccessToken,
  addUrlToPocket,
};
