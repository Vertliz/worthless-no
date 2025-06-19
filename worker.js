// YouTube API configuration
const API_KEY = "AIzaSyDsi1xLKmaCHmIKuxR9WE5fw7JmUj7XGBI"; // Your YouTube API key
const CHANNEL_ID = "UCKGnDJb82iW2kXSLhPk6bZQ"; // Your YouTube channel ID

// CORS Headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Cache-Control",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    // Handle CORS preflight requests first
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url); // Only handle API routes, Pages handles static files
    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Route API requests
    switch (url.pathname) {
      case "/api/latest":
        return getLatestVideo(API_KEY, CHANNEL_ID);
      case "/api/stats":
        return getChannelStats(request, API_KEY, CHANNEL_ID);
      case "/api/videos":
        return getRecentVideos(request, API_KEY, CHANNEL_ID);
      case "/api/health":
        return new Response(
          JSON.stringify({
            status: "healthy",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            hasApiKey: !!API_KEY,
            hasChannelId: !!CHANNEL_ID,
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      default:
        // Try to serve static asset one more time for non-API routes
        if (!url.pathname.startsWith("/api/")) {
          try {
            return await getAssetFromKV({
              request,
              waitUntil: ctx.waitUntil.bind(ctx),
            });
          } catch (error) {
            console.error("Error serving static asset:", error);
          }
        }
        return new Response("Not Found", {
          status: 404,
          headers: corsHeaders,
        });
    }
  },
};

// Get the latest video from the channel
const getLatestVideo = async (API_KEY, CHANNEL_ID) => {
  try {
    // First, get the channel's uploads playlist ID
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`
    ).then(validateResponse);

    const channelData = await channelResponse.json();
    const uploadsPlaylistId =
      channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Then, get the latest video from that playlist
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${API_KEY}`
    ).then(validateResponse);

    const videosData = await videosResponse.json();
    const latestVideo = videosData.items[0].snippet;

    return new Response(
      JSON.stringify({
        title: latestVideo.title,
        description: latestVideo.description,
        thumbnails: latestVideo.thumbnails,
        publishedAt: latestVideo.publishedAt,
        videoId: latestVideo.resourceId.videoId,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error("Error in getLatestVideo:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch latest video",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
};

// Get channel statistics
const getChannelStats = async (request, API_KEY, CHANNEL_ID) => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${API_KEY}`
    ).then(validateResponse);

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error("Channel not found");
    }

    const stats = data.items[0].statistics;

    // Format the response based on the Accept header
    const accept = request.headers.get("Accept") || "";
    if (accept.includes("text/html")) {
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
  <h1>Channel Statistics</h1>
  <div class="stat">
    <span class="label">Subscribers:</span>
    <span class="value">${stats.subscriberCount || "Hidden"}</span>
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

      return new Response(htmlResponse, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=300",
        },
      });
    } else {
      return new Response(
        JSON.stringify({
          subscribers: parseInt(stats.subscriberCount) || 0,
          videos: parseInt(stats.videoCount) || 0,
          views: parseInt(stats.viewCount) || 0,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
          },
        }
      );
    }
  } catch (error) {
    console.error("Error in getChannelStats:", error);
    const errorMessage = `Error fetching stats: ${error.message}`;

    // Return appropriate error format based on Accept header
    const accept = request.headers.get("Accept") || "";
    if (accept.includes("text/html")) {
      return new Response(
        `
<!DOCTYPE html>
<html>
<head>
  <title>Error - Channel Stats</title>
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
</html>`,
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html",
          },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  }
};

// Get recent videos from the channel
const getRecentVideos = async (request, API_KEY, CHANNEL_ID) => {
  try {
    // First, get the channel's uploads playlist ID
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`
    ).then(validateResponse);

    const channelData = await channelResponse.json();
    const uploadsPlaylistId =
      channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Then, get the latest videos from that playlist
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=5&key=${API_KEY}`
    ).then(validateResponse);

    const data = await videosResponse.json();

    if (!data.items || data.items.length === 0) {
      return new Response(
        JSON.stringify({
          videos: [],
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const videos = data.items.map((item) => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      thumbnails: item.snippet.thumbnails,
    }));

    return new Response(
      JSON.stringify({
        videos,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error("Error in getRecentVideos:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch recent videos",
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
};

// Helper function to validate YouTube API responses
const validateResponse = async (response) => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`YouTube API error: ${text}`);
  }
  return response;
};
