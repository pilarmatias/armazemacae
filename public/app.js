const themeButton = document.querySelector('.theme-toggle');
const themeKey = 'armazemacae-theme';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  themeButton.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
}

let savedTheme;
try {
  savedTheme = localStorage.getItem(themeKey);
} catch {
  // The page also works when the browser does not permit local storage.
}
const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
applyTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : preferredTheme);
themeButton.hidden = false;
themeButton.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  try {
    localStorage.setItem(themeKey, nextTheme);
  } catch {
    // Theme changes remain available for the current visit.
  }
});

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function isContentItem(item) {
  return item !== null && typeof item === 'object'
    && typeof item.title === 'string' && item.title.trim().length > 0
    && typeof item.description === 'string' && item.description.trim().length > 0;
}

async function loadContent() {
  const featureGrid = document.querySelector('#feature-grid');
  const stepList = document.querySelector('#step-list');
  const status = document.querySelector('#content-status');
  try {
    const embeddedContent = document.getElementById('site-data');
    const useEmbeddedContent = Boolean(embeddedContent)
      || location.protocol === 'file:'
      || document.documentElement.dataset.standalone === 'true';
    let content;
    if (useEmbeddedContent) {
      if (!embeddedContent) throw new Error('Embedded site content is missing');
      content = JSON.parse(embeddedContent.textContent);
    } else {
      const response = await fetch(new URL('./data/site.json', document.baseURI));
      if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
      content = await response.json();
    }
    if (!Array.isArray(content.features) || content.features.length === 0 || !content.features.every(isContentItem)
      || !Array.isArray(content.nextSteps) || content.nextSteps.length === 0 || !content.nextSteps.every(isContentItem)) {
      throw new Error('Invalid site content');
    }

    const cards = content.features.map((feature, index) => {
      const card = makeElement('article', 'feature-card');
      const top = makeElement('div', 'feature-top');
      top.append(makeElement('span', 'feature-number', String(index + 1).padStart(2, '0')));
      const symbol = makeElement('span', 'feature-symbol', typeof feature.symbol === 'string' ? feature.symbol : '+');
      symbol.setAttribute('aria-hidden', 'true');
      top.append(symbol);
      card.append(top, makeElement('h3', '', feature.title), makeElement('p', '', feature.description));
      return card;
    });

    const steps = content.nextSteps.map((step) => {
      const item = makeElement('li');
      const text = makeElement('div');
      text.append(makeElement('h3', '', step.title), makeElement('p', '', step.description));
      item.append(text);
      return item;
    });

    featureGrid.replaceChildren(...cards);
    stepList.replaceChildren(...steps);
    status.hidden = true;
  } catch (error) {
    status.textContent = 'Não foi possível carregar os detalhes do projeto. Atualize a página para tentar novamente.';
    console.error('Não foi possível carregar o conteúdo:', error);
  } finally {
    featureGrid.setAttribute('aria-busy', 'false');
    stepList.setAttribute('aria-busy', 'false');
  }
}

loadContent();
