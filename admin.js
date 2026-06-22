/* ============================================================
   admin.js — ТВОЁ БЕЛЬЁ Catalog Admin Panel
   All catalog CRUD, image upload, brand editing, categories.
   ============================================================ */

'use strict';

/* ── State ─────────────────────────────────────────────────── */
let data = null;          // full data.json object
let editingId = null;     // product id being edited (null = new)
let pendingImagePath = null;  // path returned by server after upload
let pendingDeleteId = null;   // product id waiting for delete confirm
let currentImagePath = null;  // image path of the product being edited

/* ── Init ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initProductModal();
  initDeleteModal();
  initBrandForm();
  initCategories();
  initDeploy();
  loadData();
});

/* ── Deploy ────────────────────────────────────────────────── */
function initDeploy() {
  document.getElementById('btn-deploy').addEventListener('click', async () => {
    const btn = document.getElementById('btn-deploy');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Публикация...';
    btn.disabled = true;
    toast('Отправляем на сайт...', 'info');

    try {
      const res = await fetch('/api/deploy', { method: 'POST' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error);
      toast('Опубликовано! Сайт обновится через ~20 секунд.', 'success');
    } catch (e) {
      toast('Ошибка публикации: ' + e.message, 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
}

/* ── Data ──────────────────────────────────────────────────── */
async function loadData() {
  try {
    const res = await fetch('/data.json?_=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
    renderAll();
    toast('Данные загружены', 'success');
  } catch (e) {
    toast('Ошибка загрузки data.json. Запущен ли server.js?', 'error');
    console.error(e);
  }
}

async function saveData() {
  try {
    const res = await fetch('/api/save-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    });
    const body = await res.json();
    if (!body.ok) throw new Error(body.error);
    toast('Сохранено ✓', 'success');
  } catch (e) {
    toast('Ошибка сохранения: ' + e.message, 'error');
    console.error(e);
  }
}

/* ── Render all ────────────────────────────────────────────── */
function renderAll() {
  renderStats();
  renderProducts();
  renderCategories();
  renderBrandForm();
  renderCategorySelect();
  document.getElementById('sidebar-brand-name').textContent =
    data.brand?.name || 'ТВОЁ БЕЛЬЁ';
}

/* ── Navigation ────────────────────────────────────────────── */
function initNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
      document.getElementById('section-' + btn.dataset.section).classList.add('active');
    });
  });
}

/* ── Stats ─────────────────────────────────────────────────── */
function renderStats() {
  const products = data.products || [];
  document.getElementById('stat-total').textContent = products.length;
  document.getElementById('stat-featured').textContent =
    products.filter(p => p.featured).length;
  document.getElementById('stat-categories-count').textContent =
    (data.categories || []).filter(c => c !== 'Все').length;
}

/* ── Products grid ─────────────────────────────────────────── */
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const products = data.products || [];

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌸</div>
        <p>Товаров пока нет. Нажмите «Добавить товар».</p>
      </div>`;
    return;
  }

  grid.innerHTML = products.map(p => productCardHTML(p)).join('');

  grid.querySelectorAll('.btn-edit-product').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)));
  });
  grid.querySelectorAll('.btn-delete-product').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.id)));
  });
}

function productCardHTML(p) {
  const imgHTML = p.image
    ? `<img class="product-card-img" src="${p.image}?_=${Date.now()}" alt="${escHtml(p.name)}" loading="lazy">`
    : `<div class="product-card-img-placeholder">🌸</div>`;

  const featuredBadge = p.featured
    ? `<span class="featured-badge">⭐ Выделенный</span>` : '';

  return `
    <article class="product-card">
      ${imgHTML}
      <div class="product-card-body">
        <div class="product-card-cat">${escHtml(p.category || '')}</div>
        <div class="product-card-name">${escHtml(p.name || '')}</div>
        <div class="product-card-desc">${escHtml(p.description || '')}</div>
        <div class="product-card-footer">
          ${featuredBadge}
        </div>
      </div>
      <div class="product-card-actions">
        <button class="btn btn-ghost btn-sm btn-edit-product" data-id="${p.id}" aria-label="Редактировать ${escHtml(p.name)}">✏️ Редактировать</button>
        <button class="btn btn-danger btn-sm btn-delete-product" data-id="${p.id}" aria-label="Удалить ${escHtml(p.name)}">🗑️</button>
      </div>
    </article>`;
}

/* ── Product Modal ─────────────────────────────────────────── */
function initProductModal() {
  document.getElementById('btn-add-product').addEventListener('click', openAddModal);
  document.getElementById('modal-close-btn').addEventListener('click', closeProductModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeProductModal);
  document.getElementById('modal-save-btn').addEventListener('click', saveProduct);

  // Close on backdrop click
  document.getElementById('product-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('product-modal')) closeProductModal();
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeProductModal();
      closeDeleteModal();
    }
  });

  // Chip inputs
  initChipInput('tags-input', 'tags-wrap');
  initChipInput('sizes-input', 'sizes-wrap');

  // Image upload
  initImageUpload();
}

function openAddModal() {
  editingId = null;
  pendingImagePath = null;
  currentImagePath = null;
  document.getElementById('modal-title').textContent = 'Добавить товар';
  document.getElementById('edit-product-id').value = '';
  clearProductForm();
  renderCategorySelect();
  openModal('product-modal');
}

function openEditModal(id) {
  const product = (data.products || []).find(p => p.id === id);
  if (!product) return;
  editingId = id;
  pendingImagePath = null;
  currentImagePath = product.image || null;

  document.getElementById('modal-title').textContent = 'Редактировать товар';
  document.getElementById('edit-product-id').value = id;

  renderCategorySelect(product.category);
  document.getElementById('product-name').value = product.name || '';
  document.getElementById('product-description').value = product.description || '';
  document.getElementById('product-featured').checked = !!product.featured;

  // Load chips
  setChips('tags-wrap', 'tags-input', product.tags || []);
  setChips('sizes-wrap', 'sizes-input', product.available_sizes || []);

  // Preview existing image
  if (product.image) {
    showImagePreview(product.image + '?_=' + Date.now());
  } else {
    clearImagePreview();
  }

  openModal('product-modal');
}

function closeProductModal() {
  closeModal('product-modal');
  clearProductForm();
  editingId = null;
  pendingImagePath = null;
  currentImagePath = null;
}

function clearProductForm() {
  document.getElementById('product-name').value = '';
  document.getElementById('product-description').value = '';
  document.getElementById('product-featured').checked = false;
  setChips('tags-wrap', 'tags-input', []);
  setChips('sizes-wrap', 'sizes-input', []);
  clearImagePreview();
}

async function saveProduct() {
  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value;

  if (!name) { toast('Введите название товара', 'error'); return; }
  if (!category) { toast('Выберите категорию', 'error'); return; }

  const tags  = getChips('tags-wrap');
  const sizes = getChips('sizes-wrap');
  const desc  = document.getElementById('product-description').value.trim();
  const featured = document.getElementById('product-featured').checked;

  // Determine image path
  let imagePath = pendingImagePath || currentImagePath || null;

  const btn = document.getElementById('modal-save-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Сохранение…';

  try {
    if (editingId !== null) {
      // Edit existing
      const idx = data.products.findIndex(p => p.id === editingId);
      if (idx !== -1) {
        data.products[idx] = {
          ...data.products[idx],
          name, category, description: desc,
          tags, available_sizes: sizes,
          featured, image: imagePath,
        };
      }
    } else {
      // Add new
      const maxId = data.products.reduce((m, p) => Math.max(m, p.id || 0), 0);
      data.products.push({
        id: maxId + 1,
        name, category, description: desc,
        image: imagePath,
        tags, available_sizes: sizes, featured,
      });
    }

    await saveData();
    renderAll();
    closeProductModal();
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Сохранить товар';
  }
}

/* ── Delete Modal ──────────────────────────────────────────── */
function initDeleteModal() {
  document.getElementById('delete-modal-close').addEventListener('click', closeDeleteModal);
  document.getElementById('delete-cancel-btn').addEventListener('click', closeDeleteModal);
  document.getElementById('delete-confirm-btn').addEventListener('click', confirmDelete);
  document.getElementById('delete-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
  });
}

function openDeleteModal(id) {
  const product = (data.products || []).find(p => p.id === id);
  if (!product) return;
  pendingDeleteId = id;
  document.getElementById('delete-product-name').textContent = product.name;
  openModal('delete-modal');
}

function closeDeleteModal() {
  closeModal('delete-modal');
  pendingDeleteId = null;
}

async function confirmDelete() {
  if (pendingDeleteId === null) return;

  const product = data.products.find(p => p.id === pendingDeleteId);
  if (!product) { closeDeleteModal(); return; }

  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Удаляем…';

  try {
    // Delete image from server
    if (product.image) {
      try {
        await fetch('/api/delete-image?file=' + encodeURIComponent(product.image), { method: 'DELETE' });
      } catch (_) { /* non-fatal */ }
    }

    data.products = data.products.filter(p => p.id !== pendingDeleteId);
    await saveData();
    renderAll();
    closeDeleteModal();
    toast('Товар удалён', 'info');
  } finally {
    btn.disabled = false;
    btn.textContent = '🗑️ Удалить';
  }
}

/* ── Categories ────────────────────────────────────────────── */
function initCategories() {
  document.getElementById('btn-add-category').addEventListener('click', addCategory);
  document.getElementById('new-category-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addCategory();
  });
}

function renderCategories() {
  const list = document.getElementById('categories-list');
  const cats = data.categories || [];
  list.innerHTML = cats.map(cat => {
    if (cat === 'Все') {
      return `<span class="category-item protected">🌸 ${escHtml(cat)}</span>`;
    }
    return `
      <span class="category-item">
        ${escHtml(cat)}
        <button onclick="removeCategory('${escHtml(cat)}')" aria-label="Удалить категорию ${escHtml(cat)}">✕</button>
      </span>`;
  }).join('');
}

function renderCategorySelect(selectedValue = '') {
  const sel = document.getElementById('product-category');
  const cats = (data.categories || []).filter(c => c !== 'Все');
  sel.innerHTML = cats.map(c =>
    `<option value="${escHtml(c)}" ${c === selectedValue ? 'selected' : ''}>${escHtml(c)}</option>`
  ).join('');
  if (selectedValue) sel.value = selectedValue;
}

async function addCategory() {
  const input = document.getElementById('new-category-input');
  const val = input.value.trim();
  if (!val) return;
  if ((data.categories || []).includes(val)) {
    toast('Такая категория уже есть', 'error'); return;
  }
  data.categories = [...(data.categories || []), val];
  input.value = '';
  renderCategories();
  renderStats();
  await saveData();
}

window.removeCategory = async function(cat) {
  if (cat === 'Все') return;
  data.categories = (data.categories || []).filter(c => c !== cat);
  renderCategories();
  renderStats();
  await saveData();
};

/* ── Brand Form ────────────────────────────────────────────── */
function initBrandForm() {
  document.getElementById('btn-save-brand').addEventListener('click', saveBrand);
}

function renderBrandForm() {
  const b = data.brand || {};
  document.getElementById('brand-name').value         = b.name || '';
  document.getElementById('brand-tagline').value      = b.tagline || '';
  document.getElementById('brand-phone').value        = b.contact_phone || '';
  document.getElementById('brand-instagram').value    = b.contact_instagram || '';
  document.getElementById('brand-about-title').value  = b.about_title || '';
  document.getElementById('brand-about').value        = b.about_text || '';
  document.getElementById('brand-about2').value       = b.about_text_2 || '';
  document.getElementById('brand-contact-text').value = b.contact_text || '';
}

async function saveBrand() {
  data.brand = {
    ...data.brand,
    name:               document.getElementById('brand-name').value.trim(),
    tagline:            document.getElementById('brand-tagline').value.trim(),
    contact_phone:      document.getElementById('brand-phone').value.trim(),
    contact_instagram:  document.getElementById('brand-instagram').value.trim(),
    about_title:        document.getElementById('brand-about-title').value.trim(),
    about_text:         document.getElementById('brand-about').value.trim(),
    about_text_2:       document.getElementById('brand-about2').value.trim(),
    contact_text:       document.getElementById('brand-contact-text').value.trim(),
  };
  document.getElementById('sidebar-brand-name').textContent = data.brand.name || 'ТВОЁ БЕЛЬЁ';
  await saveData();
}

/* ── Image Upload ──────────────────────────────────────────── */
function initImageUpload() {
  const zone  = document.getElementById('upload-zone');
  const input = document.getElementById('image-file-input');

  zone.addEventListener('click', e => {
    if (e.target !== input) input.click();
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) handleImageFile(input.files[0]);
  });

  document.getElementById('remove-img-btn').addEventListener('click', e => {
    e.stopPropagation();
    pendingImagePath = null;
    currentImagePath = null;
    clearImagePreview();
    input.value = '';
  });
}

async function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    toast('Выберите файл изображения', 'error'); return;
  }
  if (file.size > 10 * 1024 * 1024) {
    toast('Файл слишком большой (макс. 10 МБ)', 'error'); return;
  }

  // Show local preview immediately
  const localUrl = URL.createObjectURL(file);
  showImagePreview(localUrl);

  // Upload to server
  toast('Загружаем фото…', 'info');
  const form = new FormData();
  form.append('image', file, file.name);

  try {
    const res  = await fetch('/api/upload-image', { method: 'POST', body: form });
    const body = await res.json();
    if (!body.ok) throw new Error(body.error);
    pendingImagePath = body.path;
    toast('Фото загружено ✓', 'success');
  } catch (e) {
    toast('Ошибка загрузки фото: ' + e.message, 'error');
    clearImagePreview();
  }
}

function showImagePreview(src) {
  document.getElementById('upload-zone').style.display = 'none';
  const wrap = document.getElementById('upload-preview');
  wrap.style.display = 'block';
  document.getElementById('preview-img').src = src;
}

function clearImagePreview() {
  document.getElementById('upload-zone').style.display = '';
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('preview-img').src = '';
}

/* ── Chip input (tags / sizes) ─────────────────────────────── */
function initChipInput(inputId, wrapId) {
  const input = document.getElementById(inputId);
  const wrap  = document.getElementById(wrapId);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().replace(/,+$/, '');
      if (val) addChip(wrap, input, val);
    }
    if (e.key === 'Backspace' && !input.value) {
      const chips = wrap.querySelectorAll('.chip');
      if (chips.length) chips[chips.length - 1].remove();
    }
  });

  // Allow clicking wrap to focus input
  wrap.addEventListener('click', e => {
    if (e.target === wrap) input.focus();
  });
}

function addChip(wrap, input, value) {
  // Check duplicate
  const existing = [...wrap.querySelectorAll('.chip')].map(c =>
    c.querySelector('.chip-text')?.textContent || c.textContent.replace('✕', '').trim()
  );
  if (existing.includes(value)) { input.value = ''; return; }

  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.innerHTML = `<span class="chip-text">${escHtml(value)}</span>
    <button class="chip-remove" type="button" aria-label="Удалить ${escHtml(value)}">✕</button>`;
  chip.querySelector('.chip-remove').addEventListener('click', () => chip.remove());
  wrap.insertBefore(chip, input);
  input.value = '';
}

function setChips(wrapId, inputId, values) {
  const wrap  = document.getElementById(wrapId);
  const input = document.getElementById(inputId);
  // Remove existing chips
  wrap.querySelectorAll('.chip').forEach(c => c.remove());
  (values || []).forEach(v => addChip(wrap, input, v));
}

function getChips(wrapId) {
  const wrap = document.getElementById(wrapId);
  return [...wrap.querySelectorAll('.chip-text')].map(el => el.textContent.trim());
}

/* ── Modal helpers ─────────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Focus first input
  setTimeout(() => {
    const first = el.querySelector('input, textarea, select, button');
    if (first) first.focus();
  }, 100);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Toast notifications ───────────────────────────────────── */
function toast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${escHtml(message)}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 3000);
}

/* ── Utils ─────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
