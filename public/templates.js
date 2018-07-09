import {wire} from '/node_modules/viperhtml/index.js';

const tableState = {};

const row = data => wire(tableState, ':' + encodeURIComponent(data.url))`
  <tr>
    <td>${data.url}</td>
    <td>${data.counter}</td>
  </tr>`;

const table = rows => wire(tableState, ':table')`
  <table>
    <thead>
      <tr>
        <td>URL</td>
        <td>Count</td>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => row(r))}
    </tbody>
  </table>
`;

export {
  table
}
  