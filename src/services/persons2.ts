import { scrapeWebpage, scrapeWebpageWaitingForUserList } from '@/lib/scraper';
import { createEventSlug, maybeCastedAsNumber, slugify } from '@/utils';
import { CheerioAPI } from 'cheerio';
import { getCacheData, setCacheData } from '@/lib/redis';
import { NotFoundError } from '@/errors/not-found';

export class PersonService {
  public async getPerson(idOrName: string) {
    if (!idOrName) {
      throw new Error('No ID or name provided');
    }

    const cacheHit = await getCacheData(`person-${idOrName}`);
    if (cacheHit) return cacheHit;


    const s = await scrapeWebpageWaitingForUserList(process.env.WCA_HOST + `/persons?page=1&search=${idOrName}`);
    const isAmbiguous = this.checkIsAmbiguous(s);

    if (isAmbiguous == 1) {
      const nameIdList = this.getUserNameAndIdList(s);
      // cache the list
      await setCacheData(`person-${idOrName}`, nameIdList);
      return nameIdList;
    }
    else if (isAmbiguous == 0) {
      const id = this.getUserId(s);
      // cache the id
      const userData = await this.getPersonById(id);
      await setCacheData(`person-${idOrName}`, userData);
      return userData;
    }
    else {
      throw new NotFoundError('User not found')
    }

  }

  private checkIsAmbiguous($: CheerioAPI) {
    const table = $('.fixed-table-body table tbody').children().toArray();

    // 1 for ambiguous, 0 for not ambiguous, -1 for not found
    if (table.length > 1) return 1
    else if (table.length == 1) return 0
    else return -1
  }

  // if isAmbiguous == 1, then get the list of names and ids
  private getUserNameAndIdList($: CheerioAPI): {name: string, id: string}[] {
    const table = $('.fixed-table-body table tbody').children().toArray();
    const nameIdList = table.map((row) => {
      const name = $(row).find('td').eq(0).text().trim();
      const id = $(row).find('td').eq(1).text().trim();
      return {name, id};
    })
    return nameIdList;
  }

  // if isAmbiguous == 0, then get the id
  private getUserId($: CheerioAPI): string {
    const table = $('.fixed-table-body table tbody').children().toArray()
    const id = $(table[0]).find('td').eq(1).text().trim();
    return id;
  }



  // old code
  private async getPersonById(id: string) {
    
    if (!id) {
      throw new Error('No ID provided');
    }

    const cacheHit = await getCacheData(`person-${id}`);

    if (cacheHit) {
      return cacheHit;
    }

    const $ = await scrapeWebpage(process.env.WCA_HOST + `/persons/${id}`);
    const name = this.getUserName($);
    const userDetails = this.getUserDetails($);
    const personalRecords = this.getPersonalRecords($);

    const data = {
      id,
      name,
      ...userDetails,
      personalRecords,
    };

    await setCacheData(`person-${id}`, data);

    return data;
  }

  private getUserName($: CheerioAPI) {
    return $('.text-center h2').text().trim();
  }

  private getUserDetails($: CheerioAPI) {
    const [element] = $('.details table tbody tr').toArray();

    if (!element) {
      throw new NotFoundError('User details not found');
    }

    const output = {} as any;
    const keys = ['country', 'id', 'sex', 'competitions', 'successfullAttempts'];

    for (const [index, row] of $(element).find('td').toArray().entries()) {
      const value = $(row).text().trim();

      output[keys[index]] = maybeCastedAsNumber(value);
    }

    return output;
  }

  private getPersonalRecords($: CheerioAPI) {
    const table = $('.personal-records table tbody').children().toArray();
    const personalRecords = {} as any;

    for (const row of table) {
      const tds = $(row).find('td');

      if (tds.length === 0) {
        continue;
      }

      const event = tds.eq(0).text().trim();
      const eventSlug = createEventSlug(event);

      personalRecords[eventSlug] = {
        event,
        single: {
          time: tds.eq(4).text().trim(),
          nationalRecord: tds.eq(1).text().trim(),
          continentalRecord: tds.eq(2).text().trim(),
          worldRecord: tds.eq(3).text().trim(),
        },
        average: {
          time: tds.eq(5).text().trim(),
          nationalRecord: tds.eq(8).text().trim(),
          continentalRecord: tds.eq(7).text().trim(),
          worldRecord: tds.eq(6).text().trim(),
        },
      };
    }

    return personalRecords;
  }

}
