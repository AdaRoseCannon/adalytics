// server.js
// where your node app starts

// init project
import express from 'express';
import bodyParser from 'body-parser';
import text2png from 'text2png';
import fs from 'fs';
import viperHTML from 'viperhtml';
import {table} from './public/templates.js';
import http from 'http';
import socketio from 'socket.io';

const asyncRender = viperHTML.async();

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// init sqlite db
var dbFile = './.data/sqlite.db';
// try { fs.unlinkSync(dbFile); } catch (e) {}
var exists = fs.existsSync(dbFile);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(dbFile);

// Check if table exists, or create new one for first load.
db.serialize(function(){
  if (!exists) {
    db.run(`CREATE TABLE Analytics (
      url TEXT PRIMARY KEY,
      counter INTEGER DEFAULT 0
    )`);
    db.serialize(function() {
      db.run(`INSERT INTO Analytics VALUES ("global-counter", 0)`);
    });
    console.log('New table Analytics created!');
  }
  else {
    console.log('Database "Analytics" ready to go!');
  }
});

function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

app.get('/counter.png', nocache, function(request, response) {
    const url = request.header('Referer') || request.query.fallback;
    
    const urlToSave = url ? url.split("?")[0] : 'unknown';
  
    // insert default dreams
    db.serialize(function() {
      db.get(`SELECT EXISTS(SELECT 1 FROM Analytics WHERE url="${urlToSave}");`, function (err, row) {
        if (Object.values(row)[0] !== 0) {
          db.serialize(function() {
            db.run(`UPDATE Analytics SET counter = counter + 1 WHERE url="${urlToSave}"`);
          });
        } else {
          db.serialize(function() {
            db.run(`INSERT INTO Analytics VALUES ("${urlToSave}", 1)`);
          });
        }
        db.serialize(function() {
          db.get(`SELECT counter from Analytics WHERE url="${urlToSave}"`, function (err, row) {
            io.sockets.emit('update', {url: urlToSave, counter: row.counter});
          });
        });
      });
    });
  
    db.serialize(function() {
      db.run(`UPDATE Analytics SET counter = counter + 1 WHERE url="global-counter"`);
    });
  
    db.get(`SELECT counter from Analytics WHERE url="global-counter"`, function (err, row) {
      const img = text2png(row.counter + "", {
        font: '18px Open Sans',
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
});

const indexFile = fs.readFileSync('./views/index.html', 'utf8').split('<!-- main -->');
app.get('/', function (request, response) {
  response.set({ 'content-type': 'text/html; charset=utf-8' });
  
  db.all(
    'SELECT * from Analytics WHERE url!="global-counter" ORDER BY counter desc',
    function(err, rows) {
      (asyncRender(chunk => response.write(chunk))`
          ${{html: indexFile[0]}}
          ${table(rows)}
          ${{html: indexFile[1]}}
      `)
      .then(() => response.end());
    }
  );
});

app.get('/data.json', nocache, function (request, response) {
  db.all(
    'SELECT * from Analytics WHERE url!="global-counter" ORDER BY counter desc',
    function(err, rows) {
      response.json(rows);
    }
  );
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