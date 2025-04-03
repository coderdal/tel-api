const PROXY_URL = process.env.PROXY_URL;

function getProxyConfig() {
    const proxyUrl = new URL(PROXY_URL);
    return {
        server: `http://${proxyUrl.host}`,
        username: proxyUrl.username,
        password: proxyUrl.password
    };
}

module.exports = { getProxyConfig }; 