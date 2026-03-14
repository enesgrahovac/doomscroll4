const DAILY_LIMIT = 500;
const COUNT_KEY = "ds4_api_count";
const COUNT_DATE_KEY = "ds4_api_count_date";

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[DS4] Extension installed (${details.reason})`);
  chrome.storage.sync.set({
    [COUNT_KEY]: 0,
    [COUNT_DATE_KEY]: new Date().toDateString(),
  });
});

async function getDailyCount(): Promise<number> {
  const result = await chrome.storage.sync.get([COUNT_KEY, COUNT_DATE_KEY]);
  const today = new Date().toDateString();

  if (result[COUNT_DATE_KEY] !== today) {
    await chrome.storage.sync.set({
      [COUNT_KEY]: 0,
      [COUNT_DATE_KEY]: today,
    });
    return 0;
  }

  return (result[COUNT_KEY] as number) ?? 0;
}

async function incrementCount(): Promise<{ allowed: boolean; count: number }> {
  const count = await getDailyCount();
  if (count >= DAILY_LIMIT) {
    return { allowed: false, count };
  }
  const newCount = count + 1;
  await chrome.storage.sync.set({ [COUNT_KEY]: newCount });
  return { allowed: true, count: newCount };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ds4_check_limit") {
    getDailyCount().then((count) => {
      sendResponse({ allowed: count < DAILY_LIMIT, count });
    });
    return true;
  }

  if (message.type === "ds4_increment") {
    incrementCount().then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.type === "ds4_classify") {
    const { apiUrl, apiKey, body } = message;
    fetch(`${apiUrl}/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          sendResponse({ error: `API returned ${res.status}` });
          return;
        }
        const data = await res.json();
        sendResponse(data);
      })
      .catch((err) => {
        sendResponse({ error: String(err) });
      });
    return true; // async response
  }
});
