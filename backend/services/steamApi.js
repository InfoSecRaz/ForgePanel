const https = require('https');
const db = require('../db/db');

function getApiKey() {
  return process.env.STEAM_API_KEY || (db.prepare("SELECT value FROM settings WHERE key = 'steam_api_key'").get() || {}).value;
}

function getRequest(endpoint, params) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString();
    https.get(`https://api.steampowered.com${endpoint}?${query}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Steam API returned invalid JSON: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

// GetPublishedFileDetails / GetCollectionDetails are documented as POST-only, unlike
// QueryFiles above (confirmed via live "Method Not Allowed" response to require GET).
function postForm(endpoint, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const req = https.request({
      hostname: 'api.steampowered.com',
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Steam API returned invalid JSON: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// GetPlayerSummaries resolves SteamID64s (QueryFiles only returns each item's numeric
// "creator" ID, not a display name) to persona names. Best-effort: search results are still
// useful without author names, so a failure here just leaves authors blank rather than
// failing the whole search.
async function getPlayerNames(steamIds) {
  const apiKey = getApiKey();
  const unique = [...new Set(steamIds.filter(Boolean))];
  if (!apiKey || unique.length === 0) return {};

  try {
    const result = await getRequest('/ISteamUser/GetPlayerSummaries/v2/', {
      key: apiKey,
      steamids: unique.join(',')
    });
    const names = {};
    for (const player of (result.response && result.response.players) || []) {
      names[player.steamid] = player.personaname;
    }
    return names;
  } catch (err) {
    return {};
  }
}

async function searchWorkshop(appid, query, page = 1) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Steam API key is not configured. Set it in Settings.');

  const result = await getRequest('/IPublishedFileService/QueryFiles/v1/', {
    key: apiKey,
    query_type: 0,
    appid,
    search_text: query || '',
    page,
    numperpage: 30,
    return_short_description: true,
    return_previews: true
  });

  const items = result.response.publishedfiledetails || [];
  const authorNames = await getPlayerNames(items.map((item) => item.creator));

  return items.map((item) => ({
    id: item.publishedfileid,
    title: item.title,
    description: item.short_description,
    thumbnailUrl: item.preview_url,
    fileType: item.file_type,
    subscriptions: item.subscriptions,
    timeUpdated: item.time_updated,
    author: authorNames[item.creator] || null
  }));
}

async function getItemDetails(itemId) {
  const result = await postForm('/ISteamRemoteStorage/GetPublishedFileDetails/v1/', {
    itemcount: 1,
    'publishedfileids[0]': itemId
  });
  return (result.response.publishedfiledetails || [])[0];
}

async function getCollectionChildren(collectionId, seen = new Set()) {
  if (seen.has(collectionId)) return [];
  seen.add(collectionId);

  const result = await postForm('/ISteamRemoteStorage/GetCollectionDetails/v1/', {
    collectioncount: 1,
    'publishedfileids[0]': collectionId
  });

  const details = (result.response.collectiondetails || [])[0];
  if (!details || !details.children) return [];

  let items = [];
  for (const child of details.children) {
    if (child.filetype === 2) {
      const nested = await getCollectionChildren(child.publishedfileid, seen);
      items = items.concat(nested);
    } else {
      items.push(child.publishedfileid);
    }
  }
  return items;
}

async function resolveCollection(collectionId) {
  const childIds = await getCollectionChildren(collectionId);
  const details = await Promise.all(childIds.map((id) => getItemDetails(id)));
  return details.filter(Boolean).map((item) => ({
    id: item.publishedfileid,
    title: item.title,
    thumbnailUrl: item.preview_url
  }));
}

module.exports = { searchWorkshop, getItemDetails, resolveCollection, getApiKey };
