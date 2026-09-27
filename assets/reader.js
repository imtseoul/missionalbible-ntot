(() => {
  const storageKey = 'nt-lxx-reading-v3';
  let dispose = () => {}, capture = () => null, restoreHash = () => {};
  function mount(saved) {
    dispose();
    const root = document.querySelector('.reader-page');
    if (!root) { capture = () => null; restoreHash = () => {}; return; }
    const controller = new AbortController();
    const listen = (element, type, handler) => element.addEventListener(type, handler, {signal: controller.signal});
    const greekControl = root.querySelector('#reader-greek'), otControl = root.querySelector('#reader-ot');
    const fontControl = root.querySelector('#reader-font'), otDetails = root.querySelector('#reader-ot-excerpts');
    const contextPanels = root.querySelector('.reader-context-panels');
    const notes = [...root.querySelectorAll('.reader-note')], phrases = [...root.querySelectorAll('.reader-phrase')];
    const status = root.querySelector('#reader-status'), fallback = root.querySelector('.reader-copy-fallback');
    let preferences = {greek:true, ot:false, font:'normal'};
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (stored && typeof stored === 'object') {
        preferences = {greek:stored.greek !== false, ot:stored.ot === true,
          font:['normal','large','xlarge'].includes(stored.font) ? stored.font : 'normal'};
      } else {
        const previous = JSON.parse(localStorage.getItem('nt-lxx-reading-v2') || 'null');
        preferences.ot = previous && typeof previous === 'object' ? previous.ot === true : localStorage.getItem('nt-lxx-show-ot') === 'true';
        if (previous && ['normal','large','xlarge'].includes(previous.font)) preferences.font = previous.font;
      }
    } catch {}
    let contextMode = 'nt', selectedGroup = null, selectedPair = null, returnPoint = null, initialFrame;
    function persist() { try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch {} }
    function applyPreferences() {
      root.classList.toggle('reader-show-greek', preferences.greek);
      root.classList.toggle('reader-font-large', preferences.font === 'large');
      root.classList.toggle('reader-font-xlarge', preferences.font === 'xlarge');
      greekControl.checked = preferences.greek; otControl.checked = preferences.ot; fontControl.value = preferences.font;
      otDetails.open = preferences.ot;
    }
    function setContext(mode) {
      if (!['nt','lxx','ot','parallel'].includes(mode)) mode = 'nt';
      contextMode = mode;
      contextPanels.classList.toggle('reader-parallel', mode === 'parallel');
      for (const panel of contextPanels.querySelectorAll('.reader-context-panel')) {
        const active = mode === 'parallel' || panel.id === 'context-' + mode;
        panel.hidden = !active; panel.open = active;
      }
      for (const button of root.querySelectorAll('[data-context]')) button.setAttribute('aria-pressed', String(button.dataset.context === mode));
    }
    const relatedNotes = group => notes.filter(note => note.dataset.groups.split(' ').includes(group));
    function updateExpanded() {
      for (const phrase of phrases) phrase.setAttribute('aria-expanded', String(relatedNotes(phrase.dataset.group).some(note => note.open)));
    }
    function selectGroup(group, pair = null, expand = true) {
      const relevant = relatedNotes(group);
      if (!relevant.length) return;
      selectedGroup = group; selectedPair = pair;
      for (const phrase of phrases) phrase.classList.toggle('reader-selected', pair ? phrase.dataset.pair === pair : phrase.dataset.group === group);
      for (const note of notes) note.classList.toggle('reader-note-active', relevant.includes(note));
      if (expand) relevant[0].open = true;
      updateExpanded();
    }
    function openHash(scroll = true) {
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      if (!id) return;
      const target = document.getElementById(id);
      if (!target || !root.contains(target)) return;
      const match = id.match(/^(nt|lxx|ot)-\d+$/);
      if (match) setContext(match[1]);
      if (target.dataset.groupAnchor) selectGroup(target.dataset.groupAnchor);
      else { selectedGroup = null; selectedPair = null; }
      if (target.matches('details')) target.open = true;
      for (let parent = target.parentElement; parent && parent !== root; parent = parent.parentElement) {
        if (parent.matches('details')) parent.open = true;
      }
      if (scroll) target.scrollIntoView({block:'start', behavior:'auto'});
    }
    root.classList.add('reader-enhanced');
    for (const original of root.querySelectorAll('.reader-original')) original.open = true;
    applyPreferences(); setContext(saved?.contextMode || 'nt'); updateExpanded();
    listen(greekControl, 'change', () => { preferences.greek = greekControl.checked; applyPreferences(); persist(); });
    listen(otControl, 'change', () => { preferences.ot = otControl.checked; applyPreferences(); persist(); });
    listen(fontControl, 'change', () => { preferences.font = fontControl.value; applyPreferences(); persist(); });
    listen(otDetails, 'toggle', () => { preferences.ot = otDetails.open; otControl.checked = preferences.ot; persist(); });
    for (const button of root.querySelectorAll('[data-context]')) listen(button, 'click', () => setContext(button.dataset.context));
    for (const note of notes) listen(note, 'toggle', updateExpanded);
    listen(root, 'click', event => {
      const phrase = event.target.closest('.reader-phrase');
      if (phrase && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
        event.preventDefault(); returnPoint = {element:phrase, y:window.scrollY};
        selectGroup(phrase.dataset.group, phrase.dataset.pair);
        history.replaceState(history.state, '', '#analysis-' + phrase.dataset.group);
        return;
      }
      const close = event.target.closest('.reader-close');
      if (close) {
        close.closest('.reader-note').open = false;
        if (returnPoint?.element.isConnected) {
          returnPoint.element.focus({preventScroll:true}); window.scrollTo({top:returnPoint.y, behavior:'auto'});
        } else close.closest('.reader-note').querySelector('summary').focus({preventScroll:true});
        updateExpanded(); return;
      }
      const anchor = event.target.closest('a[href^="#"]');
      if (anchor && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
        const hash = anchor.getAttribute('href');
        let target;
        try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return; }
        if (!target || !root.contains(target)) return;
        event.preventDefault(); history.pushState(history.state, '', hash); openHash(true);
      }
    });
    listen(root, 'keydown', event => {
      if (event.key !== 'Escape') return;
      const note = event.target.closest('.reader-note[open]');
      if (!note) return;
      event.preventDefault(); note.open = false;
      const focus = returnPoint?.element.isConnected ? returnPoint.element : note.querySelector('summary');
      focus.focus({preventScroll:true});
      if (returnPoint?.element.isConnected) window.scrollTo({top:returnPoint.y, behavior:'auto'});
      updateExpanded();
    });
    listen(window, 'hashchange', () => openHash(true));
    async function copy(value, message) {
      fallback.hidden = true;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(value); status.textContent = message;
      } catch {
        fallback.hidden = false;
        const field = fallback.querySelector('textarea'); field.value = value;
        field.focus({preventScroll:true}); field.select();
        status.textContent = '자동 복사가 되지 않아 아래 내용을 선택했습니다. 복사해서 사용하세요.';
      }
    }
    listen(root.querySelector('#reader-copy'), 'click', () => {
      const sections = [];
      for (const column of root.querySelectorAll('.reader-excerpt-column')) {
        if (column.dataset.copySide === 'ot' && !otDetails.open) continue;
        const lines = [column.querySelector('h2').textContent + ' · ' + column.dataset.edition];
        for (const verse of column.querySelectorAll('.reader-verse')) {
          lines.push(verse.dataset.ref + ' ' + verse.querySelector('.reader-ko').textContent.trim());
          const greek = verse.querySelector('.reader-greek');
          if (preferences.greek && greek) lines.push((column.dataset.copySide === 'nt' ? 'SBLGNT: ' : 'Swete: ') + greek.textContent.trim());
        }
        sections.push(lines.join('\n'));
      }
      copy(sections.join('\n\n') + '\n\n' + location.origin + location.pathname, '본문과 성구, 판본을 복사했습니다.');
    });
    listen(root.querySelector('#reader-share'), 'click', () => {
      const url = new URL(location.href);
      if (selectedGroup) url.hash = 'analysis-' + selectedGroup;
      copy(url.href, '이 본문을 여는 링크를 복사했습니다.');
    });
    if (saved) {
      const opened = new Set(saved.open || []);
      for (const details of root.querySelectorAll('details[id]')) {
        if (details.id !== 'reader-ot-excerpts' && !details.id.startsWith('context-')) details.open = opened.has(details.id);
      }
      if (saved.selectedGroup) selectGroup(saved.selectedGroup, saved.selectedPair, false);
    } else initialFrame = requestAnimationFrame(() => openHash(true));
    capture = () => ({contextMode, selectedGroup, selectedPair, open:[...root.querySelectorAll('details[open][id]')].map(details => details.id).filter(id => id !== 'reader-ot-excerpts' && !id.startsWith('context-'))});
    restoreHash = openHash;
    dispose = () => { controller.abort(); cancelAnimationFrame(initialFrame); };
  }
  window.NTLxxReader = {mount, destroy:() => dispose(), capture:() => capture(), restoreHash:(...args) => restoreHash(...args)};
  mount();
})();
