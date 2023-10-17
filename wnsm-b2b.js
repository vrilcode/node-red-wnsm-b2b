const { default: axios } = require('axios')
const { CookieJar } = require('tough-cookie')
const { wrapper } = require('axios-cookiejar-support')
const cheerio = require('cheerio')
const url = require('node:url')
const qs = require('node:querystring')

const config = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
  logwienBaseUrl: 'https://log.wien/auth/realms/logwien/protocol/openid-connect',
  clientId: 'wn-smartmeter-b2b',
  wnsmPortalUrl: 'https://smartmeter-business.wienernetze.at/',
  wnsmBaseUrl: 'https://api.wstw.at/gateway/WN_SMART_METER_PORTAL_API_B2B/1.0'
}

module.exports = class WnsmB2b {
  credentials
  http
  tokens
  apiKey

  constructor(username, password) {
    this.credentials = {
      username, password
    }
  }

  async call(endpoint, params) {
    if (!this.tokens) {
      // Initial authentication
      await this.#authenticate()
    } else if (this.tokens) {
      const now = Math.round(Date.now() / 1000)
      if (now < this.tokens.expires_at) {
        // Tokens valid, do nothing
      } else if (now < this.tokens.refresh_expires_at) {
        // Access token expired, but refresh token still valid
        try {
          // Refresh tokens
          await this.#refreshToken()
        } catch (e) {
          try {
            // Re-authenticate if token refresh fails
            await this.#authenticate()
          } catch (e) {
            throw new Error('Token refresh and re-authentication failed. Cannot authenticate.')
          }
        }
      } else {
        // Token and refresh token invalid, re-authenticate
        await this.#authenticate()
      }
    }

    let result
    try {
      result = await this.#call2(endpoint, params)
    } catch (e) {
      // If call fails, try again with new authentication
      await this.#authenticate()
      result = await this.#call2(endpoint, params)
    }

    return result.data
  }

  async #call2(endpoint, params) {
    return this.http.get(
      `${config.wnsmBaseUrl}${endpoint}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.tokens.access_token}`,
          'User-Agent': config.userAgent,
          'X-Gateway-APIKey': this.apiKey
        },
        params
      }
    )
  }

  async #authenticate() {
    this.http = wrapper(axios.create({
      headers: {
        'User-Agent': config.userAgent
      },
      jar: new CookieJar(),
      timeout: 60 * 1000
    }))

    try {
      var { data: loginPageHtml } = await this.http.get(
        `${config.logwienBaseUrl}/auth`,
        {
          params: {
            'client_id': config.clientId,
            'redirect_uri': config.wnsmPortalUrl,
            'response_mode': 'fragment',
            'response_type': 'code',
            'scope': 'openid',
            'nonce': ''
          }
        }
      )
    } catch (e) {
      throw new Error(`Failed to retrieve login page: ${e.response.status} ${e.response.statusText}`)
    }
    
    try {
      const $ = cheerio.load(loginPageHtml)
      const loginUrl = $('form#kc-login-form').attr('action')
      var { headers } = await this.http.post(
        loginUrl,
        this.credentials,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          maxRedirects: 0,
          validateStatus: status => status >= 300 && status <= 399
        }
      )
    } catch (e) {
      throw new Error(`Login failed - wrong credentials or application changed`)
    }
  
    // Obtain tokens
  
    const code = qs.parse(url.parse(headers?.location).hash)?.code

    try {
      var { data: tokens } = await this.http.post(
        `${config.logwienBaseUrl}/token`,
        {
          code,
          'grant_type': 'authorization_code',
          'client_id': config.clientId,
          'redirect_uri': config.wnsmPortalUrl
        }, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
    } catch (e) {
      throw new Error(`Failed to obtain tokens: ${e.response.status} ${e.response.statusText}`)
    }

    tokens.expires_at = this.#parseJwt(tokens.access_token).exp
    tokens.refresh_expires_at = this.#parseJwt(tokens.refresh_token).exp

    if (!tokens.expires_at || !tokens.refresh_expires_at) {
      throw new Error(`Failed to get token expiration values`)
    }
  
    // Obtain api key

    try {
      const { data: portalPageHtml } = await this.http.get(
        config.wnsmPortalUrl,
        {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`
          }
        }
      )
      const mainjsFilename = portalPageHtml.match(/\"(main\.[^\.]+\.js)\"/m)[1]
    
      var { data: mainjs } = await this.http.get(`${config.wnsmPortalUrl}${mainjsFilename}`)
    } catch (e) {
      throw new Error(`Failed to obtain API key files: ${e.response.status} ${e.response.statusText}`)
    }

    this.apiKey = mainjs.match(/b2bApiKey:\"([^"]+)\"/m)[1]
    if (!this.apiKey) {
      throw new Error(`Failed to parse API key`)
    }

    this.tokens = tokens
  }

  async #refreshToken() {
    try {
      var { data: tokens } = await this.http.post(
        `${config.logwienBaseUrl}/token`,
        {
          'grant_type': 'refresh_token',
          'refresh_token': this.tokens.refresh_token,
          'client_id': config.clientId,
        }, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
    } catch (e) {
      throw new Error(`Failed to refresh tokens: ${e.response.status} ${e.response.statusText}`)
    }

    tokens.expires_at = this.#parseJwt(tokens.access_token).exp
    tokens.refresh_expires_at = this.#parseJwt(tokens.refresh_token).exp

    if (!tokens.expires_at || !tokens.refresh_expires_at) {
      throw new Error(`Failed to get refreshed token expiration values`)
    }

    this.tokens = tokens
  }

  #parseJwt(token) {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
  }
}