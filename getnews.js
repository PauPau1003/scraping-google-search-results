import puppeteerExtra from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';

async function getAllNews(query) {
  try {
    puppeteerExtra.use(stealthPlugin());

    const browser = await puppeteerExtra.launch({
      headless: false,
      // devtools: true,
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    });

    const page = await browser.newPage();

    async function autoScroll(page) {
      await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
          var totalHeight = 0;
          var distance = 1000;
          var scrollDelay = 5000;

          var timer = setInterval(async () => {
            var wrapper = document.querySelector("html");
            var scrollHeightBefore = wrapper.scrollHeight;
            wrapper.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeightBefore) {
              totalHeight = 0;
              await new Promise((resolve) => setTimeout(resolve, scrollDelay));

              // Calculate scrollHeight after waiting
              var scrollHeightAfter = wrapper.scrollHeight;

              if (scrollHeightAfter > scrollHeightBefore) {
                // More content loaded, keep scrolling
                return;
              } else {
                // No more content loaded, stop scrolling
                clearInterval(timer);
                resolve();
              }
            }
          }, 100);
        });
      });
    }

    async function navigateToNextPage(page, csvWriter) {
      // Check if a "Next" button exists
      const nextButton = await page.$("a#pnnext");
      if (nextButton) {
        // Click on the "Next" button
        await nextButton.click();
        // Wait for navigation to complete
        await page.waitForNavigation({ waitUntil: "networkidle0" });
        // Scroll down on the next page
        await autoScroll(page);
        // Scraping logic for the next page
        await scrapeNews(page, csvWriter);
        // Recursively call this function to navigate to the next page if needed
        await navigateToNextPage(page, csvWriter);
      }
    }

    async function scrapeNews(page, csvWriter) {
      const html = await page.content(); // Get the HTML content of the page
      // Parse the HTML content using Cheerio
      const $ = cheerio.load(html);
      // Extract news titles and links
      const elements1 = $("a.WlydOe");
      const elements2 = $("div.n0jPhd.ynAwRc.MBeuO.nDgy9d");
      const elements3 = $("div.GI74Re.nDgy9d");
      for (let i = 0; i < elements1.length; i++) {
        const element1 = elements1[i];
        const link = element1.attribs.href;
        const element2 = elements2[i];
        const textNode1 = element2.children[0];
        const title = textNode1.data;
        const element3 = elements3[i];
        const textNode2 = element3.children[0];
        const description = textNode2.data;
        const news = { link, title, description };
        // Write news to CSV file
        await csvWriter.writeRecords([news]);
      }
    }

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: 'news.csv',
      header: [
        { id: 'link', title: 'Link' },
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' }
      ]
    });

    await page.goto(
      `https://www.google.com/search?q=${query.split(" ").join("+")}&tbm=nws`
    ); // Append &tbm=nws to the URL to search news

    // Scroll down on the first page
    await autoScroll(page);

    // Scraping logic for the first page
    await scrapeNews(page, csvWriter);

    // Call the function to navigate to subsequent pages if needed
    await navigateToNextPage(page, csvWriter);

    await browser.close(); // Close the browser

    return;
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
}

(async () => {
  const query = "top events happening in Singapore soon";
  await getAllNews(query);
})();
