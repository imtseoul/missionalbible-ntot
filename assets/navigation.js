(() => {
  const content=document.querySelector('#site-content');
  if (!content || !window.fetch || !window.DOMParser) return;
  const version=document.querySelector('meta[name="site-version"]').content;
  const cache=new Map(), pending=new Map(), pageStates=new Map();
  const limit=16;
  let current=location.pathname, sequence=0, idleTimer, navigating=false;
  const status=document.querySelector('#route-status');
  const basePath=document.querySelector('meta[name="site-base"]').content;
  const route=/^\/(?:$|(?:catalog|about)\/$|[a-z0-9]+-\d+\/(?:[a-z0-9-]+\/)?)$/;

  function remember(path,html) {
    cache.delete(path);cache.set(path,html);
    while(cache.size>limit) cache.delete(cache.keys().next().value);
  }
  function read(path) {
    if(cache.has(path)) {
      const html=cache.get(path);remember(path,html);return Promise.resolve(html);
    }
    if(!pending.has(path)) {
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),12000);
      const request=fetch(path,{signal:controller.signal,credentials:'same-origin'})
        .then(response=>{
          if(!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('unavailable');
          return response.text();
        }).then(html=>{remember(path,html);return html;})
        .finally(()=>{pending.delete(path);clearTimeout(timer);});
      pending.set(path,request);
    }
    return pending.get(path);
  }
  function target(anchor) {
    if(!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target!=='_self' || anchor.closest('[hidden]')) return null;
    const url=new URL(anchor.href,location.href);
    return url.origin===location.origin && !url.search && url.pathname.startsWith(basePath) && route.test('/'+url.pathname.slice(basePath.length)) ? url : null;
  }
  function busy(value) {
    navigating=value;
    document.body.classList.toggle('route-loading',value);
    content.setAttribute('aria-busy',String(value));
    status.textContent=value?'본문을 불러오는 중…':'';
    status.hidden=!value;
  }
  function schedule() {
    clearTimeout(idleTimer);
    const connection=navigator.connection;
    if(navigating || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
    idleTimer=setTimeout(async()=>{
      const links=[...document.querySelectorAll('.citation-card,.index-row,.related-readings a')];
      const selected=links.findIndex(a=>a.getAttribute('aria-current')==='page');
      const nearby=selected>=0?[...links.slice(selected+1),...links.slice(0,selected)]:links;
      const urls=[...new Set(nearby.map(a=>target(a)?.pathname).filter(p=>p && p!==current))].slice(0,2);
      for(const path of urls) {
        if(navigating) return;
        try {await read(path);} catch {}
      }
    },350);
  }
  async function navigate(url,pop=false) {
    if(url.pathname===current) {
      if(pop) {sequence++;busy(false);schedule();}
      return;
    }
    const ticket=++sequence;
    pageStates.set(current,{scroll:window.scrollY,reader:window.NTLxxReader?.capture?.()});
    while(pageStates.size>limit) pageStates.delete(pageStates.keys().next().value);
    clearTimeout(idleTimer);busy(true);
    try {
      const html=await read(url.pathname);
      if(ticket!==sequence) return;
      const next=new DOMParser().parseFromString(html,'text/html');
      const incoming=next.querySelector('#site-content');
      if(!incoming || next.querySelector('meta[name="site-version"]')?.content!==version) throw new Error('new version');
      for(const script of incoming.querySelectorAll('script')) {
        if(script.type!=='application/json') script.remove();
      }
      if(!pop) history.pushState(null,'',url.pathname+url.hash);
      window.NTLxxReader?.destroy();window.NTLxxHome?.destroy();
      content.replaceChildren(...[...incoming.childNodes].map(node=>document.importNode(node,true)));
      document.body.classList.remove('hide-ot','hide-greek','quotes-only');
      document.title=next.title;
      document.querySelector('meta[name="description"]').content=next.querySelector('meta[name="description"]')?.content || '';
      current=url.pathname;
      const saved=pop?pageStates.get(current):null;
      window.NTLxxReader?.mount(saved?.reader);window.NTLxxHome?.mount();
      window.scrollTo({top:saved?.scroll || 0,behavior:'instant'});
      const main=document.querySelector('#main');
      main?.setAttribute('tabindex','-1');main?.focus({preventScroll:true});
      // Reader verse anchors and home chapter anchors are handled by their mounts.
      if(url.hash && !saved && !document.querySelector('.reader-page,.home-browser')) document.getElementById(url.hash.slice(1))?.scrollIntoView();
    } catch {
      if(ticket===sequence) location.assign(url.href);
    } finally {
      if(ticket===sequence) {busy(false);schedule();}
    }
  }
  remember(current,document.documentElement.outerHTML);
  document.addEventListener('click',event=>{
    if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url=target(event.target.closest('a[href]'));
    if(!url || url.pathname===current) return;
    event.preventDefault();navigate(url);
  });
  function intent(event) {
    const connection=navigator.connection;
    if(connection?.saveData) return;
    const url=target(event.target.closest('a[href]'));
    if(url && url.pathname!==current && pending.size<2) read(url.pathname).catch(()=>{});
  }
  document.addEventListener('pointerover',intent,{passive:true});
  document.addEventListener('focusin',intent);
  document.addEventListener('touchstart',intent,{passive:true});
  window.addEventListener('popstate',()=>navigate(new URL(location.href),true));
  window.addEventListener('nt-lxx:links-ready',schedule);
  schedule();
})();
