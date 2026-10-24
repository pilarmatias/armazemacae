const quote = new Map();
const productGrid = document.querySelector('#product-grid');
const categoryList = document.querySelector('#category-list');
const categoryFeatures = document.querySelector('#category-features');
const offerGrid = document.querySelector('#offer-grid');
const searchInput = document.querySelector('#product-search');
const quoteItems = document.querySelector('#quote-items');
const copyButton = document.querySelector('#copy-quote');
const copyStatus = document.querySelector('#copy-status');
const quoteCount = document.querySelector('#quote-count');
const quoteCardCount = document.querySelector('#quote-card-count');
const contentStatus = document.querySelector('#content-status');
let products = [];
let catalogCategories = [];
let offers = [];
let activeCategory = 'Todos';
let quoteOutput;
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function isProduct(product) {
  return product !== null && typeof product === 'object'
    && typeof product.id === 'string' && product.id.trim() !== ''
    && typeof product.name === 'string' && product.name.trim() !== ''
    && typeof product.category === 'string' && product.category.trim() !== ''
    && typeof product.unit === 'string' && product.unit.trim() !== ''
    && typeof product.symbol === 'string'
    && typeof product.image === 'string' && product.image.startsWith('https://')
    && Number.isFinite(product.price) && product.price >= 0
    && typeof product.status === 'string' && typeof product.brand === 'string';
}

function getOffer(productId) {
  const offer = offers.find(item => item.productId === productId);
  if (!offer) return null;
  const [day, month, year] = offer.validUntil.split('/').map(Number);
  const expiry = Date.UTC(year, month - 1, day);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return expiry >= todayUtc ? offer : null;
}

function currentPrice(product) {
  return getOffer(product.id)?.price ?? product.price;
}

function createProductCard(product, index, offer = null) {
  const card = makeElement('article', 'product-card');
  const visual = makeElement('div', 'product-visual');
  const image = makeElement('img', 'product-photo');
  image.src = product.image;
  image.alt = `Foto ilustrativa de ${product.name}`;
  image.loading = 'lazy';
  image.decoding = 'async';
  const symbol = makeElement('span', 'product-visual-symbol', product.symbol);
  symbol.hidden = true;
  image.addEventListener('error', () => {
    image.remove();
    symbol.hidden = false;
  }, { once: true });
  visual.append(image, symbol);
  if (offer) visual.append(makeElement('span', 'product-discount', `-${offer.discount}%`));
  else visual.append(makeElement('span', 'product-visual-mark', String(index + 1).padStart(2, '0')));

  const details = makeElement('div', 'product-details');
  details.append(makeElement('span', 'product-category', product.category));
  details.append(makeElement('h3', '', product.name));
  details.append(makeElement('p', 'product-meta', `${product.unit} · ${product.brand}`));
  const status = makeElement('span', `product-availability${product.status === 'Disponível' ? '' : ' is-order'}`, product.status);
  details.append(status);

  const bottom = makeElement('div', 'product-bottom');
  const price = makeElement('span', 'product-price', currency.format(offer?.price ?? product.price));
  if (offer) price.prepend(makeElement('del', 'product-old-price', currency.format(offer.oldPrice)));
  price.append(makeElement('small', '', offer ? `até ${offer.validUntil}` : 'preço por unidade de venda'));
  const addButton = makeElement('button', 'add-product', 'Adicionar à lista');
  addButton.type = 'button';
  addButton.setAttribute('aria-label', `Adicionar ${product.name} à lista de orçamento`);
  addButton.setAttribute('aria-pressed', String(quote.has(product.id)));
  if (quote.has(product.id)) {
    addButton.classList.add('is-added');
    addButton.textContent = 'Adicionar mais';
  }
  addButton.addEventListener('click', () => {
    const current = quote.get(product.id);
    quote.set(product.id, current ? current + 1 : 1);
    renderProducts();
    renderQuote();
    renderOffers();
    copyStatus.textContent = 'Lista atualizada. Valores e disponibilidade sob consulta.';
  });
  bottom.append(price, addButton);
  card.append(visual, details, bottom);
  return card;
}

