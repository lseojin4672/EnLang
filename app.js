'use strict';

const find = id => document.getElementById(id);
const path = find('path');
const dialog = find('dialog');
const dialogBody = find('dialog-body');
const nav = [...document.querySelectorAll('nav button')];
const labels = { available: '학습 가능', locked: '잠김', complete: '완료' };
const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, onClick) {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function openDialog(title, ...children) {
  find('dialog-title').textContent = title;
  dialogBody.replaceChildren(...children);
  if (!dialog.open) dialog.showModal();
}

function start({ units, adventure = [] }, layout) {
  const allLessons = units.flatMap(unit => unit.lessons);
  let unitIndex = 0;
  let page = 'learn';
  let routeMessage = '';
  const pages = ['learn', 'units', 'review', 'history'];
  const unitHref = unit => '#/unit/' + unit.number;
  const canEnter = (index, progress) => units.slice(0, index)
    .every(unit => unit.lessons.every(lesson => progress.completed.includes(lesson)));

  function showLesson(index) {
    const { lessons, number } = units[unitIndex];
    const lesson = lessons[index];
    const state = Learning.progress(lessons).status(index);
    if (state === 'locked') {
      openDialog(lesson.title, element('p', '', '‘' + lessons[index - 1].title + '’ 레슨을 먼저 완료해 주세요.'));
      return;
    }
    const prompt = element('p', '', lesson.question);
    const feedback = element('p');
    feedback.setAttribute('role', 'status');
    let selected = -1;
    const check = button('정답 확인', 'action', () => {
      if (selected !== lesson.answer) {
        feedback.textContent = '다시 한 번 골라 보세요.';
        return;
      }
      const earned = Learning.complete(lessons, index);
      feedback.textContent = earned ? '정답이에요! +' + lesson.xp + ' XP' : '정답이에요!';
      options.forEach(option => { option.disabled = true; });
      check.hidden = true;
      const done = button('완료', 'action', () => dialog.close());
      dialogBody.append(done);
      done.focus();
      if (earned) render();
    });
    check.disabled = true;
    const options = lesson.options.map((choice, choiceIndex) => {
      const option = button(choice, 'option', () => {
        selected = choiceIndex;
        options.forEach((item, i) => item.setAttribute('aria-pressed', String(i === selected)));
        feedback.textContent = '';
        check.disabled = false;
      });
      option.lang = number === 1 ? 'en' : 'ko';
      option.setAttribute('aria-pressed', 'false');
      return option;
    });
    openDialog(lesson.title, prompt, ...options, check, feedback);
  }

  let selectedRegion = 0;
  const adventureMap = find('adventure-map');
  const targets = adventureMap?.querySelector('.zone-targets');
  const regions = targets ? adventure.map((region, index) => {
    const shape = adventureMap.querySelector('#unit-' + region.unit);
    const target = document.createElementNS(targets.namespaceURI, 'path');
    target.setAttribute('d', shape.getAttribute('d'));
    target.setAttribute('class', 'zone-target');
    target.setAttribute('role', 'button');
    target.setAttribute('tabindex', '0');
    target.addEventListener('click', () => {
      selectedRegion = index;
      renderAdventure();
    });
    target.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      target.dispatchEvent(new Event('click'));
    });
    targets.append(target);
    const lock = element('span', 'lock region-lock');
    lock.setAttribute('aria-hidden', 'true');
    lock.style.left = region.x + '%';
    lock.style.top = region.y + '%';
    adventureMap.append(lock);
    return { target, lock, mask: adventureMap.querySelector('[data-zone-mask="' + region.unit + '"]') };
  }) : [];

  function renderAdventure() {
    if (!regions.length) return;
    const progress = Learning.progress(allLessons);
    const currentUnit = units.filter((unit, index) => canEnter(index, progress)).at(-1).number;
    const openCount = adventure.filter(region => region.unit <= currentUnit).length;
    find('adventure-progress').textContent = openCount + ' / ' + adventure.length + ' 구역 해금';
    regions.forEach(({ target, lock, mask }, index) => {
      const region = adventure[index];
      const locked = region.unit > currentUnit;
      target.setAttribute('aria-label', locked ? '유닛 ' + region.unit + ', 잠김' : region.places.join(', ') + ', 탐험 가능');
      target.setAttribute('aria-pressed', String(index === selectedRegion));
      lock.hidden = !locked;
      mask.style.display = locked ? '' : 'none';
    });
    const region = adventure[selectedRegion];
    const locked = region.unit > currentUnit;
    find('region-title').textContent = locked ? '유닛 ' + region.unit : region.places.join(', ');
    find('region-description').textContent = locked
      ? '유닛 ' + region.unit + '에 도달하면 열려요.'
      : region.description;
    find('region-learn').hidden = !locked;
  }

  find('region-learn')?.addEventListener('click', () => {
    location.hash = unitHref(units[unitIndex]);
  });

  function renderUnits(progress) {
    const list = find('unit-list');
    list.replaceChildren(...units.map((unit, index) => {
      const row = element('li');
      const open = canEnter(index, progress);
      const card = element(open ? 'a' : 'div', open ? 'unit-card' : 'unit-card unit-card-locked');
      const count = unit.lessons.filter(lesson => progress.completed.includes(lesson)).length;
      card.append(element('strong', '', '유닛 ' + unit.number + ' · ' + unit.title));
      if (open) {
        card.href = unitHref(unit);
        if (index === unitIndex) card.setAttribute('aria-current', 'page');
        card.append(element('small', '', count + ' / ' + unit.lessons.length + ' 완료'));
      } else {
        card.append(element('small', '', '유닛 ' + units[index - 1].number + '을 완료하면 열려요.'));
        const lock = element('span', 'lock');
        lock.setAttribute('aria-hidden', 'true');
        card.append(lock);
      }
      row.append(card);
      return row;
    }));
    find('unit-route-message').hidden = !routeMessage;
    find('unit-route-message').textContent = routeMessage;
  }

  function render() {
    const unit = units[unitIndex];
    const { lessons } = unit;
    const progress = Learning.progress(lessons);
    const total = Learning.progress(allLessons);
    const next = units[unitIndex + 1];
    const nextOpen = Boolean(next && canEnter(unitIndex + 1, total));
    find('learn-logo').href = unitHref(unit);
    find('unit').textContent = 'UNIT ' + unit.number;
    find('title').textContent = unit.title;
    find('description').textContent = unit.description;
    find('xp-value').textContent = total.xp + ' XP';
    find('count').textContent = progress.completed.length + ' / ' + lessons.length;
    find('progress').max = lessons.length;
    find('progress').value = progress.completed.length;
    find('next-unit').hidden = !next;
    find('next-lock').hidden = nextOpen;
    find('next').textContent = next ? '유닛 ' + next.number + ' · ' + next.title : '';
    find('next-status').textContent = nextOpen ? '다음 유닛이 열렸어요.' : '현재 유닛을 완료하면 열려요.';
    const nextLink = find('next-link');
    nextLink.hidden = !nextOpen;
    if (nextOpen) nextLink.href = unitHref(next);
    else nextLink.removeAttribute('href');
    if (page === 'units') renderUnits(total);
    const existing = [...path.querySelectorAll('.lesson-row')];
    lessons.forEach((lesson, index) => {
      const state = progress.status(index);
      let row = existing[index];
      if (!row) {
        row = element('li', 'lesson-row');
        const control = button(undefined, 'lesson', () => showLesson(index));
        const disc = element('span', 'disc');
        disc.setAttribute('aria-hidden', 'true');
        control.append(disc, element('span', 'lesson-label', lesson.title));
        row.append(control);
        path.append(row);
      }
      const sprite = LessonLayout.apply(row, layout, lesson.id, state);
      const control = row.firstElementChild;
      control.dataset.state = state;
      control.setAttribute('aria-label', lesson.title + ', ' + labels[state]);
      const disc = control.firstElementChild;
      const fallback = state === 'locked'
        ? element('span', 'lock')
        : element('span', '', state === 'complete' ? '✓' : String(index + 1));
      disc.replaceChildren(fallback);
      if (sprite) {
        const image = element('img', 'sprite');
        image.alt = '';
        image.addEventListener('load', () => fallback.replaceWith(image), { once: true });
        image.src = sprite;
      }
    });
    LessonLayout.connect(path);
    renderAdventure();
    find('history-list').replaceChildren(...(total.completed.length
      ? [...total.completed].sort((a, b) => total.date(b.id).localeCompare(total.date(a.id))).map(lesson =>
        element('div', 'record', lesson.title + ' · +' + lesson.xp + ' XP · ' + dateFormat.format(new Date(total.date(lesson.id)))))
      : [element('p', '', '아직 완료한 레슨이 없어요.')]));
  }

  function renderRoute() {
    const hash = location.hash;
    const requested = /^#\/unit\/(\d+)$/.exec(hash || '#/unit/1');
    const index = requested ? units.findIndex(unit => unit.number === Number(requested[1])) : -1;
    routeMessage = '';
    if (requested && index >= 0 && canEnter(index, Learning.progress(allLessons))) {
      if (index !== unitIndex) path.replaceChildren();
      unitIndex = index;
      page = 'learn';
    } else if (requested || hash === '#/units') {
      page = 'units';
      if (requested) {
        routeMessage = index < 0 ? '해당 유닛을 찾을 수 없어요.' : '앞 유닛을 먼저 완료해 주세요.';
        history.replaceState(null, '', '#/units');
      }
    } else {
      const tab = hash.slice(2);
      page = tab === 'review' || tab === 'history' ? tab : 'learn';
    }
    if (dialog.open) dialog.close();
    pages.forEach(id => { find(id).hidden = id !== page; });
    nav.forEach(control => {
      if (control.dataset.page === (page === 'units' ? 'learn' : page)) control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
    });
    render();
    window.scrollTo(0, 0);
  }

  nav.forEach(control => control.addEventListener('click', () => {
    location.hash = control.dataset.page === 'learn' ? unitHref(units[unitIndex]) : '#/' + control.dataset.page;
  }));
  window.addEventListener('hashchange', renderRoute);
  find('settings').addEventListener('click', () => openDialog('설정',
    element('p', '', '학습 언어 · 제주어'),
    element('p', '', '학습 기록은 이 브라우저에 저장돼요.')));
  window.addEventListener('storage', render);
  new ResizeObserver(() => LessonLayout.connect(path)).observe(path);
  renderRoute();
}

async function getData(name) {
  const embedded = find(name + '-data');
  if (embedded) return JSON.parse(embedded.textContent);
  const response = await fetch('./' + name + '.json?v=unit-review');
  if (!response.ok) throw new Error(name);
  return response.json();
}

Promise.all([getData('content'), getData('layout')])
  .then(([content, layout]) => start(content, layout))
  .catch(() => {
    find('learn').hidden = true;
    find('error').hidden = false;
    find('error').textContent = '학습 데이터를 열 수 없어요. 웹에서 다시 열거나 동봉된 미리보기 HTML을 사용해 주세요.';
    nav.forEach(control => { control.disabled = true; });
  });
