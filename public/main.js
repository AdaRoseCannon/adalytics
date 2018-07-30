/* global io */

import {bind} from '/node_modules/viperhtml/index.js';
import {table} from './templates.js';

const render = bind(document.querySelector('main'));

document.querySelector('main').insertAdjacentHTML('beforebegin', '<label for="regex">Filter Results</label><input type="text" id="regex" placeholder="^https://ada.is" />');

// This allows us to animate the numbers increasing when the user looks at it.
const queue = [];
(function loop() {
  const n = Math.max(queue.length, 1);
  setTimeout(() => {
    const n = queue.shift();
    if (n) n();
    requestAnimationFrame(loop);
  }, 20 + 400*Math.sqrt(1/n));
}());

let reg = new RegExp('');
(async function () {
  
  const socket = io(location.origin);
  let dbName;
  let data;
  let lastupdated = '';

  function makeTable() {
    try {
      reg = new RegExp(window.regex.value, 'i');
    } catch (e) {}
    render`
    ${table(dbName, 
      data
      .filter(a => a.url.match(reg))
      .sort((a,b) => b.counter - a.counter)
    , lastupdated, {refreshAllData})}`;
  }
  
  async function refreshAllData(dbNameIn) {
    switch(dbNameIn) {
      case 'Analytics':
        data = await fetch('./data.json').then(r => r.json());
        break;
      case 'Last30':
        data = await fetch('./since-last-month.json').then(r => r.json());
        break;
      case 'LastDay':
        data = await fetch('./since-yesterday.json').then(r => r.json());
        break;
      case 'YesterdayLog':
        data = await fetch('./yesterday.json').then(r => r.json());
        break;
      default:
        throw Error('Invalid DB ' + dbNameIn);
    }
    dbName = dbNameIn;
    makeTable();
  }

  await refreshAllData(new URLSearchParams(location.search).get('db') || 'Analytics');
  
  socket.on('connect', function(){
    console.log('connected');
  });
  
  socket.on('update', function(newRowData){
    if (dbName === 'YesterdayLog') return;
    lastupdated = newRowData.url;
    const result = data.find(row => row.url === newRowData.url);
    queue.push(function () {
      if (result) {
        result.counter = newRowData.urlCounter[dbName];
      } else {
        data.push({
          url: newRowData.url,
          counter: newRowData.urlCounter[dbName]
        });
      }
      makeTable();
    });
  });
  socket.on('disconnect', function(){});
  
  window.regex.addEventListener('input', function () {
    makeTable();
  });
  
  function changeDBFromURL(urlIn) {
    const url = new URL(urlIn);
    if (url.pathname === '/') {
      const query = new URLSearchParams(url.search);
      let db = query.get('db') || 'Analytics';
      refreshAllData(db);
      return db;
    }
  }
  
  window.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      if (e.target.href === location.href) {
          return e.preventDefault();
      }
      const newDB = changeDBFromURL(e.target.href);
      if (newDB) {
        e.preventDefault();
        history.pushState({}, newDB, e.target.href);
      }
    }
  });
  
  window.addEventListener('popstate', function () {
    changeDBFromURL(document.location.toString());
  });
  
}());