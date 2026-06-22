/* ============================================================
   ТВОЁ БЕЛЬЁ — script.js
   Data loaded from data.json; future admin editor can edit it.
   ============================================================ */

'use strict';

/* ── State ──────────────────────────────────────────────────── */
let catalogData   = null;
let activeCategory = 'Все';
let activeProductId = null;

// Filter state
const filters = {
  query:    '',
  priceMin: 0,
  priceMax: 5000,
  sizes:    new Set(),   // selected sizes
  brands:   new Set(),   // selected brands
  newOnly:  false,
  sort:     'default'
};

/* ── DOM Ready ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
});

/* ── Data Loading ───────────────────────────────────────────── */
async function loadData() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Failed to load data.json');
    catalogData = await res.json();
  } catch (e) {
    console.warn('Could not fetch data.json — using fallback data.');
    catalogData = getFallbackData();
  }

  // Set price range max from actual data
  const maxPrice = Math.max(...catalogData.products.map(p => p.price || 0));
  filters.priceMax = maxPrice;
  const priceMaxEl = document.getElementById('price-max');
  const priceMinEl = document.getElementById('price-min');
  if (priceMaxEl) { priceMaxEl.max = maxPrice; priceMaxEl.value = maxPrice; }
  if (priceMinEl) { priceMinEl.max = maxPrice; }

  applyBrandData();
  buildCategoryTabs();
  buildSizeButtons();
  buildBrandButtons();
  buildProductGrid();
  initPriceSlider();
  initPage();
}

/* ── Brand Data ─────────────────────────────────────────────── */
function applyBrandData() {
  const b = catalogData.brand;
  document.querySelectorAll('[data-brand="name"]').forEach(el => el.textContent = b.name);
  document.querySelectorAll('[data-brand="tagline"]').forEach(el => el.textContent = b.tagline);
  document.querySelectorAll('[data-brand="about_title"]').forEach(el => el.textContent = b.about_title || 'О нас');
  document.querySelectorAll('[data-brand="about_text"]').forEach(el => el.textContent = b.about_text);
  document.querySelectorAll('[data-brand="about_text_2"]').forEach(el => el.textContent = b.about_text_2);
  document.querySelectorAll('[data-brand="contact_text"]').forEach(el => el.textContent = b.contact_text);
  document.querySelectorAll('[data-brand="contact_instagram"]').forEach(el => {
    el.textContent = b.contact_instagram;
    el.href = 'https://instagram.com/' + b.contact_instagram.replace('@','');
  });
  document.querySelectorAll('[data-brand="contact_phone"]').forEach(el => {
    el.textContent = b.contact_phone;
    el.href = 'tel:' + b.contact_phone.replace(/\D/g,'');
  });
  document.querySelectorAll('[data-brand="contact_email"]').forEach(el => {
    if (!b.contact_email) return;
    el.textContent = b.contact_email;
    el.href = 'mailto:' + b.contact_email;
  });
  document.title = b.name + ' — Каталог женского белья';
}

/* ── Category Tabs ──────────────────────────────────────────── */
function buildCategoryTabs() {
  const container = document.getElementById('filter-tabs');
  container.innerHTML = '';
  catalogData.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-tab' + (cat === activeCategory ? ' active' : '');
    btn.dataset.category = cat;
    btn.innerHTML = `<span>${cat}</span>`;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.toggle('active', b.dataset.category === cat));
      applyFilters();
    });
    container.appendChild(btn);
  });
}

