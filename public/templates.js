import {wire} from '/node_modules/viperhtml/index.js';

const tableState = {};

const knownHosts = [];

function urlToHSL(str,s,l) {
  try {
    str = new URL(str).hostname; 
  } catch (e) {}
  
  let index = knownHosts.indexOf(str);
  if (index === -1) index = knownHosts.push(str) - 1;
  
  return `hsl(${120 + 137.50 * index}deg, ${s}, ${l})`;
}

const row = (data, lastupdated) => wire(tableState, ':' + encodeURIComponent(data.url))`
  <tr class="${
    data.url === lastupdated ? 'highlighted' : ''
  }" style=${{
    color: 'black'
  }}>
    <td><span style=${{
      color: urlToHSL(data.url, '70%', '70%')
    }}>⬤</span> <a href="${data.url.match(/^https?:/) ? data.url : ''}" target="_blank" rel="nofollow">${data.url}</a></td>
    <td>${data.counter}</td>
  </tr>`;

const table = (dbName, rows, lastupdated) => wire(tableState, ':table')`
  <table>
    <thead>
      <tr>
        <td span="2">
          <a class="button" href="/" disabled="${dbName === 'Analytics'}">All Time</a>
          <a class="button" href="/?db=Last30" disabled="${dbName === 'Last30'}">This Month</a>
          <a class="button" href="/?db=YesterdayLog" disabled="${dbName === 'Yesterday'}">Yesterday</a>
          <a class="button" href="/?db=LastDay" disabled="${dbName === 'LastDay'}">Today</a>
        </td>
      </tr>
      <tr>
        <td>URL</td>
        <td>Count</td>
      </tr>
    </thead>
    <tbody>
      ${rows.filter(r => r.url !== 'global-counter').map(r => row(r, lastupdated))}
    </tbody>
  <tfoot>
  </tfoot>
    <td></td>
    <td style="border-top: 2px solid black;">
       ${rows.filter(r => r.url !== 'global-counter').reduce((a,b) => a + b.counter, 0)}
    </td>
  </table>
`;

export {
  table
}
  