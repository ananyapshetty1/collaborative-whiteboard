import crypto, { verify } from 'crypto';
import fernet from 'fernet';
import express from 'express';
import 'dotenv/config';

const app = express();
const PORT = 7766;
const secret = new fernet.Secret(process.env.FERNET_KEY);

// since the client is a browser-based app, and is "public", the client id is not really secret, neither is the redirect url.
/*
  Flow:
  Web app <request authorization code from auth server, passing user credentials> -> auth server
  Web app <- <receives authorization code with scope (user id)> auth server
  Web app <exchanges authorization code for access token> auth server
  Web app stores the access token in local storage 
*/

/* req body
{
  username: <hashed username>
  password: <hashed password>
  accountExists: <boolean>
}
*/
const authorizationCodes = {};
const registeredClients = [
  {
    client_id: "sample-client-id",
    client_secret: "sample-client-id",
    redirect_url: "https://localhost:5180/oauthredirect",
  },
]
const CODE_LIFE_SPAN = 60000; // 60 seconds
const TOKEN_LIFE_SPAN = 3600000

app.post('/auth', (req, res) => {
  const {
    response_type,
    client_id,
    redirect_url
  } = req.params;

  const {
    user,
    password
  } = req.body;

  // handle differently depending on response type
  // current only authorization code flow is supported
  if (response_type === "code") {
    if (typeof client_id === undefined || typeof redirect_url === undefined || client_id !== process.env.VALID_CLIENT) { // add redirect url check also
      res.status(400).send("Invalid request");
      return;
    }

    if (!verifyClientInfo(client_id, redirect_url)) {
      res.status(400).send("Invalid client");
      return;
    }

    if (!authenticateUser(user, password)) {
      res.status(400).send("Invalid user credentials");
      return;
    }
    const authorizationCode = generateAuthorizationCode(user, client_id, redirect_url);
    res.status(303).redirect(redirect_url + "?code=" + authorizationCode);
  } else {
    res.status(400).send("Invalid response type");
  }
});

function authenticateUser(user, password) {

}

function verifyClientInfo(client_id, redirect_url) {

}

function authenticateClient(client_id, client_secret) {

}

function verifyAuthorizationCode(client_id, redirect_url) {
  
}

function generateAuthorizationCode(user, client_id, redirect_url) {
  const encryptedToken = new fernet.Token({
    secret,
  });
  const data = {
    user,
    client_id,
    redirect_url
  };
  encryptedToken.encode(JSON.stringify(data));
  // console.log(
  //   new fernet.Token({
  //     secret,
  //     token: encryptedToken.token,
  //     ttl: 0
  //   }).decode()
  // );
  const code = encryptedToken.token;
  authorizationCodes[code] = {
    client_id,
    redirect_url,
    exp: new Date.now() + CODE_LIFE_SPAN
  }
  return code;
}

// get token from authorization code
app.post('/token', (req, res) => {
  const {
    grant_type,
    authorizationCode,
    client_id,
    client_secret,
    redirect_url
  } = req.body;

  if (grant_type != "authorization_code" || !authorizationCode || !client_id || !client_secret || !redirect_url) {
    res.send(400).send("Invalid request");
    return;
  }

  if (!authenticateClient(client_id, client_secret)) {
    return res.send(400).send("Invalid client");
  }

  const accessToken = generateAccessToken(authorizationCode, client_id, redirect_url);
  if (!accessToken) {
    return res.send(400).send("Access denied");
  }
});

function generateAccessToken(authorizationCode, client_id, redirect_url) {
  const data = JSON.parse(new fernet.Token({
    secret,
    token: authorizationCode,
    ttl: 0
  }).decode());

  const {
    user,
    data_client_id,
    data_redirect_url,
  } = data;

  if (!verifyAuthorizationCode(client_id, redirect_url)) {
    return null;
  }

  const payload = {
    user,
    iss: ISSUER,
    exp: Date.now() + TOKEN_LIFE_SPAN
  };

  const accessToken = {
    access_token: payload,
    token_type: "JWT",
    expires_in: payload.exp
  };

  return JSON.stringify(accessToken);
}

app.listen(PORT, () => {
  console.log(`auth server listening on port ${PORT}`);
});