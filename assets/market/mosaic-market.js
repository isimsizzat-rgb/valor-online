/* Direct purchases of every mosaic gem type at levels 1–3. */
const valorMosaicProducts = veGemTypes.flatMap((type, index) => [1, 2, 3].map(level => ({
  id: 'mosaic-' + index + '-' + level,
  category: 'mosaic', gemType: type, gemLevel: level,
  name: type + ' · Sv. ' + level,
  price: [20, 50, 120][level - 1],
  icon: vgArt(type, level),
  description: '+' + veGemValue(type, level) + ' ' + type + '. Atölye → Mozaik bölümünde ekipmana takılır.'
})));
const valorMosaicPreviousProduct = marketProduct;
marketProduct = function (id) {
  return valorMosaicProducts.find(product => product.id === id) || valorMosaicPreviousProduct(id);
};
const valorMosaicPreviousRemaining = marketRemaining;
marketRemaining = function (product) {
  if (product.category === 'mosaic') { marketDailyReset(); return Number.MAX_SAFE_INTEGER; }
  return valorMosaicPreviousRemaining(product);
};
const valorMosaicPreviousAddStack = addMarketStack;
addMarketStack = function (id, count) {
  const product = valorMosaicProducts.find(p => p.id === id);
  if (product) {
    if (Number.isSafeInteger(count) && count > 0) vwAddGem(product.gemType, product.gemLevel, count);
    return;
  }
  return valorMosaicPreviousAddStack(id, count);
};
const valorMosaicPreviousCategory = marketCategoryContent;
marketCategoryContent = function (active) {
  if (active !== 'mosaic') return valorMosaicPreviousCategory(active);
  return '<section class="vm-page vm-market-body vm-mosaic-market"><div class="vm-section-title"><div><span class="vm-eyebrow">MARKET · ELMASLA ALIŞVERİŞ</span>' +
    '<h2>Mozaik Taşlar</h2></div></div><p class="vm-lead">İstediğin türü ve seviyeyi seç. Satın aldığın taş doğrudan çantana eklenir. Günlük alım sınırı yok.</p>' +
    veGemTypes.map(type => '<section class="vm-mosaic-group"><h3>' + type + '</h3><div class="vm-mosaic-grid">' +
      valorMosaicProducts.filter(p => p.gemType === type).map(p => '<button type="button" class="vm-mosaic-product" onclick="openMarketPurchase(\'' + p.id + '\')" ontouchend="event.stopPropagation()" aria-label="' + p.name + ', ' + p.price + ' elmas">' +
      '<span class="vm-mosaic-art">' + p.icon + '</span><strong>Sv. ' + p.gemLevel + '</strong><small>+' + veGemValue(p.gemType, p.gemLevel) + '</small><b>' + p.price + ' 💎</b></button>').join('') +
      '</div></section>').join('') + '</section>';
};
const valorMosaicPreviousOpenPurchase = openMarketPurchase;
openMarketPurchase = function (id) {
  const product = valorMosaicProducts.find(p => p.id === id);
  if (!product) return valorMosaicPreviousOpenPurchase(id);
  closeMarketPurchase();
  marketDailyReset();
  marketPurchaseId = id;
  marketPurchaseQty = 1;
  const affordable = Math.floor((Number(state.diamonds) || 0) / product.price);
  const overlay = document.createElement('div');
  overlay.id = 'vm-market-purchase';
  overlay.className = 'vm-market-purchase-overlay';
  overlay.innerHTML = '<div class="vm-market-purchase-dialog" role="dialog" aria-modal="true" aria-label="' + product.name + ' satın al">' +
    '<button class="vm-market-purchase-close" onclick="closeMarketPurchase()" aria-label="Kapat">×</button><div class="vm-market-purchase-art">' + product.icon + '</div>' +
    '<div class="vm-market-purchase-kicker">MOZAİK TAŞLAR</div><h2>' + product.name + '</h2><p>' + product.description + '</p>' +
    '<div class="vm-market-limit">Birim fiyat: <b>' + product.price + ' 💎</b><br>Günlük alım sınırı yok.</div>' +
    '<div class="vm-market-qty"><button type="button" onclick="marketQtyChange(-1)" aria-label="Bir eksilt">−</button>' +
    '<input id="vmMarketPurchaseQty" type="number" inputmode="numeric" min="1" max="' + Math.max(1, affordable) + '" value="1" aria-label="Alınacak ürün adedi" oninput="marketQtySet(this.value)">' +
    '<button type="button" onclick="marketQtyChange(1)" aria-label="Bir artır">+</button></div>' +
    '<div class="vm-market-total"><span>Toplam</span><strong id="vmMarketPurchaseTotal">' + product.price + ' 💎</strong></div>' +
    '<button type="button" id="vmMarketPurchaseConfirm" class="vm-market-buy-confirm" ' + (affordable < 1 ? 'disabled' : '') + ' onclick="buyMarketProduct()">Satın Al</button></div>';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeMarketPurchase(); });
  overlay.addEventListener('touchend', e => e.stopPropagation(), {passive: true});
  document.body.appendChild(overlay);
};
