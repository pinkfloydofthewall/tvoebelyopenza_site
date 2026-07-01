const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5500');
  await new Promise(r => setTimeout(r, 2000));
  
  const len = await page.evaluate(() => catalogData.products.length);
  const pLen = await page.evaluate(() => {
    let p = [...catalogData.products];
    p = p.filter(x => {
      const price = x.price || 0;
      return price >= filters.priceMin && price <= filters.priceMax;
    });
    return p.length;
  });
  
  const lastProd = await page.evaluate(() => catalogData.products[catalogData.products.length-1]);
  const isFiltered = await page.evaluate(() => {
    let p = [...catalogData.products];
    // Category
    if (activeCategory !== 'Все') {
      p = p.filter(x => x.category === activeCategory);
    }
    // Search
    if (filters.query) {
      const q = filters.query;
      p = p.filter(x => x.name.toLowerCase().includes(q) || (x.description || '').toLowerCase().includes(q));
    }
    // Price
    p = p.filter(x => {
      const price = x.price || 0;
      return price >= filters.priceMin && price <= filters.priceMax;
    });
    // Size
    if (filters.sizes.size > 0) {
      p = p.filter(x => (x.available_sizes || []).some(s => filters.sizes.has(s)));
    }
    // Brand
    if (filters.brands.size > 0) {
      p = p.filter(x => filters.brands.has(x.brand));
    }
    // New
    if (filters.newOnly) {
      p = p.filter(x => x.new === true);
    }
    return p.find(x => x.id === 20) ? true : false;
  });
  
  console.log('Total:', len, 'Filtered:', pLen, 'PriceMax:', await page.evaluate(() => filters.priceMax));
  console.log('Last product:', lastProd.name);
  console.log('Is ID 20 after all filters?', isFiltered);
  
  await browser.close();
})();
