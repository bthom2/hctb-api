var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const app = express();
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import distance from 'gps-distance';
import express from 'express';
app.post('/login', function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.query.user || !req.query.pass || !req.query.code)
            return res.json({
                success: false,
                error: 'Please provide all credentals',
            });
        const browser = yield puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        console.log('[Info] Browser instance started');
        const page = yield browser.newPage();
        console.log('[Info] Opened a new page');
        const q = req.query;
        yield page.goto('https://login.herecomesthebus.com/Authenticate.aspx');
        yield page.type(`input[name="ctl00$ctl00$cphWrapper$cphContent$tbxUserName"]`, q.user);
        yield page.type(`input[name="ctl00$ctl00$cphWrapper$cphContent$tbxPassword"]`, q.pass);
        yield page.type(`input[name="ctl00$ctl00$cphWrapper$cphContent$tbxAccountNumber"]`, q.code);
        yield Promise.all([
            page.click('input[name="ctl00$ctl00$cphWrapper$cphContent$btnAuthenticate"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
        ]);
        console.log('[Info] Logging in to Here Comes The Bus');
        const cookies = yield page.cookies();
        var i = 0;
        var cookie = '';
        console.log('[Info] Parsing cookie');
        while (i < cookies.length) {
            cookie += `${cookies[i].name}=${cookies[i].value}; `;
            i++;
        }
        if (!cookie.includes('.ASPXFORMSAUTH'))
            return res.json({ success: false, error: 'Incorrect Credentals' });
        const person = yield page.$eval('#ctl00_ctl00_cphWrapper_cphControlPanel_ddlSelectPassenger', 
        // @ts-ignore
        node => node.value);
        const stuName = yield page.$eval('#spPassenger', el => el.textContent);
        const timeID = yield page.$eval('#ctl00_ctl00_cphWrapper_cphControlPanel_ddlSelectTimeOfDay', 
        // @ts-ignore
        node => node.value);
        const value = { name: stuName, person: person, time: timeID };
        fetch('https://login.herecomesthebus.com/Map.aspx/RefreshMap', {
            headers: {
                accept: 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'en-US,en;q=0.9,ja;q=0.8',
                'content-type': 'application/json; charset=UTF-8',
                'sec-ch-ua': '"Chromium";v="104", " Not A;Brand";v="99", "Google Chrome";v="104"',
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
            isInRange = false;
            const jResp = json;
            if (jResp.d.includes('SetBusPushPin')) {
                status = /Actual: (.+)','/i.exec(jResp.d)[1];
                busStop = /Bus Stop: (.+)\[/i.exec(jResp.d)[1];
                scheduled = /Scheduled: (\d\d:\d\d ..)/i.exec(jResp.d)[1];
                lat = /SetBusPushPin\((\d+\.\d+)/i.exec(jResp.d)[1];
                lon = /SetBusPushPin\(\d+\.\d+,(.\d+\.\d+)/i.exec(jResp.d)[1];
                const geoFenceKM = distance(43.41557963621447, -88.15326684577983, lat, lon);
                const factor = 0.621371;
                geoFenceMi = geoFenceKM * factor;
                const geoRadius = 0.25;
                if (geoFenceMi <= geoRadius) {
                    isInRange = true;
                }
                res.json(Object.assign(Object.assign({ success: true }, value), { lat: lat, lon: lon, range: isInRange, distance: geoFenceMi, status: status, busStop: busStop, scheduled: scheduled }));
            }
            else {
                res.json(Object.assign(Object.assign({ success: true }, value), { lat: 0, lon: 0, range: isInRange, distance: 0, status: 'Not in Service', busStop: 'Not in Service', scheduled: 'Not in Service' }));
            }
        });
        yield browser.close();
        console.log('[Info] Browser instance closed');
    });
});
const listener = app.listen(process.env.PORT || 8086, () => {
});
