import * as cheerio from 'cheerio';

export const scrapeWebpage = async (url: string) => {
  const response = await fetch(url);
  const html = await response.text();
  return cheerio.load(html);
};


interface searchResult {
  'total': number,
  'rows': {
    'name': string,
    'wca_id': string
  }[]
}
export const searchUser = async (url: string): Promise<searchResult> => {
  const headers = {
    'Accept': 'application/json, text/javascript, */*; q=0.1',
    'X-Requested-With': 'XMLHttpRequest'
  }
  // curl.exe --request GET --url 'https://www.worldcubeassociation.org/persons?search=&order=asc&offset=0&limit=10&region=all' 
  //   --header 'Accept: application/json, text/javascript, */*; q=0.1' 
  //   --header 'X-Requested-With: XMLHttpRequest'
  const response = await fetch(url, {headers});
  const rawResult = await response.json();
  const nameIdList = {
    'total': rawResult['total'],
    'rows': rawResult['rows'].map((row: any) => {
      return {
        // 'name' starts with pattern '\u003ca href=\"/persons/.*\"\u003e' and ends with '\u003c/a\u003e', so we need to remove them
        'name': row['name'].replace(/\u003ca href=\"\/persons\/.*\"\u003e/g, '').replace(/\u003c\/a\u003e/g, ''),
        'wca_id': row['wca_id']
      }
    })
  }
  return nameIdList;
}