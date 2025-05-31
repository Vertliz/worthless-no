// YouTube API Configuration
const API_KEY = "AIzaSyAwjqv6y3HalMxKXg9fvlJiFU-_E1hgWmQ";
const CHANNEL_ID = "UCwMjRVVmjL9l9_IWNcUwDHQ";

// CORS Headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // Parse the request URL
    const url = new URL(request.url);
      // Route requests based on the path
    switch (url.pathname) {
      case '/':
        return getLatestVideo();
      case '/stats':
        return getChannelStats(request);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }
};

async function getLatestVideo() {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=1&type=video`
    );
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const videoId = data.items[0].id.videoId;
      return new Response(videoId, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        }
      });
    }
    
    return new Response('No video found', {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response('Error fetching video', {
      status: 500,
      headers: corsHeaders
    });
  }
}

async function getChannelStats(request) {
  try {
    console.log('Fetching channel stats...');
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${API_KEY}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('YouTube API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`YouTube API returned ${response.status}: ${errorText}`);
    }    const data = await response.json();
    console.log('API Response:', data);
    
    if (data.items && data.items.length > 0) {
      const stats = data.items[0].statistics;
      
      const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
  <title>YouTube Channel Stats</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      background: #1a1a1a;
      color: #fff;
    }
    .stat {
      background: #2d2d2d;
      padding: 20px;
      margin: 10px 0;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .label {
      font-size: 1.2em;
      color: #7adbff;
    }
    .value {
      font-size: 1.5em;
      font-weight: bold;
      color: #a67bff;
    }
    h1 {
      text-align: center;
      color: #7adbff;
      margin-bottom: 30px;
    }
  </style>
</head>
<body>
  <h1>Vertliz YouTube Stats</h1>
  <div class="stat">
    <span class="label">Subscribers:</span>
    <span class="value">${stats.subscriberCount}</span>
  </div>
  <div class="stat">
    <span class="label">Videos:</span>
    <span class="value">${stats.videoCount}</span>
  </div>
  <div class="stat">
    <span class="label">Total Views:</span>
    <span class="value">${stats.viewCount}</span>
  </div>
</body>
</html>`;

      // Return HTML for direct visits, JSON for API requests
      const accept = request.headers.get('Accept') || '';
      if (accept.includes('text/html')) {
        return new Response(htmlResponse, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=300'
          }
        });
      } else {
        return new Response(JSON.stringify({
          subscribers: stats.subscriberCount,
          videos: stats.videoCount,
          views: stats.viewCount
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }
    }
      return new Response('Channel not found', {
      status: 404,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Error in getChannelStats:', error);
    const errorMessage = `Error fetching stats: ${error.message}`;
    
    // Return HTML error for browser requests, JSON error for API requests
    const accept = request.headers.get('Accept') || '';
    if (accept.includes('text/html')) {
      const htmlError = `
<!DOCTYPE html>
<html>
<head>
  <title>Error - YouTube Stats</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      background: #1a1a1a;
      color: #fff;
      text-align: center;
    }
    .error {
      background: #2d2d2d;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      border: 1px solid #ff7a7a;
    }
    h1 { color: #ff7a7a; }
  </style>
</head>
<body>
  <h1>Error</h1>
  <div class="error">${errorMessage}</div>
</body>
</html>`;
      return new Response(htmlError, {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        }
      });
    } else {
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
}

// Utility function to validate responses
async function validateResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`YouTube API error: ${text}`);
  }
  return response;
}
