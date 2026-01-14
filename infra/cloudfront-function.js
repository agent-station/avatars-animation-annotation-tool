function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Check if URI ends with / or has no file extension
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } else if (!uri.includes('.')) {
        // No file extension, assume it's a directory
        request.uri += '/index.html';
    }

    return request;
}
