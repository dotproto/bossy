// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { h, Component, render } from 'preact'
import { useState } from "preact/hooks";
import htm from 'htm'

const html = htm.bind(h);

let ext;
if (typeof browser !== "undefined") {
  ext = browser;
} else if (typeof edge !== "undefined") {
  ext = edge;
} else {
  ext = chrome;
}

// ============================================================================

const focusTabAndWindow = (tab) => {
  ext.tabs.update(tab.id, { active: true });
  ext.windows.update(tab.windowId, { focused: true });
}

const closeTab = tab => {
  if (tab && tab.id) {
    ext.tabs.remove(tab.id);
  } else {
    console.log('could not remove tab', tab)
  }
}

const discardTab = tab => {
  if (tab && tab.id) {
    ext.tabs.discard(tab.id, (discarded) => {
      if (!discarded) {
        console.warn('could not discard tab - unknown reason', tab);
      }
    });
  } else {
    console.log('could not discard tab - does not exist', tab)
  }
};

const discardWindow = (window) => {
  console.log(`Discarding ${window.tabs.length} tabs in window ${window.id}`);
  for (let tab of window.tabs) {
    if (tab && tab.id) {
      ext.tabs.discard(tab.id);
    }
  }
};

const CloseButton = ({ tab }) => html`<button type="button" onClick=${() => closeTab(tab)}>❌</button>`
const DiscardButton = ({ tab }) => html`<button type="button" onClick=${() => discardTab(tab)}>🧊</button>`
const DiscardWindowButton = ({ window }) => html`<button type="button" onClick=${() => discardWindow(window)}>🧊</button>`;

const TableRow = ({ header = false, tab}) => {
  const wrapper = header ? 'th' : 'td';
  return html`
    <tr className=${tab && tab.discarded ? 'discarded' : ''}>
      <${wrapper}>
        ${header ? 'ID' : tab.id}
      </>
      <${wrapper} onClick=${() => focusTabAndWindow(tab)}>
        ${header ? 'Title' : tab.title}
      </>
      <${wrapper} class="actions">
        ${header ? 'Actions' : html`<${DiscardButton} tab=${tab} /><${CloseButton} tab=${tab} />`}
      </>
    </tr>
  `
}

const TabList = ({ tabs }) => html`
  <table>
    <thead>
      <${TableRow} header="${true}" />
    </thead>
    <tbody>
      ${Array.from(tabs).map(tab => html`
        <${TableRow} tab=${tab} />
      `)}
    </tbody>
  </table>
`;

const Window = (window) => html`
  <section>
    <h2>Window ${window.id} – ${window.tabs.size} tabs <${DiscardWindowButton} window=${window}/></h2>
    <${TabList} ...${{tabs: window.tabs}}/>
  </section>
`;

const WindowList = ({windows}) => html`
  <div>
    ${Array.from(windows).map(([id, tabs]) => html`
      <${Window} ...${{id, tabs}} />
    `)}
  </div>
`;

const FuzzyFilter = ({onInput}) => {
  return html`
    <input type="text" id="fuzzy-filter" autofocus onInput=${onInput} />
  `;
};

// class FuzzyFilter extends Component {

//   handleValueUpdate()

//   render() {
//     return html`
//       <input type="text" id="fuzzy-filter" autofocus value="test" />
//     `;
//   }
// }


class App extends Component {
  constructor()  {
    super();

    this.state = {
      tabs: [],
      windows: [],
      filter: '',
      filteredTabs: [],
      filteredWindows: []
    }

    ext.tabs.query({}, (...args) => this.handleTabListInitialization(...args));

    ext.tabs.onRemoved.addListener((...args) => this.handleTabRemoved(...args))
  }

  handleTabListInitialization(tabs) {
    let windows = this.reduceWindows(tabs);
    this.setState({ tabs, windows, filteredTabs: tabs, filteredWindows: windows });
  }

  handleTabRemoved(tabId, {windowId, isWindowClosing}) {
    let tabs = [...this.state.tabs];
    let index = tabs.findIndex(i => i.id > 2600)
    tabs.splice(index, 1);

    this.setState({tabs});
    this.filterTabs(this.state.filter);
  }

  reduceWindows(tabs) {
    return tabs.reduce((acc, tab) => {
      let window;
      if (acc.has(tab.windowId)) {
        window = acc.get(tab.windowId);
      } else {
        window = new Set();
        acc.set(tab.windowId, window);
      }
      window.add(tab);
      return acc;
    }, new Map());
  }

  fuzzySearch(tab, searchString) {
    let searchSubString = searchString.split(" ");
    let tabTitle = tab.title.toLowerCase();
    let tabUrl = tab.url.toLowerCase();
    let miss = false;

    for (let i = 0; i < searchSubString.length; i++) {
      let subject = searchSubString[i];

      if (!tabTitle.includes(subject) && !tabUrl.includes(subject)) {
        miss = true;
        break;
      }
    }

    return !miss;
  }

  filterTabs(filterString) {
    let filteredTabs = this.state.tabs.filter(tab => this.fuzzySearch(tab, filterString));

    let filteredWindows = this.reduceWindows(filteredTabs);
    this.setState({filteredTabs, filteredWindows});
  }

  handleFuzzyFilterUpdate(e) {
    let filter = e.srcElement.value;
    this.setState({filter});
    this.filterTabs(filter);
  }

  render(props, { filteredTabs, filteredWindows }) {
    let windowSize = filteredWindows.size;
    let tabsPerWindow = filteredTabs.length / windowSize;

    return html`
      <main>
        <${FuzzyFilter} onInput=${e => this.handleFuzzyFilterUpdate(e)}/>
        <p>${filteredTabs.length} tabs across ${windowSize} windows (${tabsPerWindow.toFixed(1)} tpw)</p>

        <${WindowList} ...${{windows: filteredWindows}} />
      </main>
    `;
  }
}

render(html`<${App} />`, document.body);
