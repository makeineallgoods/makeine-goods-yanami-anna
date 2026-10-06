(() => {
  'use strict';

  let storageKey = 'makeine-goods-catalog-collection-v1';
  const CATEGORY_LABELS = {
    accessory: '随身配件',
    acrylic_art: '亚克力艺术板',
    acrylic_keychain: '亚克力挂件',
    acrylic_stand: '亚克力立牌',
    apparel: '服饰',
    bag: '包袋',
    can_badge: '徽章',
    card: '卡片',
    clear_file: '透明文件夹',
    fabric_goods: '布艺制品',
    poster: '海报',
    stationery: '文具',
    sticker: '贴纸',
    tableware: '餐具',
    tapestry: '挂毯',
    trading_card: '集换卡牌'
  };
  const SALE_LABELS = { single: '单品', random: '随机', set: '套装' };
  const PHASE_LABELS = {
    general_sale: '普通销售',
    event_sale: '活动现场销售',
    event_presale: '活动先行销售',
    after_sale: '事后通贩',
    store_sale: '店铺销售',
    local_sale: '地方限定销售',
    lottery_prize: '抽奖奖品',
    purchase_bonus: '购入特典',
    reservation_bonus: '预订特典',
    point_reward: '积分兑换'
  };
  const VERIFY_LABELS = { confirmed_text: '文字已确认', confirmed_image: '图片已确认', seller_claim: '店铺资料', unverified: '待核实' };

  const dom = {
    grid: document.querySelector('#catalogGrid'),
    empty: document.querySelector('#emptyState'),
    error: document.querySelector('#loadError'),
    search: document.querySelector('#searchInput'),
    category: document.querySelector('#categoryFilter'),
    campaign: document.querySelector('#campaignFilter'),
    maker: document.querySelector('#makerFilter'),
    sort: document.querySelector('#sortSelect'),
    random: document.querySelector('#randomFilter'),
    pageSize: document.querySelector('#pageSize'),
    pagination: document.querySelector('#pagination'),
    paginationControls: document.querySelector('#paginationControls'),
    pageInfo: document.querySelector('#pageInfo'),
    detail: document.querySelector('#detailDialog'),
    detailContent: document.querySelector('#detailContent'),
    toast: document.querySelector('#toast')
  };

  let catalog = null;
  let registry = { categories: [], campaigns: [], manufacturers: [] };
  let collection = { version: 1, items: {} };
  let statusFilter = 'all';
  let currentPage = 1;
  let toastTimer = null;

  function loadCollection() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return parsed && parsed.version === 1 && parsed.items ? parsed : { version: 1, items: {} };
    } catch (_) {
      return { version: 1, items: {} };
    }
  }

  function saveCollection() {
    localStorage.setItem(storageKey, JSON.stringify(collection));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function imageUrl(image, thumbnail = false) {
    const path = thumbnail ? (image.thumbnail_path || image.path) : image.path;
    const version = image.cache_version || catalog?.catalog?.updated_at || '1';
    return `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
  }

  function formatPrice(price) {
    return Number.isInteger(price) ? `¥${price.toLocaleString('ja-JP')}` : '价格待补';
  }

  function itemState(id) {
    return collection.items[id] || {};
  }

  function registryEntry(group, id) {
    return registry[group].find(entry => entry.id === id);
  }

  function categoryLabel(item) {
    return registryEntry('categories', item.category_id)?.name_zh || CATEGORY_LABELS[item.category_id] || item.category_id;
  }

  function campaignLabel(item) {
    return registryEntry('campaigns', item.campaign_id)?.name_zh || item.campaign_id;
  }

  function campaignYear(item) {
    return registryEntry('campaigns', item.campaign_id)?.year || Number(item.release_date?.slice(0, 4)) || null;
  }

  function manufacturerLabel(item) {
    return registryEntry('manufacturers', item.manufacturer_id)?.name_zh || item.manufacturer_id;
  }

  function setStatus(id, nextStatus) {
    const current = itemState(id);
    const status = current.status === nextStatus ? null : nextStatus;
    const updated = { ...current, status };
    if (!status && !updated.quantity && !updated.paid_price_yen && !updated.acquired_from && !updated.acquired_at && !updated.note) {
      delete collection.items[id];
    } else {
      collection.items[id] = updated;
    }
    saveCollection();
    render();
  }

  function getSearchText(item) {
    return [
      item.id, item.global_product_id, item.name_ja, item.name_zh,
      item.category_id, categoryLabel(item), item.campaign_id, campaignLabel(item),
      item.manufacturer_id, manufacturerLabel(item), item.variant, ...(item.tags || [])
    ].join(' ').toLocaleLowerCase();
  }

  function filteredItems() {
    const keyword = dom.search.value.trim().toLocaleLowerCase();
    const selectedCategory = dom.category.value;
    const selectedCampaign = dom.campaign.value;
    const selectedMaker = dom.maker.value;
    const onlyRandom = dom.random.checked;

    const items = catalog.items.filter(item => {
      const status = itemState(item.id).status || null;
      if (keyword && !getSearchText(item).includes(keyword)) return false;
      if (selectedCategory && item.category_id !== selectedCategory) return false;
      if (selectedCampaign && item.campaign_id !== selectedCampaign) return false;
      if (selectedMaker && item.manufacturer_id !== selectedMaker) return false;
      if (onlyRandom && item.sale_format?.type !== 'random') return false;
      if (statusFilter === 'owned' && status !== 'owned') return false;
      if (statusFilter === 'wanted' && status !== 'wanted') return false;
      if (statusFilter === 'missing' && status === 'owned') return false;
      return true;
    });

    const collator = new Intl.Collator('zh-CN');
    items.sort((a, b) => {
      switch (dom.sort.value) {
        case 'oldest': return (campaignYear(a) || 9999) - (campaignYear(b) || 9999) || collator.compare(a.name_zh, b.name_zh);
        case 'priceAsc': return (a.list_price_yen ?? Infinity) - (b.list_price_yen ?? Infinity) || collator.compare(a.name_zh, b.name_zh);
        case 'priceDesc': return (b.list_price_yen ?? -1) - (a.list_price_yen ?? -1) || collator.compare(a.name_zh, b.name_zh);
        case 'name': return collator.compare(a.name_zh, b.name_zh);
        default: return (campaignYear(b) || 0) - (campaignYear(a) || 0) || collator.compare(a.name_zh, b.name_zh);
      }
    });
    return items;
  }

  function cardTemplate(item) {
    const state = itemState(item.id);
    const image = item.images?.[0];
    const statusClass = state.status === 'owned' ? ' is-owned' : state.status === 'wanted' ? ' is-wanted' : '';
    const random = item.sale_format?.type === 'random';
    const imageMarkup = image
      ? `<img loading="lazy" decoding="async" src="${escapeHtml(imageUrl(image, true))}" alt="${escapeHtml(item.name_zh)}">`
      : '';
    const tags = (item.tags || []).slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    const verifyClass = item.verification === 'confirmed_image' ? ' image' : '';

    return `
      <article class="item-card${statusClass}" data-id="${escapeHtml(item.id)}">
        <button type="button" class="item-media${image ? ' has-image' : ''}" data-action="detail" aria-label="查看 ${escapeHtml(item.name_zh)} 详情">
          ${imageMarkup}
          <span class="placeholder"><strong>${escapeHtml([...catalog.character.name_zh][0])}</strong><span>资料图待补</span></span>
          <span class="media-flags">
            <span class="flag">${escapeHtml(categoryLabel(item))}</span>
            ${random ? '<span class="flag random">随机</span>' : ''}
          </span>
        </button>
        <div class="card-body">
          <div class="eyebrow"><span>${escapeHtml(campaignLabel(item))}</span><span>${escapeHtml(campaignYear(item) || '年份待补')}</span></div>
          <h2>${escapeHtml(item.name_zh)}</h2>
          <p class="jp-name" lang="ja">${escapeHtml(item.name_ja)}</p>
          <div class="tag-row">${tags}</div>
          <div class="price-row">
            <span class="price">${formatPrice(item.list_price_yen)}</span>
            <span class="verify${verifyClass}">${escapeHtml(VERIFY_LABELS[item.verification] || item.verification)}</span>
          </div>
        </div>
        <div class="card-actions">
          <button type="button" data-action="owned" class="${state.status === 'owned' ? 'active-owned' : ''}" aria-pressed="${state.status === 'owned'}">✓ ${state.status === 'owned' ? '已收藏' : '我有'}</button>
          <button type="button" data-action="wanted" class="${state.status === 'wanted' ? 'active-wanted' : ''}" aria-pressed="${state.status === 'wanted'}">☆ ${state.status === 'wanted' ? '想要' : '心愿'}</button>
          <button type="button" class="detail-button" data-action="detail" title="详情" aria-label="详情">…</button>
        </div>
      </article>`;
  }

  function paginationItems(page, pageCount) {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
    const pages = new Set([1, pageCount, page - 1, page, page + 1]);
    const sorted = [...pages].filter(value => value >= 1 && value <= pageCount).sort((a, b) => a - b);
    const result = [];
    sorted.forEach((value, index) => {
      if (index && value - sorted[index - 1] > 1) result.push(`ellipsis-${value}`);
      result.push(value);
    });
    return result;
  }

  function renderPagination(totalItems, pageSize, pageCount) {
    if (!totalItems) {
      dom.pagination.hidden = true;
      dom.paginationControls.innerHTML = '';
      return;
    }

    const firstItem = (currentPage - 1) * pageSize + 1;
    const lastItem = Math.min(currentPage * pageSize, totalItems);
    dom.pageInfo.textContent = `${firstItem}-${lastItem} / ${totalItems} 件 · 第 ${currentPage}/${pageCount} 页`;

    const pageButtons = paginationItems(currentPage, pageCount).map(value => {
      if (typeof value === 'string') return '<span class="pagination-ellipsis" aria-hidden="true">…</span>';
      const active = value === currentPage;
      return `<button type="button" data-page="${value}"${active ? ' class="active" aria-current="page"' : ''} aria-label="第 ${value} 页">${value}</button>`;
    }).join('');

    dom.paginationControls.innerHTML = `
      <button type="button" class="page-arrow" data-page="prev" aria-label="上一页" title="上一页" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
      ${pageButtons}
      <button type="button" class="page-arrow" data-page="next" aria-label="下一页" title="下一页" ${currentPage === pageCount ? 'disabled' : ''}>›</button>`;
    dom.pagination.hidden = false;
  }

  function render() {
    if (!catalog) return;
    const items = filteredItems();
    const pageSize = Number(dom.pageSize.value);
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    currentPage = Math.min(Math.max(currentPage, 1), pageCount);
    const start = (currentPage - 1) * pageSize;
    const visibleItems = items.slice(start, start + pageSize);
    dom.grid.innerHTML = visibleItems.map(cardTemplate).join('');
    dom.empty.hidden = items.length !== 0;
    const catalogIsEmpty = catalog.items.length === 0;
    document.querySelector('#emptyMessage').textContent = catalogIsEmpty ? '制品资料整理中' : '没有匹配的制品';
    document.querySelector('#clearFilters').hidden = catalogIsEmpty;
    document.querySelector('#visibleCount').textContent = items.length;
    renderPagination(items.length, pageSize, pageCount);
    updateStats();
  }

  function resetPageAndRender() {
    currentPage = 1;
    render();
  }

  function scrollToCatalog() {
    dom.grid.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  function updateStats() {
    const all = catalog.items;
    const owned = all.filter(item => itemState(item.id).status === 'owned').length;
    const wanted = all.filter(item => itemState(item.id).status === 'wanted').length;
    const withImages = all.filter(item => item.images?.length).length;
    document.querySelector('#totalCount').textContent = all.length;
    document.querySelector('#ownedCount').textContent = owned;
    document.querySelector('#wantedCount').textContent = wanted;
    document.querySelector('#imageCount').textContent = `${withImages}/${all.length}`;
  }

  function detailTemplate(item) {
    const state = itemState(item.id);
    const image = item.images?.[0];
    const imageMarkup = image ? `<img decoding="async" src="${escapeHtml(imageUrl(image))}" alt="${escapeHtml(item.name_zh)}">` : '<span>资料图待补</span>';
    const facts = [
      ['品类', categoryLabel(item)],
      ['联动 / 系列', campaignLabel(item)],
      ['厂商', manufacturerLabel(item)],
      ['售卖形式', SALE_LABELS[item.sale_format?.type] || item.sale_format?.type],
      ['规格', item.spec?.size || '待补'],
      ['材质', item.spec?.material || '待补'],
      ['发售日', item.release_date || '待补'],
      ['核验', VERIFY_LABELS[item.verification] || item.verification]
    ].map(([term, value]) => `<div class="fact"><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
    const sales = (item.sales || []).map(sale => `
      <a class="source-link" href="${escapeHtml(sale.url)}" target="_blank" rel="noopener noreferrer">
        <span>${escapeHtml(sale.seller)}</span><small>${escapeHtml(PHASE_LABELS[sale.phase] || sale.phase)}</small>
      </a>`).join('');
    const sources = (item.sources || []).map(source => `
      <a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
        <span>${escapeHtml(source.type)} 来源</span><small>${escapeHtml(source.checked_at || '')}</small>
      </a>`).join('');

    return `
      <div class="detail-layout">
        <div class="detail-image">${imageMarkup}</div>
        <div class="detail-main">
          <div class="eyebrow"><span>${escapeHtml(campaignLabel(item))}</span><span>${escapeHtml(campaignYear(item) || '')}</span></div>
          <h2>${escapeHtml(item.name_zh)}</h2>
          <p class="detail-ja" lang="ja">${escapeHtml(item.name_ja)}</p>
          <div class="detail-price">${formatPrice(item.list_price_yen)}</div>
          <dl class="facts">${facts}</dl>
          ${item.notes ? `<p class="jp-name">${escapeHtml(item.notes)}</p>` : ''}
        </div>
      </div>
      <section class="detail-section"><h3>销售渠道</h3><div class="link-list">${sales || '<span class="jp-name">待补</span>'}</div></section>
      <section class="detail-section"><h3>资料来源</h3><div class="link-list">${sources}</div></section>
      <section class="detail-section">
        <h3>我的收藏记录</h3>
        <form class="collection-form" id="collectionForm" data-id="${escapeHtml(item.id)}">
          <label>数量<input name="quantity" type="number" min="0" step="1" value="${escapeHtml(state.quantity || '')}"></label>
          <label>入手价（日元）<input name="paid_price_yen" type="number" min="0" step="1" value="${escapeHtml(state.paid_price_yen || '')}"></label>
          <label>入手渠道<input name="acquired_from" value="${escapeHtml(state.acquired_from || '')}"></label>
          <label>入手日期<input name="acquired_at" type="date" value="${escapeHtml(state.acquired_at || '')}"></label>
          <label class="wide">备注<textarea name="note">${escapeHtml(state.note || '')}</textarea></label>
          <div class="dialog-actions wide">
            <button type="button" data-detail-action="wanted">☆ 标记想要</button>
            <button type="button" data-detail-action="owned">✓ 标记已有</button>
            <button type="submit" class="save">保存记录</button>
          </div>
        </form>
      </section>`;
  }

  function openDetail(id) {
    const item = catalog.items.find(entry => entry.id === id);
    if (!item) return;
    dom.detailContent.innerHTML = detailTemplate(item);
    dom.detail.showModal();

    const form = document.querySelector('#collectionForm');
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const current = itemState(id);
      const next = { ...current };
      for (const key of ['quantity', 'paid_price_yen', 'acquired_from', 'acquired_at', 'note']) {
        const value = String(data.get(key) || '').trim();
        if (value) next[key] = key === 'quantity' || key === 'paid_price_yen' ? Number(value) : value;
        else delete next[key];
      }
      collection.items[id] = next;
      saveCollection();
      render();
      showToast('收藏记录已保存');
    });
    form.querySelectorAll('[data-detail-action]').forEach(button => {
      button.addEventListener('click', () => {
        setStatus(id, button.dataset.detailAction);
        dom.detail.close();
      });
    });
  }

  function populateSelect(select, values, labeler = value => value) {
    const fragment = document.createDocumentFragment();
    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = labeler(value);
      fragment.appendChild(option);
    });
    select.appendChild(fragment);
  }

  function initializeFilters() {
    const unique = key => [...new Set(catalog.items.map(item => item[key]).filter(Boolean))];
    populateSelect(dom.category, unique('category_id').sort(), value => registryEntry('categories', value)?.name_zh || value);
    populateSelect(dom.campaign, unique('campaign_id').sort(), value => registryEntry('campaigns', value)?.name_zh || value);
    populateSelect(dom.maker, unique('manufacturer_id').sort(), value => registryEntry('manufacturers', value)?.name_zh || value);
  }

  function clearFilters() {
    dom.search.value = '';
    dom.category.value = '';
    dom.campaign.value = '';
    dom.maker.value = '';
    dom.random.checked = false;
    statusFilter = 'all';
    document.querySelectorAll('.status-tab').forEach(button => {
      const active = button.dataset.status === 'all';
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    resetPageAndRender();
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2200);
  }

  function exportCollection() {
    const payload = JSON.stringify({ ...collection, exported_at: new Date().toISOString() }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${catalog.character.id}-collection.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('收藏记录已导出');
  }

  async function importCollection(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.version !== 1 || typeof parsed.items !== 'object') throw new Error('invalid');
      collection = { version: 1, items: parsed.items };
      saveCollection();
      render();
      showToast('收藏记录已导入');
    } catch (_) {
      showToast('无法读取这份收藏记录');
    } finally {
      document.querySelector('#importInput').value = '';
    }
  }

  function bindEvents() {
    [dom.search, dom.category, dom.campaign, dom.maker, dom.sort, dom.random].forEach(control => {
      control.addEventListener(control === dom.search ? 'input' : 'change', resetPageAndRender);
    });
    dom.pageSize.addEventListener('change', resetPageAndRender);
    document.querySelectorAll('.status-tab').forEach(button => {
      button.addEventListener('click', () => {
        statusFilter = button.dataset.status;
        document.querySelectorAll('.status-tab').forEach(tab => {
          const active = tab === button;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-selected', String(active));
        });
        resetPageAndRender();
      });
    });
    dom.paginationControls.addEventListener('click', event => {
      const button = event.target.closest('[data-page]');
      if (!button || button.disabled) return;
      const pageCount = Math.max(1, Math.ceil(filteredItems().length / Number(dom.pageSize.value)));
      if (button.dataset.page === 'prev') currentPage -= 1;
      else if (button.dataset.page === 'next') currentPage += 1;
      else currentPage = Number(button.dataset.page);
      currentPage = Math.min(Math.max(currentPage, 1), pageCount);
      render();
      scrollToCatalog();
    });
    dom.grid.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      const card = event.target.closest('.item-card');
      if (!button || !card) return;
      const id = card.dataset.id;
      if (button.dataset.action === 'owned') setStatus(id, 'owned');
      if (button.dataset.action === 'wanted') setStatus(id, 'wanted');
      if (button.dataset.action === 'detail') openDetail(id);
    });
    dom.grid.addEventListener('error', event => {
      if (event.target.tagName !== 'IMG') return;
      event.target.hidden = true;
      event.target.closest('.item-media')?.classList.remove('has-image');
    }, true);
    document.querySelector('#clearFilters').addEventListener('click', clearFilters);
    document.querySelector('#detailClose').addEventListener('click', () => dom.detail.close());
    dom.detail.addEventListener('click', event => { if (event.target === dom.detail) dom.detail.close(); });
    document.querySelector('#exportBtn').addEventListener('click', exportCollection);
    document.querySelector('#importInput').addEventListener('change', event => {
      if (event.target.files?.[0]) importCollection(event.target.files[0]);
    });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        event.preventDefault();
        dom.search.focus();
      }
    });
  }

  async function start() {
    bindEvents();
    try {
      const paths = ['data/catalog.json', 'data/registry/categories.json', 'data/registry/campaigns.json', 'data/registry/manufacturers.json'];
      const responses = await Promise.all(paths.map(path => fetch(path, { cache: 'default' })));
      const failed = responses.find(response => !response.ok);
      if (failed) throw new Error(`HTTP ${failed.status}`);
      const [catalogData, categoryData, campaignData, manufacturerData] = await Promise.all(responses.map(response => response.json()));
      catalog = catalogData;
      registry = {
        categories: categoryData.categories,
        campaigns: campaignData.campaigns,
        manufacturers: manufacturerData.manufacturers
      };
      storageKey = `makeine-goods-${catalog.character.id}-collection-v1`;
      collection = loadCollection();
      document.body.dataset.character = catalog.character.id;
      document.title = `${catalog.character.name_zh}制品图鉴`;
      document.querySelector('#characterName').textContent = catalog.character.name_zh;
      document.querySelector('#characterAlias').textContent = `${catalog.character.name_en} / ${catalog.character.name_ja}`;
      const hubLink = document.querySelector('#hubLink');
      const isLocalWorkspace = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
        && window.location.pathname.startsWith('/makeine-goods-');
      const hubUrl = catalog.catalog.hub_url || (isLocalWorkspace ? '/makeine-goods-catalog/public/' : null);
      if (hubUrl) {
        hubLink.href = hubUrl;
        hubLink.hidden = false;
      }
      initializeFilters();
      document.querySelector('#updatedAt').textContent = catalog.catalog.updated_at;
      render();
    } catch (error) {
      dom.error.hidden = false;
      dom.error.textContent = `资料库加载失败：${error.message}。请通过本地网页服务访问。`;
    }
  }

  start();
})();
