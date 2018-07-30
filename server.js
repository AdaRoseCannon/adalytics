// server.js
// where your node app starts

// init project
import express from 'express';
import bodyParser from 'body-parser';
import text2png from 'text2png';
import fs from 'fs';
import viperHTML, {wire} from 'viperhtml';
import {table} from './public/templates.js';
import http from 'http';
import socketio from 'socket.io';
import sqlite from 'sqlite';

const asyncRender = viperHTML.async();

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// init sqlite db
var dbFile = './.data/sqlite.db';
// try { fs.unlinkSync(dbFile); } catch (e) {}
var exists = fs.existsSync(dbFile);
sqlite.open(dbFile, { Promise })
.then(async function (db) {
  
  
  // await db.run(`DROP TABLE MiscInts`);
  // await db.run(`DROP TABLE DayCountLog`);
  // await db.run(`DROP TABLE MonthCountLog`);
  // await db.run(`DROP TABLE YesterdayLog`);
  
  await Promise.all([
    createMiscIntsTable(),
    createDayCountLogTable(),
    createMonthCountLogTable(),
    createYesterdayCountLogTable(),
  ]).catch(e => {
     console.log('Error Starting', e);
  });
  
  // Check for updating the tables
  await resetLast30Days();
  await resetLastDay();
  
  async function createDayCountLogTable() {
      const hasTable = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='DayCountLog'`);
      if (!hasTable) {
        await db.run(`CREATE TABLE DayCountLog (
          DayNumber INTEGER PRIMARY KEY,
          value INTEGER DEFAULT 0
        )`);
      }
  }
  
  async function createYesterdayCountLogTable() {
      const hasTable = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='YesterdayLog'`);
      if (!hasTable) {
        await db.run(`CREATE TABLE YesterdayLog (
          url TEXT PRIMARY KEY,
          counter INTEGER DEFAULT 0
        )`);
        await db.run(`INSERT INTO YesterdayLog VALUES ("global-counter", 0)`);
      }
  }
  
  async function createMonthCountLogTable() {
      const hasTable = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='MonthCountLog'`);
      if (!hasTable) {
        await db.run(`CREATE TABLE MonthCountLog (
          MonthNumber INTEGER PRIMARY KEY,
          count INTEGER DEFAULT 0
        )`);
      }
  }
  
  async function createMiscIntsTable() {
      const hasTable = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='MiscInts'`);
      if (!hasTable) {
        await db.run(`CREATE TABLE MiscInts (
          IntKey TEXT PRIMARY KEY,
          value INTEGER DEFAULT 0
        )`);
        await db.run(`INSERT INTO MiscInts VALUES ("Last30Month", 0)`);
        await db.run(`INSERT INTO MiscInts VALUES ("LastDayDay", 0)`);
      }
  }

  async function resetLast30Days() {
      const p = new Date();
      const currentMonth = p.getYear() * 12 + p.getMonth();
    
      const {value: monthBeingRecorded} = await db.get(`SELECT value from MiscInts WHERE IntKey="Last30Month"`);
    
      // If it's a new month reset everything
      if (monthBeingRecorded !== currentMonth) {
        
        
        // If the table exists save the old 30 Day Total then drop the table
        const hasTable = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='Last30'`);
        if (hasTable) {
          const {counter: oldTotal} = await db.get(`SELECT counter from Last30 WHERE url="global-counter"`);
          await db.run(`INSERT INTO MonthCountLog VALUES (${monthBeingRecorded}, ${oldTotal})`);
          await db.run(`DROP TABLE Last30`);
        }
        
        // Recreate the table
        await db.run(`CREATE TABLE Last30 (
          url TEXT PRIMARY KEY,
          counter INTEGER DEFAULT 0
        )`);
        await db.run(`INSERT INTO Last30 VALUES ("global-counter", 0)`);
        await db.run(`UPDATE MiscInts SET value = ${currentMonth} WHERE IntKey="Last30Month"`);
      }
  }

  async function resetLastDay() {
      const p = new Date();
      const currentDay = Math.floor(Date.now(0)/8.64e7);
    
      const {value: dayBeingRecorded} = await db.get(`SELECT value from MiscInts WHERE IntKey="LastDayDay"`);
    
      // If it's a new Day reset everything
      if (dayBeingRecorded !== currentDay) {
        
        // If the table exists save the previous day Total then drop the table
        const hasTable = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='LastDay'`);
        if (hasTable) {
          const {counter: oldTotal} = await db.get(`SELECT counter from LastDay WHERE url="global-counter"`);
          await db.run(`INSERT INTO DayCountLog VALUES (${dayBeingRecorded}, ${oldTotal})`);
          
          // Get rid of the day before yesterdays Data
          await db.run(`DROP TABLE YesterdayLog`);
          
          // Rename todays data to yesterday
          await db.run(`ALTER TABLE LastDay RENAME TO YesterdayLog`);
        }
        
        // Recreate the table
        await db.run(`CREATE TABLE LastDay (
          url TEXT PRIMARY KEY,
          counter INTEGER DEFAULT 0
        )`);
        await db.run(`INSERT INTO LastDay VALUES ("global-counter", 0)`);
        await db.run(`UPDATE MiscInts SET value = ${currentDay} WHERE IntKey="LastDayDay"`);
      }
  }

  // Check if table file exists, or create new one for first load.
  if (!exists) {
    await db.run(`CREATE TABLE Analytics (
      url TEXT PRIMARY KEY,
      counter INTEGER DEFAULT 0
    )`);
    await db.run(`INSERT INTO Analytics VALUES ("global-counter", 0)`);
    await createMiscIntsTable();
    await createMonthCountLogTable();
    await createDayCountLogTable();
    await resetLast30Days();
    await resetLastDay();
    console.log('New table Analytics created!');
  }
  else {
    console.log('Database "Analytics" ready to go!');
  }

  function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
  }
  
  async function insertOrUpdate(dbName, urlToSave) {
    await db.run(`UPDATE ${dbName} SET counter = counter + 1 WHERE url="global-counter"`);

    const urlExists = await db.get(`SELECT EXISTS(SELECT 1 FROM ${dbName} WHERE url="${urlToSave}");`);
    if (Object.values(urlExists)[0] !== 0) {
      await db.run(`UPDATE ${dbName} SET counter = counter + 1 WHERE url="${urlToSave}"`);
    } else {
      await db.run(`INSERT INTO ${dbName} VALUES ("${urlToSave}", 1)`);
    }

    const {counter} = await db.get(`SELECT counter from ${dbName} WHERE url="${urlToSave}"`);
    return counter;
  }

  app.get('/counter.png', nocache, async function(request, response) {
      const url = request.header('Referer') || request.query.fallback;
    
      // Check to see if the day/month has changed.
      await resetLast30Days();
      await resetLastDay();

      const urlToSave = url ? url.split("?")[0] : 'unknown';

      const urlCounter = {
        Analytics: await insertOrUpdate('Analytics', urlToSave),
        Last30: await insertOrUpdate('Last30', urlToSave),
        LastDay: await insertOrUpdate('LastDay', urlToSave)
      }

      io.sockets.emit('update', {url: urlToSave, urlCounter });

      const {counter: globalCounter} = await db.get(`SELECT counter from Analytics WHERE url="global-counter"`);
      const img = text2png(globalCounter + "", {
        font: `${request.query.size || 16}px Open Sans`,
        textColor: request.query.color || 'white',
        bgColor: 'transparent',
        lineSpacing: 10,
        padding: 5
      });
      response.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
      });
      response.end(img);
  });

  
  const indexFile = fs.readFileSync('./views/index.html', 'utf8').split('<!-- split -->');
  app.get('/', async function (req, res) {
    res.set({ 'content-type': 'text/html; charset=utf-8' });
    
    const dbName = req.query.db || 'Analytics';
    
    if (
      !(dbName === 'Analytics' || 
      dbName === 'Last30' || 
      dbName === 'YesterdayLog' || 
      dbName === 'LastDay')
    ) {
      return res.end('Not a valid DB');
    }

    const rows = await db.all(`SELECT * from ${dbName} ORDER BY counter desc`);
    (asyncRender(chunk => res.write(chunk))`
        ${{html: indexFile[0]}}
        <svg style="dsiplay:block; width: 100%; height: 100px;">${wire({}, 'svg')`
          ${db.all('SELECT * from DayCountLog ORDER BY DayNumber desc LIMIT 30')
           .then(rows => {
              const max = Math.max(rows.reduce((a,b) => Math.max(a,b.value),0),1);
              const elements = rows.map((row, i) => wire(row, 'svg')`<g class="bar">
                <rect width="3.33%" x="${(100 - 3.33 * i) + '%'}" y="${(80 * (1 - (row.value/max)))+'%'}" height="${(80 * (row.value/max)) + '%'}"></rect>
                <text x="${(100 - 3.33 * i) + '%'}" y="${(80 * (1 - (row.value/max)))+'%'}" dy="1em" dx="1.666%" text-anchor="middle">${row.value}</text>
              </g>`);
              elements.unshift(wire({}, 'svg')`
                <title id="title">A bar chart of users per day.</title>
                <desc id="desc">Most users in the last 30 days was ${max}.</desc>
                <text x="100%" y="80%" dy="1em" text-anchor="end">Yesterday</text>
                <text x="0%" y="80%" dy="1em" text-anchor="start">30 Days Ago</text>
                <style>
                  rect {
                    fill: #b3b3e6;
                    stroke: #b3b3e6;
                  }
                  text {
                    font-size:10px;
                  }
                </style>
              `)
              return elements;
            })
           }
        `}</svg>
        ${{html: indexFile[1]}}
        ${table(dbName, rows)}
        ${{html: indexFile[2]}}
    `)
    .then(() => res.end());
  });

  app.get('/day-histogram.json', nocache, async function (request, response) {
    const rows = await db.all('SELECT * from DayCountLog ORDER BY DayNumber desc LIMIT 30');
    response.json(rows);
  });

  app.get('/data.json', nocache, async function (request, response) {
    const rows = await db.all('SELECT * from Analytics ORDER BY counter desc');
    response.json(rows);
  });

  app.get('/yesterday.json', nocache, async function (request, response) {
    const rows = await db.all('SELECT * from YesterdayLog ORDER BY counter desc');
    response.json(rows);
  });

  app.get('/since-yesterday.json', nocache, async function (request, response) {
    const rows = await db.all('SELECT * from LastDay ORDER BY counter desc');
    response.json(rows);
  });

  app.get('/since-last-month.json', nocache, async function (request, response) {
    const rows = await db.all('SELECT * from Last30 ORDER BY counter desc');
    response.json(rows);
  });

  app.use('/node_modules/viperhtml', express.static('./node_modules/hyperhtml/esm/'));
  app.use(express.static('public'));

  const server = http.createServer(app);
  server.listen(process.env.PORT, function () {
    console.log('Your app is listening on port ' + process.env.PORT);
  });

  const io = socketio(server);
  io.on('connection', function(client){
    client.on('event', function(data){});
    client.on('disconnect', function(){});
  });
});
