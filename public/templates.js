import {wire} from '/node_modules/viperhtml/index.js';

const tableState = {};

const knownHosts = [];

function urlToHSL(str) {
  try {
    str = new URL(str).hostname; 
  } catch (e) {}
  
  let index = knownHosts.indexOf(str);
  if (index === -1) index = knownHosts.push(str);
  
  return `hsl(${137.50 * index}deg, 100%, 30%)`;
}

const row = (data, lastupdated) => wire(tableState, ':' + encodeURIComponent(data.url))`
  <tr class="${
    data.url === lastupdated ? 'highlighted' : ''
  }" style=${{
    color: urlToHSL(data.url)
  }}>
    <td><a href="${data.url}" target="_blank" rel="nofollow">${data.url}</a></td>
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
  