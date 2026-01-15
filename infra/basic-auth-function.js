// CloudFront Function for Basic Authentication
// Credentials: agsn / 11CX7BF2awHfbSuGvCmhZ
var BASIC_AUTH_CREDENTIALS = 'YWdzbjoxMUNYN0JGMmF3SGZiU3VHdkNtaFo=';

function handler(event) {
    var request = event.request;
    var headers = request.headers;
    var authHeader = headers.authorization;

    // Check for Basic Auth header
    if (authHeader && authHeader.value === 'Basic ' + BASIC_AUTH_CREDENTIALS) {
        // Auth successful - handle SPA routing
        var uri = request.uri;
        if (uri.endsWith('/')) {
            request.uri += 'index.html';
        } else if (!uri.includes('.')) {
            request.uri += '/index.html';
        }
        return request;
    }

    // Return 401 Unauthorized with WWW-Authenticate header
    return {
        statusCode: 401,
        statusDescription: 'Unauthorized',
        headers: {
            'www-authenticate': { value: 'Basic realm="Animation Reviewer"' },
            'content-type': { value: 'text/plain' }
        },
        body: 'Unauthorized'
    };
}
