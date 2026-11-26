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

function start({ unit, adventure = [] }, layout) {
  const { lessons } = unit;
  find('unit').textContent = 'UNIT ' + unit.number;
  find('title').textContent = unit.title;
  find('description').textContent = unit.description;
  find('next').textContent = unit.nextTitle;

  function showLesson(index) {
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
      option.lang = 'en';
      option.setAttribute('aria-pressed', 'false');
      return option;
    });
    openDialog(lesson.title, prompt, ...options, check, feedback);
  }

  let selectedRegion = 0;
  const adventureMap = find('adventure-map');
  const regionPins = adventureMap ? adventure.map((region, index) => {
    const pin = button(undefined, 'region-pin', () => {
      selectedRegion = index;
      renderAdventure();
    });
    const lock = element('span', 'lock');
    lock.setAttribute('aria-hidden', 'true');
    pin.append(lock, element('span', 'region-name', region.places.join(', ')));
    pin.style.left = region.x + '%';
    pin.style.top = region.y + '%';
    adventureMap.append(pin);
    return pin;
  }) : [];

  function renderAdventure() {
    if (!regionPins.length) return;
    const currentUnit = unit.number;
    const openCount = adventure.filter(region => region.unit <= currentUnit).length;
    find('adventure-progress').textContent = openCount + ' / ' + adventure.length + ' 구역 해금';
    regionPins.forEach((pin, index) => {
      const region = adventure[index];
      const locked = region.unit > currentUnit;
      pin.dataset.locked = String(locked);
      pin.setAttribute('aria-label', locked ? '유닛 ' + region.unit + ', 잠김' : region.places.join(', ') + ', 탐험 가능');
      pin.setAttribute('aria-pressed', String(index === selectedRegion));
      pin.firstElementChild.hidden = !locked;
      pin.lastElementChild.hidden = locked;
      const mask = adventureMap.querySelector('[data-zone-mask="' + region.unit + '"]');
      if (mask) mask.style.display = locked ? '' : 'none';
    });
    const region = adventure[selectedRegion];
    const locked = region.unit > currentUnit;
    find('region-title').textContent = locked ? '유닛 ' + region.unit : region.places.join(', ');
    find('region-description').textContent = locked
      ? '유닛 ' + region.unit + '에 도달하면 열려요.'
      : region.landmark + ' · ' + region.description;
    find('region-learn').hidden = !locked;
  }

  find('region-learn')?.addEventListener('click', () => {
    nav.find(control => control.dataset.page === 'learn').click();
  });

  function render() {
    const progress = Learning.progress(lessons);
    find('xp-value').textContent = progress.xp + ' XP';
    find('count').textContent = progress.completed.length + ' / ' + lessons.length;
    find('progress').max = lessons.length;
    find('progress').value = progress.completed.length;
    find('next-status').textContent = progress.completed.length === lessons.length
      ? '다음 유닛은 준비 중이에요.'
      : '현재 유닛을 완료하면 열려요.';
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
    find('history-list').replaceChildren(...(progress.completed.length
      ? [...progress.completed].sort((a, b) => progress.date(b.id).localeCompare(progress.date(a.id))).map(lesson =>
        element('div', 'record', lesson.title + ' · +' + lesson.xp + ' XP · ' + dateFormat.format(new Date(progress.date(lesson.id)))))
      : [element('p', '', '아직 완료한 레슨이 없어요.')]));
  }

  nav.forEach(control => control.addEventListener('click', () => {
    nav.forEach(item => {
      find(item.dataset.page).hidden = item !== control;
      if (item === control) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    if (control.dataset.page === 'learn') LessonLayout.connect(path);
    window.scrollTo(0, 0);
  }));
  find('settings').addEventListener('click', () => openDialog('설정',
    element('p', '', '학습 언어 · 제주어'),
    element('p', '', '학습 기록은 이 브라우저에 저장돼요.')));
  window.addEventListener('storage', render);
  new ResizeObserver(() => LessonLayout.connect(path)).observe(path);
  render();
}

async function getData(name) {
  const embedded = find(name + '-data');
  if (embedded) return JSON.parse(embedded.textContent);
  const response = await fetch('./' + name + '.json' + (name === 'content' ? '?v=jeju-places' : ''));
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
