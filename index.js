const fetch = require('node-fetch');
const fs = require('fs');
const XLSX = require("xlsx");
const express = require('express');

const app = express();

let allResults = {
  wards: {}
};

const fetchElectionData = async (election = '242', race = '', useSaved = false) => {
  if (useSaved) {
    console.log('returning saved data')

    if (race == '') {
      console.log('Returning turnout test')
      const data = fs.readFileSync('./test/turnout.xls', 'utf8');
      return data;
    } else {
      console.log('Returning results test')
      const data = fs.readFileSync('./test/results.xls', 'utf8');
      return data;
    }
  }

  const orig = new Date().valueOf();
  console.log('fetching data for election', election, 'and race', race)
  const res = await fetch(`https://chicagoelections.gov/en/data-export.asp?election=${election}&race=${race}&ward=&precinct=`, {
    "credentials": "include",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/111.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache"
    },
    "referrer": "https://chicagoelections.gov/en/election-results-specifics.asp",
    "method": "GET",
  });

  console.log('data fetched', res.status)
  console.log('took', new Date().valueOf() - orig, 'ms')

  const data = await res.text()
  return data;
}

const parseTurnout = async (data) => {
  const arrayBuffer = Uint8Array.from(data, x => x.charCodeAt(0))
  const turnout = XLSX.read(arrayBuffer);

  turnout.SheetNames.forEach((sheetName) => {
    const sheet = turnout.Sheets[sheetName];
    const resultingSheetName = sheet['A1']['v'].replace('WARD ', '');

    if (!sheet['A1']['v'].includes('WARD')) {
      allResults['total'] = allResults['total'] || {};

      allResults['total']['registered'] = sheet[`A2`]['v'];
      allResults['total']['turnout'] = sheet[`C2`]['v'];

      return;
    }

    const maxLine = Number(sheet['!ref'].split(':')[1].replace(/[A-Z]/g, ''));

    allResults['wards'][resultingSheetName] = allResults['wards'][resultingSheetName] || {
      precints: {}
    };

    allResults['wards'][resultingSheetName]['registered'] = sheet[`B${maxLine}`]['v'];
    allResults['wards'][resultingSheetName]['turnout'] = sheet[`D${maxLine}`]['v'];


    for (let i = 3; i < maxLine; i++) {
      const precinct = sheet[`A${i}`]['v'];
      const registered = sheet[`B${i}`]['v'];
      const turnout = sheet[`D${i}`]['v'];

      allResults['wards'][resultingSheetName]['precints'][precinct] = allResults['wards'][resultingSheetName]['precints'][precinct] || {};

      allResults['wards'][resultingSheetName]['precints'][precinct]['registered'] = registered;
      allResults['wards'][resultingSheetName]['precints'][precinct]['turnout'] = turnout;
    }
  })
};

const parseVotes = async (data) => {
  const arrayBuffer = Uint8Array.from(data, x => x.charCodeAt(0))
  const votes = XLSX.read(arrayBuffer);

  votes.SheetNames.forEach((sheetName) => {
    const sheet = votes.Sheets[sheetName];
    const resultingSheetName = sheet['A1']['v'].replace('Ward ', '');

    if (!sheet['A1']['v'].includes('Ward')) {
      allResults['total'] = allResults['total'] || {};

      allResults['total']['votes'] = sheet[`A2`]['v'];
      allResults['total']['votesJohnson'] = sheet[`B2`]['v'];
      allResults['total']['percentJohnson'] = sheet[`C2`]['v'];
      allResults['total']['votesVallas'] = sheet[`D2`]['v'];
      allResults['total']['percentVallas'] = sheet[`E2`]['v'];

      return;
    }

    const maxLine = Number(sheet['!ref'].split(':')[1].replace(/[A-Z]/g, ''));

    allResults['wards'][resultingSheetName] = allResults['wards'][resultingSheetName] || {
      precints: {}
    };

    allResults['wards'][resultingSheetName]['votes'] = sheet[`B${maxLine}`]['v'];
    allResults['wards'][resultingSheetName]['votesJohnson'] = sheet[`C${maxLine}`]['v'];
    allResults['wards'][resultingSheetName]['percentJohnson'] = sheet[`D${maxLine}`]['v'];
    allResults['wards'][resultingSheetName]['votesVallas'] = sheet[`E${maxLine}`]['v'];
    allResults['wards'][resultingSheetName]['percentVallas'] = sheet[`F${maxLine}`]['v'];

    for (let i = 3; i < maxLine; i++) {
      const precinct = sheet[`A${i}`]['v'];
      const votes = sheet[`B${i}`]['v'];
      const votesJohnson = sheet[`C${i}`]['v'];
      const percentJohnson = sheet[`D${i}`]['v'];
      const votesVallas = sheet[`E${i}`]['v'];
      const percentVallas = sheet[`F${i}`]['v'];

      allResults['wards'][resultingSheetName]['precints'][precinct] = allResults['wards'][resultingSheetName]['precints'][precinct] || {};

      allResults['wards'][resultingSheetName]['precints'][precinct]['votes'] = votes;
      allResults['wards'][resultingSheetName]['precints'][precinct]['votesJohnson'] = votesJohnson;
      allResults['wards'][resultingSheetName]['precints'][precinct]['percentJohnson'] = percentJohnson;
      allResults['wards'][resultingSheetName]['precints'][precinct]['votesVallas'] = votesVallas;
      allResults['wards'][resultingSheetName]['precints'][precinct]['percentVallas'] = percentVallas;
    }
  })
};

const updateData = (async () => {
  fetchElectionData('242', '', false)
    .then((turnoutRaw) => {
      parseTurnout(turnoutRaw)
        .then(() => {
          fs.writeFileSync('./test/output.json', JSON.stringify(allResults, null, 2));
        })
    })

  fetchElectionData('242', '11', false)
    .then((votesRaw) => {
      parseVotes(votesRaw)
        .then(() => {
          fs.writeFileSync('./test/output.json', JSON.stringify(allResults, null, 2));
        })
    })
});

app.get('/results', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(allResults);
});

app.get('/', async (req, res) => {
  res.redirect('/results');
});

updateData().then(() => {
  app.listen(3001, () => {
    setInterval(updateData, 1000 * 60 * 2)

    console.log(`Example app listening at port 3001`)
  })
});