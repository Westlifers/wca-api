import { scrapeWebpage, searchUser } from '@/lib/scraper';
import { createEventSlug, maybeCastedAsNumber, slugify } from '@/utils';
import { CheerioAPI } from 'cheerio';
import { getCacheData, setCacheData } from '@/lib/redis';
import { NotFoundError } from '@/errors/not-found';

export class PersonService {
  public async getPerson(keyWord: string) {
    if (!keyWord) {
      throw new Error('No ID or name provided');
    }

    const cacheHit = await getCacheData(`person-${keyWord}`);
    if (cacheHit) return cacheHit;


    const searchResultList = await searchUser(process.env.WCA_HOST + `/persons?search=${keyWord}&order=asc&offset=0&limit=10&region=all`);
    const resultCount = searchResultList['total'];
    const isAmbiguous = resultCount > 1 ? 1 : (resultCount == 1 ? 0 : -1);  // 1 for ambiguous, 0 for not unique, -1 for not found

    if (isAmbiguous == 1) {
      const nameIdList = searchResultList['rows'];
      // cache the list by keyWord
      await setCacheData(`person-${keyWord}`, nameIdList);
      return nameIdList;
    }
    else if (isAmbiguous == 0) {
      const id = searchResultList['rows'][0]['wca_id'];
      console.log(searchResultList);
      // cache the result by id and keyWord
      const userData = await this.getPersonById(id);
      await setCacheData(`person-${keyWord}`, userData);
      await setCacheData(`person-${id}`, userData);
      return userData;
    }
    else {
      throw new NotFoundError('User not found')
    }

  }


  // old code for searching by id
  private async getPersonById(id: string) {
    
    // if (!id) {
    //   throw new Error('No ID provided');
    // }

    // const cacheHit = await getCacheData(`person-${id}`);

    // if (cacheHit) {
    //   return cacheHit;
    // }

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

    // await setCacheData(`person-${id}`, data);

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