/* ── Size Buttons ───────────────────────────────────────────── */
function buildSizeButtons() {
  const allSizes = [...new Set(
    catalogData.products.flatMap(p => p.available_sizes || [])
  )].sort((a, b) => {
    const order = ['XS','S','M','L','XL','XXL','Plus'];
    const ai = order.indexOf(a), bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const container = document.getElementById('size-btn-group');
  container.innerHTML = '';
  allSizes.forEach(size => {
    const btn = document.createElement('button');
    btn.className = 'size-btn';
    btn.textContent = size;
    btn.dataset.size = size;
    btn.addEventListener('click', () => {
      if (filters.sizes.has(size)) {
        filters.sizes.delete(size);
        btn.classList.remove('active');
      } else {
        filters.sizes.add(size);
        btn.classList.add('active');
      }
      applyFilters();
    });
    container.appendChild(btn);
  });
}

/* ── Brand Buttons ──────────────────────────────────────────── */
function buildBrandButtons() {
  const brands = catalogData.brands ||
    [...new Set(catalogData.products.map(p => p.brand).filter(Boolean))];

  const container = document.getElementById('brand-btn-group');
  container.innerHTML = '';
  brands.forEach(brand => {
    const btn = document.createElement('button');
    btn.className = 'brand-btn';
    btn.textContent = brand;
    btn.dataset.brand = brand;
    btn.addEventListener('click', () => {
      if (filters.brands.has(brand)) {
        filters.brands.delete(brand);
        btn.classList.remove('active');
      } else {
        filters.brands.add(brand);
        btn.classList.add('active');
      }
      applyFilters();
    });
    container.appendChild(btn);
  });
}

/* ── Price Slider ───────────────────────────────────────────── */
function initPriceSlider() {
  const sliderMin  = document.getElementById('price-min');
  const sliderMax  = document.getElementById('price-max');
  const fill       = document.getElementById('price-fill');
  const labelMin   = document.getElementById('price-min-val');
  const labelMax   = document.getElementById('price-max-val');
  if (!sliderMin || !sliderMax) return;

  let priceDebounce;
  function updateSlider() {
    const min = parseInt(sliderMin.value);
    const max = parseInt(sliderMax.value);
    const range = parseInt(sliderMin.max);

    // Prevent crossing
    if (min > max - 100) { sliderMin.value = max - 100; return; }
    if (max < min + 100) { sliderMax.value = min + 100; return; }

    const leftPct  = (min / range) * 100;
    const rightPct = (max / range) * 100;
    fill.style.left  = leftPct + '%';
    fill.style.width = (rightPct - leftPct) + '%';

    labelMin.textContent = formatPrice(min);
    labelMax.textContent = formatPrice(max);

    filters.priceMin = min;
    filters.priceMax = max;

    // Debounce: apply filters only after user stops dragging
    clearTimeout(priceDebounce);
    priceDebounce = setTimeout(applyFilters, 120);
  }

  sliderMin.addEventListener('input', updateSlider);
  sliderMax.addEventListener('input', updateSlider);
  updateSlider();
}

function formatPrice(n) {
  return n.toLocaleString('ru-RU') + ' ₽';
}

/* ── Search ─────────────────────────────────────────────────── */
function initSearch() {
  const input = document.getElementById('search-input');
  const clear = document.getElementById('search-clear');
  if (!input) return;

  input.addEventListener('input', () => {
    filters.query = input.value.trim().toLowerCase();
    clear.classList.toggle('visible', filters.query.length > 0);
    applyFilters();
  });

  clear.addEventListener('click', () => {
    input.value = '';
    filters.query = '';
    clear.classList.remove('visible');
    applyFilters();
    input.focus();
  });
}

/* ── Sort ───────────────────────────────────────────────────── */
function initSort() {
  const sel = document.getElementById('sort-select');
  if (!sel) return;
  sel.addEventListener('change', () => {
    filters.sort = sel.value;
    applyFilters();
  });
}

/* ── New-only toggle ─────────────────────────────────────────── */
function initNewOnly() {
  const chk = document.getElementById('new-only-check');
  if (!chk) return;
  chk.addEventListener('change', () => {
    filters.newOnly = chk.checked;
    applyFilters();
  });
}

/* ── Reset ───────────────────────────────────────────────────── */
function initResetBtn() {
  const btn = document.getElementById('reset-filters-btn');
  if (!btn) return;
  btn.addEventListener('click', resetFilters);
}

function resetFilters() {
  // Reset state
  filters.query    = '';
  filters.priceMin = 0;
  filters.priceMax = parseInt(document.getElementById('price-max').max);
  filters.sizes.clear();
  filters.brands.clear();
  filters.newOnly  = false;
  filters.sort     = 'default';
  activeCategory   = 'Все';

  // Reset UI
  document.getElementById('search-input').value = '';
  document.getElementById('search-clear').classList.remove('visible');
  document.getElementById('price-min').value = 0;
  document.getElementById('price-max').value = filters.priceMax;
  document.getElementById('sort-select').value = 'default';
  document.getElementById('new-only-check').checked = false;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.brand-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.toggle('active', b.dataset.category === 'Все'));

  initPriceSlider();
  applyFilters();
}

/* ── Core Filter & Sort Logic ───────────────────────────────── */
function applyFilters() {
  let products = [...catalogData.products];

  // 1. Category
  if (activeCategory !== 'Все') {
    products = products.filter(p => p.category === activeCategory);
  }

  // 2. Search
  if (filters.query) {
    const q = filters.query;
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (p.brand || '').toLowerCase().includes(q)
    );
  }

  // 3. Price
  products = products.filter(p => {
    const price = p.price || 0;
    return price >= filters.priceMin && price <= filters.priceMax;
  });

  // 4. Size
  if (filters.sizes.size > 0) {
    products = products.filter(p =>
      (p.available_sizes || []).some(s => filters.sizes.has(s))
    );
  }

  // 5. Brand
  if (filters.brands.size > 0) {
    products = products.filter(p => filters.brands.has(p.brand));
  }

  // 6. New only
  if (filters.newOnly) {
    products = products.filter(p => p.new === true);
  }

  // 7. Sort
  products = sortProducts(products, filters.sort);

  renderProducts(products);
  updateResultsBar(products.length);
  updateResetBtn();
}

