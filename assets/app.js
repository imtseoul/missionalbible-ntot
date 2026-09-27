(() => {
  let dispose = () => {};
  const preferences = {greek: true, quotes: false, tab: 'nt'};
  function mount() {
  dispose(); dispose = () => {};
  const panels = document.querySelector('.panels');
  if (!panels) return;
  let alive = true;
  const sides = ['nt', 'lxx', 'ot'];
  const pairs = JSON.parse(document.querySelector('#pair-data').textContent);
  const verseComparisons = JSON.parse(document.querySelector('#verse-comparison-data').textContent);
  const verseByPair = new Map(verseComparisons.flatMap(detail => detail.pair_ids.map(id => [id,detail])));
  const mapping = JSON.parse(document.querySelector('#ot-mapping').textContent);
  const compact = window.matchMedia('(max-width: 950px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const info = document.querySelector('#selection-info');
  const showOt = document.querySelector('#show-ot');
  const selectionLabel = document.querySelector('#selection-label');
  const selectionTexts = document.querySelector('#selected-pair-texts');
  const selectionDetails = document.querySelector('#selected-verse-details');
  const closeSelection = document.querySelector('#clear-selection');
  const otPreference = 'nt-lxx-show-ot';
  document.documentElement.classList.add('js-on');
  const panelElements = new Map(sides.map(side => [side, document.querySelector('#panel-' + side)]));
  const panelFor = side => panelElements.get(side);
  const pairById = new Map(pairs.map(pair => [pair.id, pair]));
  const phraseButtons = [...document.querySelectorAll('.phrase')];
  const buttonsByPair = new Map();
  const otByLxx = new Map();
  for (const button of phraseButtons) {
    if (!buttonsByPair.has(button.dataset.pair)) buttonsByPair.set(button.dataset.pair, []);
    buttonsByPair.get(button.dataset.pair).push(button);
  }
  for (const row of mapping) {
    if (!otByLxx.has(row.lxx_verse)) otByLxx.set(row.lxx_verse, []);
    otByLxx.get(row.lxx_verse).push(row.ot_verse);
  }
  let highlighted = [], sourceButton;
  const verseFor = (side,n) => document.getElementById(side+'-'+n);
  const visibleSides = () => showOt.checked ? sides : ['nt', 'lxx'];
  function scrollToElement(el, behavior = 'smooth') {
    if (!el) return;
    const box=el.closest('.text-scroll');
    box.scrollTo({top:box.scrollTop+el.getBoundingClientRect().top-box.getBoundingClientRect().top-16,behavior:reduced.matches?'auto':behavior});
  }
  function revealPending() {
    for (const side of sides) {
      const panel=panelFor(side);
      if (panel.dataset.pendingVerse && getComputedStyle(panel).display!=='none') {
        scrollToElement(verseFor(side,panel.dataset.pendingVerse),'auto');
        delete panel.dataset.pendingVerse;
      }
    }
  }
  function setTab(side,focus=false) {
    if (side === 'ot' && !showOt.checked) side = 'lxx';
    preferences.tab = side;
    for (const name of sides) {
      const active=name===side, tab=document.querySelector('#tab-'+name), panel=panelFor(name);
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      panel.classList.toggle('mobile-active',active);
      if (focus && active) tab.focus();
    }
    revealPending();
  }
  function positionVerse(side,n,behavior='smooth') {
    const panel=panelFor(side);
    if (getComputedStyle(panel).display==='none') panel.dataset.pendingVerse=String(n);
    else {delete panel.dataset.pendingVerse;scrollToElement(verseFor(side,n),behavior);}
  }
  function clearSelection() {
    highlighted.forEach(el=>el.classList.remove('selected','verse-selected'));
    highlighted = [];
    info.hidden = true;
    info.classList.remove('has-selection');
    selectionLabel.textContent = '';
    selectionTexts.replaceChildren();
    selectionDetails.replaceChildren();
  }
  function markVerse(side,n) {
    const verse=verseFor(side,n);
    if (verse) {verse.classList.add('verse-selected');highlighted.push(verse);}
  }
  closeSelection.addEventListener('click',()=>{clearSelection();sourceButton?.focus({preventScroll:true});});
  info.addEventListener('keydown',event=>{
    if (event.key==='Escape') {event.preventDefault();clearSelection();sourceButton?.focus({preventScroll:true});}
  });
  function setOtVisible(visible, persist = true) {
    showOt.checked = visible;
    document.body.classList.toggle('hide-ot', !visible);
    panelFor('ot').hidden = !visible;
    const otTab = document.querySelector('#tab-ot');
    otTab.hidden = !visible;
    if (!visible && otTab.getAttribute('aria-selected') === 'true') setTab('lxx');
    clearSelection();
    if (persist) {
      try { localStorage.setItem(otPreference, String(visible)); } catch {}
    }
    revealPending();
  }
  let initialOt = true;
  try { initialOt = localStorage.getItem(otPreference) !== 'false'; } catch {}
  setOtVisible(initialOt, false);
  showOt.addEventListener('change', () => setOtVisible(showOt.checked));
  setTab(preferences.tab);
  document.querySelector('#show-greek').checked=preferences.greek;
  document.querySelector('#quotes-only').checked=preferences.quotes;
  document.body.classList.toggle('hide-greek',!preferences.greek);
  document.body.classList.toggle('quotes-only',preferences.quotes);
  for (const side of sides) {
    const tab=document.querySelector('#tab-'+side);
    tab.addEventListener('click',()=>setTab(side));
    tab.addEventListener('keydown',e=>{
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault();
      const available=visibleSides();
      const next=e.key==='Home'?0:e.key==='End'?available.length-1:(available.indexOf(side)+(e.key==='ArrowRight'?1:available.length-1))%available.length;
      setTab(available[next],true);
    });
  }
  function jumpToQuote(behavior='smooth') {
    for (const side of sides) positionVerse(side,panels.dataset[side+'Start'],behavior);
  }
  document.querySelector('#quote-jump').addEventListener('click',()=>jumpToQuote());
  document.querySelector('#chapter-start').addEventListener('click',()=>{
    preferences.quotes=false;
    document.querySelector('#quotes-only').checked=false;
    document.body.classList.remove('quotes-only');
    for (const side of sides) positionVerse(side,1);
  });
  document.querySelector('#show-greek').addEventListener('change',e=>{preferences.greek=e.target.checked;document.body.classList.toggle('hide-greek',!e.target.checked);});
  document.querySelector('#quotes-only').addEventListener('change',e=>{
    preferences.quotes=e.target.checked;
    document.body.classList.toggle('quotes-only',e.target.checked);
    if(e.target.checked) jumpToQuote('auto');
  });
  phraseButtons.forEach(button=>button.addEventListener('click',()=>{
    const pair=pairById.get(button.dataset.pair);
    if(!pair) return;
    clearSelection();
    sourceButton=button;
    const matches=buttonsByPair.get(pair.id);
    matches.forEach(el=>el.classList.add('selected'));
    highlighted.push(...matches);
    const other=matches.find(el=>el!==button), ots=otByLxx.get(pair.lxx[0]) || [], ot=ots[0];
    ots.forEach(n=>markVerse('ot',n));
    const detail=verseByPair.get(pair.id);
    if(!detail) return;
    selectionLabel.textContent='절 전체 대조';
    const element=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
    const rowsForSide=side=>detail[side];
    const formatVerses=rows=>{const ns=rows.map(row=>row.verse);return ns.length>1 && ns.every((n,i)=>!i || n===ns[i-1]+1)?ns[0]+'–'+ns.at(-1):ns.join(', ');};
    for (const side of ['nt','lxx']) {
      const rows=rowsForSide(side);
      const column=element('div','pair-column');
      const ref=element('button','pair-reference',side==='nt'?`${panels.dataset.ntBook || '행'} ${panels.dataset.ntChapter}:${formatVerses(rows)}`:`${document.querySelector('#lxx-title').textContent} ${formatVerses(rows)}절`);
      ref.type='button';ref.setAttribute('aria-label',ref.textContent+' 본문으로 이동');
      ref.addEventListener('click',()=>{
        if(compact.matches)setTab(side);
        positionVerse(side,pair[side][0],'auto');
        verseFor(side,pair[side][0]).querySelector('.verse-no').focus({preventScroll:true});
        panelFor(side).scrollIntoView({block:'nearest',behavior:reduced.matches?'auto':'smooth'});
      });
      column.append(ref,element('p','pair-edition',side==='nt'?'개역한글':'칠십인역 한국어'));
      for(const row of rows){
        const ko=element('p','pair-korean');ko.dataset.verse=row.verse;
        ko.append(element('span','pair-verse-number',String(row.verse)));
        const content=element('span','pair-verse-text');
        const spans=[];
        for(const id of detail.pair_ids){
          const ep=pairById.get(id)[side];
          if(ep[0]!==row.verse)continue;
          const start=row.ko.indexOf(ep[1]);
          if(start>=0)spans.push({start,end:start+ep[1].length,id});
        }
        let end=0;
        for(const span of spans.sort((a,b)=>a.start-b.start)){
          content.append(document.createTextNode(row.ko.slice(end,span.start)));
          const marked=element('mark',span.id===pair.id?'pair-focus':'pair-linked',row.ko.slice(span.start,span.end));content.append(marked);end=span.end;
        }
        content.append(document.createTextNode((row.ko || '').slice(end)));ko.append(content);column.append(ko);
      }
      column.append(element('p','pair-edition pair-greek-label',side==='nt'?'헬라어 · SBLGNT':'헬라어 · Swete'));
      for(const row of rows){
        const grc=element('p','pair-greek');grc.lang='grc';grc.dataset.verse=row.verse;
        grc.append(element('span','pair-verse-number',String(row.verse)));
        const content=element('span','pair-verse-text');content.innerHTML=row.grc_html;grc.append(content);column.append(grc);
      }
      selectionTexts.append(column);
    }
    const overview=element('section','comparison-overview');
    overview.append(element('h3','',detail.focus_text_kind==='gloss'?'핵심 표현의 뜻':'핵심 표현'));
    if(detail.summary)overview.append(element('p','comparison-summary',detail.summary));
    const focusTable=element('table','focus-table');
    const head=element('thead'),headRow=element('tr');
    for(const label of ['신약','칠십인역']){const th=element('th','',label);th.scope='col';headRow.append(th);}
    head.append(headRow);focusTable.append(head);
    const focusBody=element('tbody');
    for(const row of detail.focus_rows){
      const labelRow=element('tr','focus-label-row'),label=element('th','',row.label);
      label.colSpan=2;label.setAttribute('colspan','2');labelRow.append(label);focusBody.append(labelRow);
      const values=element('tr','focus-value-row');
      if(row.pair_id===pair.id)values.classList.add('active-expression');
      for(const side of ['nt','lxx']){
        const cell=element('td'),ko=element('p','focus-ko',row[side].ko),grc=element('p','focus-grc');
        grc.lang='grc';grc.innerHTML=row[side].grc_html;cell.append(ko,grc);values.append(cell);
      }
      focusBody.append(values);
    }
    focusTable.append(focusBody);overview.append(focusTable);selectionDetails.append(overview);
    const explanation=element('section','verse-explanation');
    explanation.append(element('h3','','차이와 인용의 의미'));
    for(const note of detail.notes){
      const block=element('div','verse-explanation-item');
      if(note.pair_id===pair.id)block.classList.add('active-note');
      block.append(element('h4','',note.title),element('p','',note.text));explanation.append(block);
    }
    selectionDetails.append(explanation);
    if(detail.differences.length){
      const changes=element('details','verse-differences');
      changes.append(element('summary','','헬라어 어구별 차이'));
      const table=element('table','verse-diff-table');
      const heading=element('tr');heading.append(element('th','','신약'),element('th','','칠십인역'));
      const thead=element('thead');thead.append(heading);table.append(thead);
      const tbody=element('tbody');
      for(const delta of detail.differences){
        const tr=element('tr');
        for(const side of ['nt','lxx']){const cell=element('td',delta[side]?'':'no-phrase',delta[side] || '이 위치의 대응 어구 없음');if(delta[side])cell.lang='grc';tr.append(cell);}
        tbody.append(tr);
      }
      table.append(tbody);changes.append(table);selectionDetails.append(changes);
    }
    info.hidden=false;
    info.classList.add('has-selection');
    // The full verses and their explanations stay in the same reading surface.
    // Restore the tapped verse after the comparison panel changes the layout.
    requestAnimationFrame(()=>{
      if (!alive) return;
      positionVerse(button.dataset.side,pair[button.dataset.side][0],'auto');
      positionVerse(other.dataset.side,pair[other.dataset.side][0],'auto');
      if(ot) positionVerse('ot',ot,'auto');
      info.scrollIntoView({block:'start',behavior:reduced.matches?'auto':'smooth'});
    });
  }));
  document.querySelectorAll('[data-compare-side]').forEach(link=>link.addEventListener('click',e=>{
    e.preventDefault();
    const side=link.dataset.compareSide,n=Number(link.dataset.compareVerse);
    const origin=Number(link.closest('.verse').dataset.verse);
    const lxx=side==='lxx'?n:origin,ot=side==='ot'?n:origin;
    if(side==='ot' && !showOt.checked) setOtVisible(true);
    clearSelection();markVerse('lxx',lxx);markVerse('ot',ot);
    if(compact.matches) setTab(side);
    positionVerse('lxx',lxx);positionVerse('ot',ot);
    history.replaceState(null,'',link.getAttribute('href'));
    if(compact.matches) verseFor(side,n).querySelector('.verse-no').focus({preventScroll:true});
    selectionLabel.textContent=`${document.querySelector('#lxx-title').textContent} ${lxx}절 ↔ ${document.querySelector('#ot-title').textContent} ${ot}절`;
    info.hidden=false;
    info.classList.add('has-selection');
  }));
  function navigateHash() {
    const match=location.hash.match(/^#(nt|lxx|ot)-(\d+)$/);
    if(!match || !verseFor(match[1],match[2])) return false;
    if(match[1]==='ot' && !showOt.checked) setOtVisible(true);
    preferences.quotes=false;
    document.body.classList.remove('quotes-only');document.querySelector('#quotes-only').checked=false;
    if(compact.matches) setTab(match[1]);
    positionVerse(match[1],match[2],'auto');
    return true;
  }
  window.addEventListener('hashchange',navigateHash);
  compact.addEventListener('change',revealPending);
  requestAnimationFrame(()=>{if(alive && !navigateHash())jumpToQuote('auto');});
  dispose=()=>{alive=false;window.removeEventListener('hashchange',navigateHash);compact.removeEventListener('change',revealPending);};
  }
  window.NTLxxReader={mount,destroy:()=>{dispose();dispose=()=>{};}};
  mount();
})();
