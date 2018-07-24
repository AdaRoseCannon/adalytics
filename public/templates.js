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
    }}>⬤</span> <a href="${data.url}" target="_blank" rel="nofollow">${data.url}</a></td>
    <td>${data.counter}</td>
  </tr>`;

const table = (rows, lastupdated) => wire(tableState, ':table')`
  <table>
    <thead>
      <tr>
        <td>URL</td>
        <td>Count</td>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => row(r, lastupdated))}
    </tbody>
  </table>
`;

export {
  table
}
  