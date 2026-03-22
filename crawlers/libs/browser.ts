/**
 * Playwright 瀏覽器共用模組
 */

import { chromium, firefox, Browser, Page } from "playwright";

let browser: Browser | null = null;
let firefoxBrowser: Browser | null = null;

/**
 * 取得共用的 Chromium 瀏覽器實例
 */
export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

/**
 * 取得共用的 Firefox 瀏覽器實例 (用於處理 SSL 問題)
 */
export async function getFirefoxBrowser(): Promise<Browser> {
  if (!firefoxBrowser) {
    firefoxBrowser = await firefox.launch({
      headless: true,
    });
  }
  return firefoxBrowser;
}

/**
 * 關閉瀏覽器
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
  if (firefoxBrowser) {
    await firefoxBrowser.close();
    firefoxBrowser = null;
  }
}

/**
 * 建立新頁面 (Chromium)
 */
export async function newPage(): Promise<Page> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "zh-TW",
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
  });
  return context.newPage();
}

/**
 * 建立新頁面 (Firefox) - 用於處理 SSL 連線問題
 */
export async function newFirefoxPage(): Promise<Page> {
  const b = await getFirefoxBrowser();
  const context = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",
    locale: "zh-TW",
    ignoreHTTPSErrors: true,
  });
  return context.newPage();
}

/**
 * 抓取頁面內容 (等待 JavaScript 渲染)
 */
export async function fetchPageWithBrowser(
  url: string,
  options: {
    waitFor?: string; // CSS selector to wait for
    timeout?: number;
  } = {}
): Promise<{ ok: boolean; html: string; error?: string }> {
  const { waitFor, timeout = 30000 } = options;

  let page: Page | null = null;

  try {
    page = await newPage();
    page.setDefaultTimeout(timeout);

    // 使用 domcontentloaded 而不是 networkidle，避免等待太久
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });

    // 額外等待確保 JavaScript 執行
    await page.waitForTimeout(5000);

    // 如果有指定等待的元素
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 5000 }).catch(() => {});
    }

    const html = await page.content();

    return { ok: true, html };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, html: "", error: message };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * 從頁面提取文字內容
 */
async function extractTextFromPage(page: Page): Promise<{ title: string; text: string }> {
  const title = await page.title();

  const text = await page.evaluate(() => {
    // 移除不需要的元素
    const removeSelectors = ["script", "style", "noscript", "iframe", "svg"];
    removeSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    });

    // 嘗試找主要內容區
    const mainSelectors = [
      "main",
      "article",
      ".main-content",
      "#content",
      ".content-area",
      ".content",
    ];
    for (const sel of mainSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el as HTMLElement).innerText?.trim() || "";
        if (text.length > 200) {
          return text;
        }
      }
    }

    return document.body?.innerText?.trim() || "";
  });

  return { title, text };
}

/**
 * 抓取頁面純文字內容 (移除 script/style 等)
 * 優先使用 Chromium，若連線失敗則改用 Firefox
 */
export async function fetchPageTextWithBrowser(
  url: string,
  options: {
    timeout?: number;
  } = {}
): Promise<{ ok: boolean; text: string; title: string; error?: string }> {
  const { timeout = 30000 } = options;

  // 先嘗試 Chromium
  {
    let page: Page | null = null;
    try {
      page = await newPage();
      page.setDefaultTimeout(timeout);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      await page.waitForTimeout(3000);
      const { title, text } = await extractTextFromPage(page);
      return { ok: true, text, title };
    } catch {
      // Chromium 失敗，嘗試 Firefox
    } finally {
      if (page) await page.close();
    }
  }

  // 用 Firefox 再試一次
  {
    let page: Page | null = null;
    try {
      page = await newFirefoxPage();
      page.setDefaultTimeout(timeout);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      await page.waitForTimeout(3000);
      const { title, text } = await extractTextFromPage(page);
      return { ok: true, text, title };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, text: "", title: "", error: message };
    } finally {
      if (page) await page.close();
    }
  }
}
