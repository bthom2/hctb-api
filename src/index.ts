const app = express();
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import { Req_Query, Resp_JSON } from '../@types/src';
import distance from 'gps-distance';
import express from 'express';

app.post('/login', async function (req, res) {
    if (!req.query.user || !req.query.pass || !req.query.code)
      return res.json({
        success: false,
        error: 'Please provide all credentals',
      });
    const browser = await puppeteer.launch({ headless: 'new' });
    console.log('[Info] Browser instance started');
  
    const page = await browser.newPage();
    console.log('[Info] Opened a new page');
    const q = req.query as Req_Query;
    await page.goto('https://login.herecomesthebus.com/Authenticate.aspx');
    await page.type(
      `input[name="ctl00$ctl00$cphWrapper$cphContent$tbxUserName"]`,
      q.user,
    );
    await page.type(
      `input[name="ctl00$ctl00$cphWrapper$cphContent$tbxPassword"]`,
      q.pass,
    );
    await page.type(
      `input[name="ctl00$ctl00$cphWrapper$cphContent$tbxAccountNumber"]`,
      q.code,
    );
    await Promise.all([
      page.click(
        'input[name="ctl00$ctl00$cphWrapper$cphContent$btnAuthenticate"]',
      ),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);
    console.log('[Info] Logging in to Here Comes The Bus');
  
    const cookies = await page.cookies();
    var i = 0;
    var cookie = '';
    console.log('[Info] Parsing cookie');
  
    while (i < cookies.length) {
      cookie += `${cookies[i].name}=${cookies[i].value}; `;
      i++;
    }
    if (!cookie.includes('.ASPXFORMSAUTH'))
      return res.json({ success: false, error: 'Incorrect Credentals' });
    const person = await page.$eval(
      '#ctl00_ctl00_cphWrapper_cphControlPanel_ddlSelectPassenger',
      // @ts-ignore
      node => node.value,
    );
    const stuName = await page.$eval('#spPassenger', el => el.textContent);
    const timeID = await page.$eval(
      '#ctl00_ctl00_cphWrapper_cphControlPanel_ddlSelectTimeOfDay',
      // @ts-ignore
      node => node.value,
    );
    const value = { name: stuName, person: person, time: timeID };
  
    fetch('https://login.herecomesthebus.com/Map.aspx/RefreshMap', {
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'en-US,en;q=0.9,ja;q=0.8',
        'content-type': 'application/json; charset=UTF-8',
        'sec-ch-ua':
          '"Chromium";v="104", " Not A;Brand";v="99", "Google Chrome";v="104"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-requested-with': 'XMLHttpRequest',
        cookie: cookie,
        Referer: 'https://login.herecomesthebus.com/Map.aspx',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      body: JSON.stringify({
        legacyID: value.person,
        name: value.name,
        timeSpanId: value.time,
        wait: 'false',
      }),
      method: 'POST',
    })
      .then(resp => resp.json())
      .then(json => {
        var lat, lon, isInRange, geoFenceMi, status, busStop, scheduled;
        console.log(json);
        const jResp = json as Resp_JSON;
        if (jResp.d.includes('SetBusPushPin')) {
          status = /Actual: (.+)','/i.exec(jResp.d)![1];
          busStop = /Bus Stop: (.+)\[/i.exec(jResp.d)![1];
          scheduled = /Scheduled: (\d\d:\d\d ..)/i.exec(jResp.d)![1];
          lat = /SetBusPushPin\((\d+\.\d+)/i.exec(jResp.d)![1];
          lon = /SetBusPushPin\(\d+\.\d+,(.\d+\.\d+)/i.exec(jResp.d)![1];
          const geoFenceKM = distance(
            43.41557963621447,
            -88.15326684577983,
            lat,
            lon,
          );
          const factor = 0.621371;
          geoFenceMi = geoFenceKM * factor;
          const geoRadius = 0.5;
          isInRange = false;
          if (geoFenceMi <= geoRadius) {
            isInRange = true;
          }
        }
        res.json({
          success: true,
          ...value,
          lat: lat,
          lon: lon,
          range: isInRange,
          distance: geoFenceMi,
          status: status,
          busStop: busStop,
          scheduled: scheduled,
        });
      });
  
    await browser.close();
    console.log('[Info] Browser instance closed');
  });
  
  const listener = app.listen(process.env.PORT || 8080, () => {
  });

  