function renderCategories() {
  const categories = ['Todos', ...catalogCategories.map(category => category.name)];
  const buttons = categories.map(category => {
    const button = makeElement('button', 'category-button', category);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(category === activeCategory));
    button.addEventListener('click', () => setCategory(category));
    return button;
  });
  categoryList.replaceChildren(...buttons);

  const features = catalogCategories.map(categoryData => {
    const category = categoryData.name;
    const categoryProducts = products.filter(product => product.category === category);
    const feature = makeElement('button', 'category-feature');
    feature.type = 'button';
    const itemLabel = categoryProducts.length === 1 ? 'material' : 'materiais';
    feature.setAttribute('aria-label', `Ver ${categoryProducts.length} ${itemLabel} de ${category}`);
    feature.setAttribute('aria-pressed', String(category === activeCategory));
    const image = makeElement('img', 'category-photo');
    image.src = categoryData.image;
    image.alt = '';
    image.loading = 'lazy';
    image.setAttribute('aria-hidden', 'true');
    const copy = makeElement('span', 'category-feature-copy');
    copy.append(
      makeElement('strong', '', category),
      makeElement('small', '', `${categoryProducts.length} ${categoryProducts.length === 1 ? 'produto' : 'produtos'}`),
    );
    feature.append(image, makeElement('span', 'category-photo-shade'), copy, makeElement('span', 'category-feature-arrow', '↗'));
    feature.addEventListener('click', () => {
      setCategory(category);
      document.querySelector('#catalogo').scrollIntoView({ behavior: 'smooth' });
    });
    return feature;
  });
  categoryFeatures.replaceChildren(...features);
}

function setCategory(category) {
  activeCategory = category;
  renderCategories();
  renderProducts();
}

function renderProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase('pt-BR');
  const visibleProducts = products.filter(product => {
    const matchesCategory = activeCategory === 'Todos' || product.category === activeCategory;
    const searchableText = `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('pt-BR');
    return matchesCategory && searchableText.includes(query);
  });
  const categories = catalogCategories.map(category => category.name)
    .filter(category => visibleProducts.some(product => product.category === category));
  const sections = categories.map(category => {
    const sectionProducts = visibleProducts.filter(product => product.category === category);
    const section = makeElement('section', 'product-group');
    section.setAttribute('aria-label', category);
    const heading = makeElement('div', 'product-group-heading');
    heading.append(
      makeElement('h3', '', category),
      makeElement('span', '', `${sectionProducts.length} ${sectionProducts.length === 1 ? 'material' : 'materiais'}`),
    );
    const cards = makeElement('div', 'product-group-grid');
    cards.append(...sectionProducts.map(product => createProductCard(product, products.indexOf(product))));
    section.append(heading, cards);
    return section;
  });
  productGrid.replaceChildren(...sections);
  contentStatus.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? 'material encontrado' : 'materiais encontrados'}`;
  contentStatus.hidden = false;
  if (visibleProducts.length === 0) {
    const empty = makeElement('p', 'no-products', 'Nenhum material encontrado. Tente outra busca ou categoria.');
    productGrid.append(empty);
  }
}

function renderOffers() {
  const activeOffers = offers
    .map(offer => ({ offer, product: products.find(product => product.id === offer.productId) }))
    .filter(item => item.product && getOffer(item.product.id));
  const cards = activeOffers.map(({ offer, product }, index) => createProductCard(product, index, offer));
  offerGrid.replaceChildren(...cards);
}

function renderQuote() {
  const entries = [...quote.entries()];
  const total = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  quoteCount.textContent = String(total);
  quoteCount.setAttribute('aria-label', `${total} ${total === 1 ? 'item' : 'itens'}`);
  quoteCardCount.textContent = `${total} ${total === 1 ? 'item' : 'itens'}`;
  copyButton.disabled = entries.length === 0;
  if (quoteOutput) quoteOutput.hidden = true;

  if (entries.length === 0) {
    const empty = makeElement('div', 'empty-quote');
    empty.append(makeElement('span', '', '＋'));
    const message = makeElement('p');
    message.append('Sua lista está vazia.', document.createElement('br'), 'Adicione materiais do catálogo para começar.');
    empty.append(message);
    const link = makeElement('a', '', 'Ver materiais ');
    link.href = '#catalogo';
    link.append(makeElement('span', '', '↗'));
    empty.append(link);
    quoteItems.replaceChildren(empty);
    return;
  }

  const rows = entries.map(([id, quantity]) => {
    const product = products.find(item => item.id === id);
    if (!product) return null;
    const row = makeElement('article', 'quote-item');
    const info = makeElement('div', 'quote-item-info');
    info.append(makeElement('h4', '', product.name), makeElement('span', '', `${product.unit} · ${currency.format(currentPrice(product))} (consulte a loja)`));
    const controls = makeElement('div', 'quantity-controls');
    const decrease = makeElement('button', 'quantity-button', '−');
    decrease.type = 'button';
    decrease.setAttribute('aria-label', `Diminuir quantidade de ${product.name}`);
    decrease.disabled = quantity <= 1;
    decrease.addEventListener('click', () => updateQuantity(id, quantity - 1));
    const count = makeElement('span', 'quantity-number', String(quantity));
    count.setAttribute('aria-label', `Quantidade: ${quantity}`);
    const increase = makeElement('button', 'quantity-button', '+');
    increase.type = 'button';
    increase.setAttribute('aria-label', `Aumentar quantidade de ${product.name}`);
    increase.addEventListener('click', () => updateQuantity(id, quantity + 1));
    controls.append(decrease, count, increase);
    const remove = makeElement('button', 'remove-item', 'Remover');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      quote.delete(id);
      renderQuote();
      renderProducts();
      renderOffers();
      copyStatus.textContent = `${product.name} removido da lista.`;
    });
    row.append(info, controls, remove);
    return row;
  }).filter(Boolean);

  const clear = makeElement('button', 'clear-quote', 'Limpar lista');
  clear.type = 'button';
  clear.addEventListener('click', () => {
    quote.clear();
    renderQuote();
    renderProducts();
    renderOffers();
    copyStatus.textContent = 'Lista limpa.';
  });
  quoteItems.replaceChildren(...rows, clear);
}

