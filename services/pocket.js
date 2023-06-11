const fs = require('fs').promises;
const path = require('path');
const process = require('process');

const POCKET_REQUEST_TOKEN_PATH = path.join(process.cwd(), 'pocket_request_token.json');
const POCKET_ACCESS_TOKEN_PATH = path.join(process.cwd(), 'pocket_access_token.json');

async function getRequestToken() {
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
    if (requestToken.status !== 200) {
      console.log('Pocket Request Token Status: ', requestToken.status);
      console.log('Pocket Request Token Headers: ', requestToken.headers.get('x-error-code'));
      throw new Error('Request Token not received');
    }
    const requestTokenJson = await requestToken.json();
    const token = requestTokenJson.code;
    const tokenPayload = JSON.stringify({
      token,
    });
    const authUrl = `https://getpocket.com/auth/authorize?request_token=${token}&redirect_uri=${process.env.POCKET_REDIRECT_URI}`;
    await fs.writeFile(POCKET_REQUEST_TOKEN_PATH, tokenPayload);
    return { Code: '200', Message: `Please visit the following URL to authorize the app: ${authUrl} ` };
  } catch (err) {
    console.error(err);
  }
}

async function getAccessToken() {
  try {
    const token = await fs.readFile(POCKET_REQUEST_TOKEN_PATH);
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
    if (accessToken.status !== 200) {
      console.log('Pocket Access Token Status: ', accessToken.status);
      console.log('Pocket Access Token Headers: ', accessToken.headers.get('x-error-code'));
      throw new Error('Access Token not found');
    }
    const accessTokenJson = await accessToken.json();
    const accessTokenPayload = JSON.stringify({
      access_token: accessTokenJson.access_token,
    });
    await fs.writeFile(POCKET_ACCESS_TOKEN_PATH, accessTokenPayload);
    return accessTokenJson.access_token;
  } catch (err) {
    console.error(err);
  }
}

async function readAccessToken() {
  try {
    const token = await fs.readFile(POCKET_ACCESS_TOKEN_PATH);
    const tokenJson = JSON.parse(token);
    return tokenJson.access_token;
  } catch (err) {
    console.error(err);
  }
}

async function addUrlToPocket(url, pocketAccessToken) {
  console.log(`Adding ${url} to Pocket`);
  try {
    if (!pocketAccessToken) {
      throw new Error('No Pocket Access Token found');
    }
    const requestConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: process.env.POCKET_CONSUMER_KEY,
        access_token: pocketAccessToken,
        url,
      }),
    };
    const response = await fetch('https://getpocket.com/v3/add', requestConfig);
    if (response.status !== 200) {
      console.log('Add URL Status: ', response.status);
      console.log('Add URL Error Code: ', response.headers.get('x-error-code'));
      console.log('Add URL Error: ', response.headers.get('x-error'));
      throw new Error('Add URL failed');
    }
    const responseJson = await response.json();
    return { Code: '200', Message: `URL added to Pocket: ${responseJson.item.title}` };
  } catch (err) {
    console.error(err);
  }
}

module.exports = {
  getRequestToken,
  getAccessToken,
  readAccessToken,
  addUrlToPocket,
};
