import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

export const scrapeWebpage = async (url: string) => {
  const response = await fetch(url);
  const html = await response.text();
  return cheerio.load(html);
};

export const scrapeWebpageWaitingForUserList = async (url: string) => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate the page to a URL
  await page.goto(url);

  // Wait for the required DOM to be rendered
  await page.waitForSelector('td.name');

  // return the html
  const html = await page.content();
  await browser.close();
  return cheerio.load(html);
}