function updateQuantity(id, quantity) {
  if (quantity < 1) return;
  quote.set(id, quantity);
  renderQuote();
  copyStatus.textContent = 'Quantidade atualizada.';
}

function quoteText() {
  const lines = [
    'Solicitação de orçamento — Armazém da Construção (Macaé/RJ)',
    '',
    ...[...quote.entries()].map(([id, quantity]) => {
      const product = products.find(item => item.id === id);
      return `- ${product.name}: ${quantity} ${product.unit} — ${currency.format(currentPrice(product))} por unidade de venda`;
    }),
    '',
    'Preços e disponibilidade sujeitos a confirmação com a loja.',
  ];
  return lines.join('\n');
}

async function copyQuote() {
  if (quote.size === 0) return;
  const text = quoteText();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('Clipboard API indisponível neste contexto.');
    }
    copyStatus.textContent = 'Lista copiada. Agora você pode compartilhá-la com a loja.';
    quoteOutput.hidden = true;
  } catch {
    quoteOutput.value = text;
    quoteOutput.hidden = false;
    quoteOutput.focus();
    quoteOutput.select();
    copyStatus.textContent = 'Não foi possível copiar automaticamente. A lista está selecionada para cópia manual.';
  }
}

async function loadProducts() {
  try {
    const useEmbeddedContent = location.protocol === 'file:'
      || document.documentElement.dataset.standalone === 'true';
    let content;
    if (useEmbeddedContent) {
      const embeddedContent = document.getElementById('site-data');
      if (!embeddedContent) throw new Error('Conteúdo embutido não encontrado.');
      content = JSON.parse(embeddedContent.textContent);
    } else {
      const response = await fetch(new URL('./data/site.json', document.baseURI));
      if (!response.ok) throw new Error(`Falha ao carregar materiais: ${response.status}`);
      content = await response.json();
    }
    if (!Array.isArray(content.products) || content.products.length === 0
      || !content.products.every(isProduct)
      || new Set(content.products.map(product => product.id)).size !== content.products.length
      || !Array.isArray(content.categories) || !content.categories.every(category =>
        typeof category.name === 'string' && typeof category.image === 'string' && category.image.startsWith('https://'))
      || !Array.isArray(content.offers)) {
      throw new Error('A lista de materiais está vazia ou inválida.');
    }
    products = content.products;
    catalogCategories = content.categories;
    offers = content.offers;
    const heroPhoto = document.querySelector('.hero-photo');
    heroPhoto.src = content.heroImage;
    for (const [selector, value] of [
      ['#store-address', content.contact.address],
      ['#store-phone', content.contact.phone],
      ['#store-landline', content.contact.landline],
      ['#store-email', content.contact.email],
    ]) {
      const link = document.querySelector(selector);
      link.textContent = value;
      link.href = selector === '#store-email'
        ? `mailto:${value}`
        : selector === '#store-address'
          ? `https://maps.google.com/?q=${encodeURIComponent(value)}`
          : `tel:${value}`;
    }
    renderCategories();
    renderOffers();
    renderProducts();
  } catch (error) {
    contentStatus.textContent = 'Não foi possível carregar o catálogo. Atualize a página para tentar novamente.';
    console.error('Não foi possível carregar o catálogo:', error);
  } finally {
    productGrid.setAttribute('aria-busy', 'false');
  }
}

quoteOutput = makeElement('textarea', 'quote-output');
quoteOutput.readOnly = true;
quoteOutput.hidden = true;
quoteOutput.setAttribute('aria-label', 'Lista de orçamento para cópia manual');
document.querySelector('.quote-card-footer').append(quoteOutput);
searchInput.addEventListener('input', renderProducts);
copyButton.addEventListener('click', copyQuote);
loadProducts();