function sortProducts(products, sort) {
  const arr = [...products];
  switch (sort) {
    case 'price-asc':  return arr.sort((a, b) => (a.price || 0) - (b.price || 0));
    case 'price-desc': return arr.sort((a, b) => (b.price || 0) - (a.price || 0));
    case 'name-asc':   return arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    case 'name-desc':  return arr.sort((a, b) => b.name.localeCompare(a.name, 'ru'));
    case 'new':        return arr.sort((a, b) => (b.new ? 1 : 0) - (a.new ? 1 : 0));
    default:           return arr;
  }
}

/* ── Render Products ─────────────────────────────────────────── */
function buildProductGrid() {
  renderProducts(catalogData.products);
  updateResultsBar(catalogData.products.length);
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  const emptyState = document.getElementById('empty-state');

  // Remove old cards (keep empty-state)
  grid.querySelectorAll('.product-card').forEach(c => c.remove());

  if (products.length === 0) {
    emptyState.classList.add('visible');
    return;
  }
  emptyState.classList.remove('visible');

  products.forEach((product, idx) => {
    const card = createProductCard(product, idx);
    grid.appendChild(card);
  });
  // No initReveal() here — cards appear instantly when filtering
}

function createProductCard(product, idx) {
  const card = document.createElement('article');
  card.className = 'product-card'; // no 'reveal' — instant display when filtering
  card.setAttribute('data-category', product.category);
  card.setAttribute('data-id', product.id);

  const tagsHTML = (product.tags || []).map(t => `<span class="card-tag">${t}</span>`).join('');
  const sizesHTML = (product.available_sizes || []).join(' · ');
  const priceHTML = product.price
    ? `<span class="card-price">${formatPrice(product.price)}</span>`
    : '';
  const newBadge = product.new
    ? `<div class="card-new-badge">Новинка</div>`
    : (product.featured ? `<div class="card-badge">Коллекция</div>` : '');

  card.innerHTML = `
    <div class="card-image-wrap">
      <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='images/placeholder.png'">
      ${newBadge}
      <div class="card-overlay"></div>
    </div>
    <div class="card-body">
      <p class="card-category">${product.category}${product.brand ? ' · ' + product.brand : ''}</p>
      <h3 class="card-name">${product.name}</h3>
      <p class="card-desc">${product.description}</p>
      <div class="card-tags">${tagsHTML}</div>
    </div>
    <div class="card-footer">
      <div>
        ${priceHTML}
        <div class="sizes-label">Размеры</div>
        <div class="sizes"><span class="size-dot">${sizesHTML}</span></div>
      </div>
      <div class="card-arrow">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openModal(product.id));
  return card;
}

/* ── Results Bar ────────────────────────────────────────────── */
function updateResultsBar(count) {
  const el = document.getElementById('results-count');
  if (!el) return;
  const word = count === 1 ? 'товар' : (count >= 2 && count <= 4 ? 'товара' : 'товаров');
  el.innerHTML = `<strong>${count}</strong> ${word}`;
}

function updateResetBtn() {
  const btn = document.getElementById('reset-filters-btn');
  if (!btn) return;
  const isDefault =
    filters.query === '' &&
    filters.sizes.size === 0 &&
    filters.brands.size === 0 &&
    !filters.newOnly &&
    filters.sort === 'default' &&
    activeCategory === 'Все';
  btn.classList.toggle('visible', !isDefault);
}

/* ── Modal ───────────────────────────────────────────────────── */
function openModal(productId) {
  const product = catalogData.products.find(p => p.id === productId);
  if (!product) return;
  activeProductId = productId;

  const backdrop = document.getElementById('modal-backdrop');
  document.getElementById('modal-image').src = product.image;
  document.getElementById('modal-image').alt = product.name;
  document.getElementById('modal-category').textContent =
    product.category + (product.brand ? ' · ' + product.brand : '');
  document.getElementById('modal-name').textContent = product.name;
  document.getElementById('modal-desc').textContent = product.description;

  // Price in modal
  const priceEl = document.getElementById('modal-price');
  if (priceEl) priceEl.textContent = product.price ? formatPrice(product.price) : '';

  const sizesEl = document.getElementById('modal-sizes');
  sizesEl.innerHTML = (product.available_sizes || [])
    .map(s => `<div class="modal-size">${s}</div>`)
    .join('');
  // Sizes are informational only — no selection in catalog mode

  const tagsEl = document.getElementById('modal-tags');
  tagsEl.innerHTML = (product.tags || []).map(t => `<span class="modal-tag">${t}</span>`).join('');

  const b = catalogData.brand;
  document.getElementById('modal-contact-text').textContent = b.contact_text;
  const instaEl = document.getElementById('modal-instagram');
  if (instaEl) {
    instaEl.textContent = b.contact_instagram;
    instaEl.href = 'https://instagram.com/' + b.contact_instagram.replace('@','');
  }

  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  document.body.style.overflow = '';
  activeProductId = null;
}

/* ── Init Page ───────────────────────────────────────────────── */
function initPage() {
  // Loading screen
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
    document.body.classList.add('loaded');
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) heroContent.classList.add('visible');
  }, 2000);

  window.addEventListener('scroll', onScroll, { passive: true });
  initReveal();
  initSearch();
  initSort();
  initNewOnly();
  initResetBtn();

  // Nav links smooth scroll
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-backdrop')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Catalog scroll button
  const catalogBtn = document.getElementById('catalog-btn');
  if (catalogBtn) {
    catalogBtn.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Initial filter apply
  applyFilters();
}

/* ── Scroll ──────────────────────────────────────────────────── */
function onScroll() {
  const nav = document.getElementById('main-nav');
  if (window.scrollY > 60) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}

/* ── Reveal on Scroll ─────────────────────────────────────────── */
function initReveal() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
  );
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
}

/* ── Fallback Data ───────────────────────────────────────────── */
function getFallbackData() {
  return {
    "brand": {
      "name": "ТВОЁ БЕЛЬЁ",
      "tagline": "ТВОЁ БЕЛЬЁ — магазин женского белья, где твой комфорт на первом месте",
      "about_title": "О нас",
      "about_text": "Мы верим, что комфорт начинается с правильной поддержки — физической и эмоциональной.",
      "about_text_2": "В ассортименте — проверенные бренды Conti и Milavitsa, широкий размерный ряд, в том числе plus-size.",
      "contact_text": "Для уточнения наличия и размеров свяжитесь с нами",
      "contact_instagram": "@tvoye.belye",
      "contact_phone": "+7 (495) 123-45-67"
    },
    "categories": ["Все", "Комплекты", "Бюстгальтеры", "Трусики", "Боди", "Ночное"],
    "brands": ["Conti", "Milavitsa", "Другие"],
    "products": [
      { "id": 1, "name": "Комплект «Blanc»", "category": "Комплекты", "brand": "Milavitsa", "price": 2890, "new": true,  "description": "Комплект из шёлка с кружевом.", "image": "images/product_1.png", "tags": ["Шёлк","Кружево"], "available_sizes": ["XS","S","M","L"], "featured": true },
      { "id": 2, "name": "Боди «Minuit»",    "category": "Боди",      "brand": "Другие",    "price": 3450, "new": false, "description": "Чёрное кружевное боди.",           "image": "images/product_2.png", "tags": ["Кружево"],        "available_sizes": ["XS","S","M","L","XL"], "featured": true },
      { "id": 3, "name": "Пеньюар «Rose»",   "category": "Ночное",    "brand": "Conti",     "price": 1990, "new": false, "description": "Нежный пеньюар из сатина.",        "image": "images/product_3.png", "tags": ["Сатин"],          "available_sizes": ["S","M","L"], "featured": false },
      { "id": 4, "name": "Бралет «Perle»",   "category": "Бюстгальтеры","brand": "Conti",   "price": 1490, "new": true,  "description": "Бралет с вышивкой.",               "image": "images/product_4.png", "tags": ["Вышивка"],        "available_sizes": ["XS","S","M","L"], "featured": false },
      { "id": 5, "name": "Комплект «Velours»","category": "Комплекты", "brand": "Milavitsa", "price": 3200, "new": false, "description": "Бархат и кружево цвета бордо.",    "image": "images/product_5.png", "tags": ["Бархат","Кружево"],"available_sizes": ["S","M","L","XL"], "featured": true },
      { "id": 6, "name": "Бралет «Fleur»",   "category": "Бюстгальтеры","brand": "Другие",  "price": 1750, "new": true,  "description": "Тюль с цветочной вышивкой.",       "image": "images/product_6.png", "tags": ["Тюль","Вышивка"], "available_sizes": ["XS","S","M"], "featured": false }
    ]
  };
}
