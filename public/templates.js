import {wire} from '/node_modules/viperhtml/index.js';

const tableState = {};

const row = (data, lastupdated) => wire(tableState, ':' + encodeURIComponent(data.url))`
  <tr class="${data.url === lastupdated ? 'highlighted' : ''}">
    <td>${data.url}</td>
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
  