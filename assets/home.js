(() => {
  let dispose=()=>{};
  const cache=new Map();
  function mount() {
  dispose();dispose=()=>{};
  const home = document.querySelector('.home-browser');
  if (!home) return;
  let alive=true;
  const nav = home.querySelector('.home-book-nav');
  const tabs = [...nav.querySelectorAll('[data-home-book]')];
  const panels = new Map([...home.querySelectorAll('[data-home-panel]')].map(el => [el.id, el]));
  const links = new Map([...home.querySelectorAll('[data-home-chapter-link]')].map(el => [el.dataset.homeChapterLink, el]));
  const selectedChapters = new Map();
  const rendered = new Map();
  for (const section of home.querySelectorAll('[data-home-chapter]')) rendered.set(section.dataset.homeChapter,section);
  let request = 0;
  let activeLink = home.querySelector('[aria-current="location"]');

  const element = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };
  function shell(link) {
    const book = panels.get(link.dataset.book);
    const section = element('section', 'home-chapter');
    section.dataset.homeChapter = link.id;
    const heading = element('header', 'home-chapter-heading');
    const title = element('h3', '', `${book.dataset.name} ${link.textContent}장`);
    title.id = 'heading-' + link.id;
    section.setAttribute('aria-labelledby', title.id);
    const titleWrap = element('div'); titleWrap.append(title);
    const full = element('a', '', '장 전체 읽기'); full.href = link.getAttribute('href');
    heading.append(titleWrap, full);
    const columns = element('div', 'home-row-head');
    columns.setAttribute('aria-hidden', 'true');
    for (const label of ['신약 본문', '칠십인역 본문', '구분']) columns.append(element('span', '', label));
    section.append(heading, columns, element('div', 'index-rows'));
    return section;
  }
  function load(link) {
    const source = link.dataset.source;
    if (!cache.has(source)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const promise = fetch(source, {signal: controller.signal})
        .then(response => { if (!response.ok) throw new Error('unavailable'); return response.json(); })
        .then(data => {
          if (data.id !== link.id || !Array.isArray(data.rows)) throw new Error('invalid chapter');
          return data;
        }).catch(error => { cache.delete(source); throw error; }).finally(() => clearTimeout(timeout));
      cache.set(source, promise);
    }
    return cache.get(source);
  }
  function render(data, link) {
    const section = shell(link), rows = section.querySelector('.index-rows');
    for (const row of data.rows) {
      const anchor = element('a', 'index-row'); anchor.href = row.url;
      const ot = element('span', 'ot-ref', row.ot);
      ot.append(element('span', 'passage-subject', row.lead));
      anchor.append(element('span', 'nt-ref', row.nt), ot, element('span', 'relation', row.kind));
      rows.append(anchor);
    }
    section.querySelector('.home-row-head').hidden = data.rows.length === 0;
    return section;
  }
  async function select(target, updateUrl = false) {
    let link = links.get(target);
    const book = link ? link.dataset.book : target;
    const panel = panels.get(book);
    if (!panel) return false;
    link ||= links.get(selectedChapters.get(book)) || [...links.values()].find(el => el.dataset.book === book);
    if (!link) return false;
    const ticket = ++request;
    selectedChapters.set(book, link.id);
    const selectedName=home.querySelector('#current-book-name');
    if(selectedName) selectedName.textContent=panel.dataset.name;
    for (const [id, el] of panels) el.hidden = id !== book;
    tabs.forEach(tab => {
      const selected = tab.dataset.homeBook === book;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    });
    activeLink?.removeAttribute('aria-current');
    activeLink = link; link.setAttribute('aria-current', 'location');
    if (updateUrl && location.hash !== '#' + link.id) history.pushState(null, '', '#' + link.id);
    const destination = panel.querySelector('.home-chapter-list');
    if (rendered.has(link.id)) {
      destination.replaceChildren(rendered.get(link.id));
      destination.removeAttribute('aria-busy');
      window.dispatchEvent(new Event('nt-lxx:links-ready'));
      return true;
    }
    const placeholder = shell(link), rowArea = placeholder.querySelector('.index-rows');
    const status = element('p', 'home-load-status', '불러오는 중…'); status.setAttribute('role', 'status');
    rowArea.append(status); destination.replaceChildren(placeholder); destination.setAttribute('aria-busy', 'true');
    try {
      const data = await load(link);
      const section = render(data, link); rendered.set(link.id, section);
      if (alive && ticket === request) {
        destination.replaceChildren(section);
        window.dispatchEvent(new Event('nt-lxx:links-ready'));
      }
    } catch {
      if (!alive || ticket !== request) return true;
      status.textContent = '목록을 불러오지 못했습니다.';
      const retry = element('button', 'home-retry', '다시 불러오기'); retry.type = 'button';
      retry.addEventListener('click', () => select(link.id));
      const fallback = element('a', '', '장 전체에서 읽기'); fallback.href = link.getAttribute('href');
      rowArea.append(retry, fallback);
    } finally {
      if (alive && ticket === request) destination.removeAttribute('aria-busy');
    }
    return true;
  }
  function ordinaryClick(event) { return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0; }
  nav.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', tab.dataset.homeBook);
    tab.addEventListener('click', event => {
      if (!ordinaryClick(event)) return;
      event.preventDefault(); select(tab.dataset.homeBook, true);
      const picker=home.querySelector('.home-book-picker');
      if(picker){picker.open=false;picker.querySelector('summary').focus();}
    });
    tab.addEventListener('keydown', event => {
      if (event.key === ' ') { event.preventDefault(); select(tab.dataset.homeBook, true); return; }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      select(tabs[next].dataset.homeBook, true); tabs[next].focus();
    });
  });
  for (const panel of panels.values()) panel.setAttribute('role', 'tabpanel');
  for (const link of links.values()) link.addEventListener('click', event => {
    if (!ordinaryClick(event)) return;
    event.preventDefault(); select(link.id, true);
  });
  function restore() {
    const target = location.hash.slice(1);
    select(links.has(target) || panels.has(target) ? target : tabs[0].dataset.homeBook);
  }
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  restore();
  dispose=()=>{alive=false;request++;window.removeEventListener('popstate',restore);window.removeEventListener('hashchange',restore);};
  }
  window.NTLxxHome={mount,destroy:()=>{dispose();dispose=()=>{};}};
  mount();
})();
