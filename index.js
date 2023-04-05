const fetch = require('node-fetch');
const fs = require('fs');
const XLSX = require("xlsx");
const express = require('express');

const app = express();

const sampleData = JSON.parse(fs.readFileSync('./test/output.json', 'utf8'));

let allResults = {};

let last = new Date('2021-01-01').valueOf();

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

  console.log('fetching data for election', election, 'and race', race)
  const res = await fetch("https://www.politico.com/election-data/2023-04-04-live__2023-04-04__17__mayor__chicago__runoff/data.json", {
    "headers": {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/111.0",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.5",
      "If-Modified-Since": new Date(last).toUTCString(),
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache"
    },
    "referrer": "https://www.politico.com/2023-election/results/chicago-mayor/",
    "method": "GET",
  });
  const data = await res.json()
  last = new Date().valueOf();

  if (res.status !== 200) {
    return allResults;
  }

  return data;
}

const updateData = (async () => {
  if (new Date().valueOf() < (1680652800000 - (1000 * 60 * 5))) return;

  fetchElectionData('242', '', false)
    .then((data) => {
      allResults = data
    })
});

app.get('/results', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(allResults);
});

app.get('/islive', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (new Date().valueOf() < 1680652800000) {
    res.send('notlive')
  } else {
    res.send('live')
  }
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