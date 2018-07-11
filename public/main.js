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
  const data = await fetch('./data.json').then(r => r.json());
  const socket = io(location.origin);
  
  let lastupdated = '';

  function makeTable() {
    try {
      reg = new RegExp(window.regex.value, 'i');
    } catch (e) {}
    render`
    ${table(
      data
      .filter(a => a.url.match(reg))
      .sort((a,b) => b.counter - a.counter)
    , lastupdated)}`;
  }

  socket.on('connect', function(){
    console.log('connected');
  });
  
  socket.on('update', function(newRowData){
    lastupdated = newRowData.url;
    const result = data.find(row => row.url === newRowData.url);
    queue.push(function () {
      if (result) {
        result.counter = newRowData.counter;
      } else {
        data.push(newRowData);
      }
      makeTable();
    });
  });
  socket.on('disconnect', function(){});
  
  window.regex.addEventListener('input', function () {
    makeTable();
  });
  
  makeTable();
}());