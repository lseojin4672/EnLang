'use strict';

const find = id => document.getElementById(id);
const path = find('path');
const dialog = find('dialog');
const dialogBody = find('dialog-body');
const lessonScreen = find('lesson-screen');
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

const ordinals = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'];
const yardName = number => (ordinals[number - 1] ?? number + '번째') + ' 마당';
const stepName = index => index === 0 ? '첫걸음' : (ordinals[index] ?? (index + 1) + '번째') + ' 걸음';

function start({ units, adventure = [] }, layout) {
  const allLessons = units.flatMap(unit => unit.lessons);
  let unitIndex = 0;
  let page = 'learn';
  let routeMessage = '';
  const pages = ['learn', 'units', 'review', 'history'];
  const unitHref = unit => '#/unit/' + unit.number;
  const canEnter = (index, progress) => units.slice(0, index)
    .every(unit => unit.lessons.every(lesson => progress.completed.includes(lesson)));

  let updateLessonHearts;
  const heartButton = find('hearts');

  function refillText(heartState) {
    if (heartState.next === null) return '하트가 모두 찼어요.';
    const seconds = Math.max(0, Math.ceil((heartState.next - Date.now()) / 1000));
    return '다음 하트까지 ' + Math.floor(seconds / 60) + '분 ' + String(seconds % 60).padStart(2, '0') + '초';
  }

  function refreshHearts() {
    const heartState = Learning.hearts();
    const count = heartState.count + ' / ' + Learning.heartMax;
    const value = find('heart-value');
    if (value.textContent !== count) {
      value.textContent = count;
      heartButton.setAttribute('aria-label', '하트 ' + count);
    }
    const lessonValue = find('lesson-heart-value');
    if (lessonScreen.open && lessonValue.textContent !== count) lessonValue.textContent = count;
    const timer = dialogBody.querySelector('[data-heart-timer]');
    if (dialog.open && timer) timer.textContent = refillText(heartState);
    if (dialog.open || lessonScreen.open) updateLessonHearts?.(heartState);
  }

  heartButton.addEventListener('click', () => {
    updateLessonHearts = null;
    const timer = element('p', '', refillText(Learning.hearts()));
    timer.dataset.heartTimer = '';
    openDialog('하트', element('p', '', '오답마다 하트가 하나 줄어요. 10분마다 하나씩, 최대 5개까지 채워져요.'), timer);
  });

  lessonScreen.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (!event.repeat) find('lesson-submit').click();
  });

  function buildQuestionResponse(question, attempt, refresh) {
    const group = element('div', 'question-response');
    if (question.cloze) group.append(element('p', 'question-context', question.cloze));
    if (question.speaker) group.append(element('p', 'question-context', question.speaker + ' · “' + question.line + '”'));

    if (question.type === 'match') {
      const grid = element('div', 'match-grid');
      const leftColumn = element('div', 'match-column');
      const rightColumn = element('div', 'match-column');
      const labels = element('p', 'question-instruction');
      labels.setAttribute('role', 'status');
      const left = question.left.map((word, index) => button(word, 'option', () => {
        attempt.matchLeft = index;
        refresh();
      }));
      const right = question.right.map((word, index) => button(word, 'option', () => {
        const previous = attempt.choice.indexOf(index);
        if (previous >= 0) attempt.choice[previous] = -1;
        attempt.choice[attempt.matchLeft] = index;
        attempt.matchLeft = -1;
        refresh();
      }));
      leftColumn.append(...left);
      rightColumn.append(...right);
      grid.append(leftColumn, rightColumn);
      group.append(labels, grid);
      return { group, update(disabled) {
        const instruction = attempt.matchLeft >= 0
          ? '“' + question.left[attempt.matchLeft] + '”의 뜻을 골라 보세요.'
          : '왼쪽 낱말을 누르고 오른쪽에서 뜻을 고르세요.';
        if (labels.textContent !== instruction) labels.textContent = instruction;
        left.forEach((control, i) => {
          const pair = attempt.choice[i];
          control.disabled = disabled;
          control.setAttribute('aria-pressed', String(i === attempt.matchLeft));
          control.textContent = (i + 1) + '. ' + question.left[i];
          control.setAttribute('aria-label', question.left[i] + (pair < 0 ? '' : ' · ' + question.right[pair]));
        });
        right.forEach((control, i) => {
          const pair = attempt.choice.indexOf(i);
          control.disabled = disabled || attempt.matchLeft < 0;
          control.textContent = question.right[i] + (pair < 0 ? '' : ' · ' + (pair + 1));
        });
      }};
    }

    if (question.type === 'order') {
      const sentence = element('p', 'question-context');
      sentence.setAttribute('role', 'status');
      const tray = element('div', 'word-tray');
      const words = question.options.map((word, index) => button(word, 'option', () => {
        attempt.choice.push(index);
        refresh();
      }));
      const undo = button('마지막 조각 빼기', 'option', () => {
        attempt.choice.pop();
        refresh();
      });
      tray.append(...words);
      group.append(sentence, tray, undo);
      return { group, update(disabled) {
        const text = attempt.choice.map(i => question.options[i]).join(' ') || '고른 말 조각이 여기에 나와요.';
        if (sentence.textContent !== text) sentence.textContent = text;
        words.forEach((control, i) => { control.disabled = disabled || attempt.choice.includes(i); });
        undo.disabled = disabled || !attempt.choice.length;
      }};
    }

    const choices = question.options.map((choice, index) => button(choice, 'option', () => {
      attempt.choice = index;
      refresh();
    }));
    group.append(...choices);
    return { group, update(disabled) {
      choices.forEach((choice, index) => {
        choice.disabled = disabled;
        choice.setAttribute('aria-pressed', String(index === attempt.choice));
      });
    }};
  }

  function showFullLesson(lessons, index) {
    const lesson = lessons[index];
    const questions = lesson.questions;
    const makeAttempt = questionIndex => {
      const question = questions[questionIndex];
      const choice = question.type === 'match' ? question.left.map(() => -1) : question.type === 'order' ? [] : -1;
      return { questionIndex, choice, matchLeft: -1, correct: null, hint: false };
    };
    const ready = attempt => Array.isArray(attempt.choice)
      ? attempt.choice.length === questions[attempt.questionIndex].answer.length && attempt.choice.every(choice => choice >= 0)
      : attempt.choice >= 0;
    const attempts = questions.map((question, questionIndex) => makeAttempt(questionIndex));
    const startedAt = Date.now();
    const timer = find('lesson-elapsed');
    const elapsed = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    };
    const body = find('lesson-screen-body');
    const step = find('lesson-screen-step');
    const wait = element('p', 'lesson-screen-wait');
    let current = 0;
    let finished = false;
    let response;
    const back = button('뒤로', 'option', () => move(-1));
    const forward = button('앞으로', 'option', () => move(1));
    const hint = button('힌트', 'option', () => {
      attempts[current].hint = !attempts[current].hint;
      paint();
    });
    const submit = button('제출', 'action', () => {
      if (finished) {
        lessonScreen.close();
        return;
      }
      const answer = attempts[current];
      if (answer.correct !== null) {
        if (current < attempts.length - 1) move(1);
        return;
      }
      if (!ready(answer) || !Learning.hearts().count) return;
      const expected = questions[answer.questionIndex].answer;
      answer.correct = Array.isArray(expected)
        ? expected.every((choice, index) => choice === answer.choice[index])
        : answer.choice === expected;
      if (!answer.correct) {
        Learning.spendHeart();
        attempts.push(makeAttempt(answer.questionIndex));
      } else if (current === attempts.length - 1) {
        finished = true;
        const duration = elapsed();
        timer.textContent = duration;
        const firstCorrect = attempts.slice(0, questions.length).filter(item => item.correct).length;
        const accuracy = Math.round(firstCorrect / questions.length * 100);
        const earned = Learning.complete(lessons, index);
        body.replaceChildren(
          element('h3', '', '첫걸음을 마쳤어요!'),
          element('p', '', '걸린 시간 ' + duration),
          element('p', '', '첫 시도 정답률 ' + accuracy + '% (' + firstCorrect + ' / ' + questions.length + ')'),
          element('p', '', earned ? '경험치 +' + lesson.xp : '모든 문제를 풀었어요.')
        );
        step.textContent = questions.length + ' / ' + questions.length;
        submit.textContent = '완료';
        refreshHearts();
        if (earned) render();
        submit.focus();
        return;
      }
      paint();
      forward.focus();
    });

    function move(offset) {
      current += offset;
      paint();
      body.querySelector('h3').focus();
    }

    function paint() {
      const answer = attempts[current];
      const question = questions[answer.questionIndex];
      step.textContent = current < questions.length
        ? '문제 ' + (answer.questionIndex + 1) + ' / ' + questions.length
        : (answer.questionIndex + 1) + '번 (재시도)';
      const heading = element('h3', '', question.question);
      heading.tabIndex = -1;
      response = buildQuestionResponse(question, answer, refreshHearts);
      const hintText = element('p', 'lesson-screen-hint', question.hint);
      hintText.id = 'lesson-hint-text';
      hintText.hidden = !answer.hint;
      hint.setAttribute('aria-controls', hintText.id);
      hint.setAttribute('aria-expanded', String(answer.hint));
      const feedback = element('p', '', answer.correct === null ? '' : answer.correct
        ? '정답이에요! 앞으로나 제출을 누르면 다음 문제로 넘어가요.'
        : '하트가 하나 줄었어요. 이 문제는 뒤에서 다시 풀어요.');
      feedback.setAttribute('role', 'status');
      body.replaceChildren(heading, response.group, hintText, feedback, wait);
      refreshHearts();
    }

    updateLessonHearts = heartState => {
      if (!lessonScreen.open) return;
      const answer = attempts[current];
      if (!finished) {
        const duration = elapsed();
        if (timer.textContent !== duration) timer.textContent = duration;
      }
      const empty = !heartState.count;
      const graded = answer.correct !== null;
      back.disabled = finished || current === 0;
      forward.disabled = finished || !graded || current === attempts.length - 1;
      hint.disabled = finished;
      submit.disabled = !finished && (graded ? forward.disabled : empty || !ready(answer));
      response.update(empty || graded);
      wait.hidden = finished || !empty;
      if (empty) wait.textContent = '하트를 채우면 다시 풀 수 있어요. ' + refillText(heartState);
    };
    find('lesson-screen-title').textContent = lesson.title;
    for (const [control, asset] of [[back, 'back.svg'], [forward, 'next.svg'], [hint, 'info.svg']]) {
      const icon = element('img');
      icon.src = './assets/' + asset;
      icon.alt = '';
      icon.width = icon.height = 24;
      const label = element('span', '', control.textContent);
      control.classList.add('lesson-icon-action');
      control.replaceChildren(icon, label);
    }
    submit.id = 'lesson-submit';
    find('lesson-screen-actions').replaceChildren(back, forward, hint, submit);
    lessonScreen.showModal();
    paint();
  }

  function showLesson(index) {
    updateLessonHearts = null;
    const { lessons, number } = units[unitIndex];
    const lesson = lessons[index];
    const state = Learning.progress(lessons).status(index);
    if (state === 'locked') {
      openDialog(lesson.title, element('p', '', '‘' + lessons[index - 1].title + '’ 걸음을 먼저 완료해 주세요.'));
      return;
    }
    if (lesson.questions?.length) {
      showFullLesson(lessons, index);
      return;
    }
    const prompt = element('p', '', lesson.question);
    const feedback = element('p');
    feedback.setAttribute('role', 'status');
    const wait = element('p');
    let selected = -1;
    const check = button('정답 확인', 'action', () => {
      if (selected < 0 || !Learning.hearts().count) {
        refreshHearts();
        return;
      }
      if (selected !== lesson.answer) {
        Learning.spendHeart();
        selected = -1;
        options.forEach(option => option.setAttribute('aria-pressed', 'false'));
        feedback.textContent = '하트가 하나 줄었어요. 다시 한 번 골라 보세요.';
        refreshHearts();
        return;
      }
      updateLessonHearts = null;
      const earned = Learning.complete(lessons, index);
      feedback.textContent = earned ? '정답이에요! 경험치 +' + lesson.xp : '정답이에요!';
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
        refreshHearts();
      });
      option.lang = number === 1 ? 'en' : 'ko';
      option.setAttribute('aria-pressed', 'false');
      return option;
    });
    updateLessonHearts = heartState => {
      if (!dialogBody.contains(wait)) return;
      const empty = heartState.count === 0;
      check.disabled = empty || selected < 0;
      options.forEach(option => { option.disabled = empty; });
      wait.hidden = !empty;
      if (empty) wait.textContent = '하트를 채우면 다시 풀 수 있어요. ' + refillText(heartState);
    };
    openDialog(lesson.title, prompt, ...options, check, feedback, wait);
    refreshHearts();
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
    find('adventure-progress').textContent = openCount + ' / ' + adventure.length + ' 구역 열림';
    regions.forEach(({ target, lock, mask }, index) => {
      const region = adventure[index];
      const locked = region.unit > currentUnit;
      target.setAttribute('aria-label', locked ? yardName(region.unit) + ', 잠김' : region.places.join(', ') + ', 탐험 가능');
      target.setAttribute('aria-pressed', String(index === selectedRegion));
      lock.hidden = !locked;
      mask.style.display = locked ? '' : 'none';
    });
    const region = adventure[selectedRegion];
    const locked = region.unit > currentUnit;
    find('region-title').textContent = locked ? yardName(region.unit) : region.places.join(', ');
    find('region-description').textContent = locked
      ? yardName(region.unit) + '이 열리면 탐험할 수 있어요.'
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
      const info = element('div', 'unit-card-info');
      const meter = element('progress');
      meter.max = unit.lessons.length;
      meter.value = count;
      meter.setAttribute('aria-label', yardName(unit.number) + ' 진행도');
      info.append(
        element('span', 'unit-card-number', yardName(unit.number)),
        element('h2', 'unit-card-title', unit.title),
        meter,
        element('small', 'unit-card-count', count + ' / ' + unit.lessons.length + ' 완료')
      );
      if (open) {
        card.href = unitHref(unit);
        if (index === unitIndex) card.setAttribute('aria-current', 'page');
        info.append(element('span', 'unit-card-action', '계속하기'));
      } else {
        info.append(element('small', 'unit-card-requirement', yardName(units[index - 1].number) + '을 완료하면 열려요.'));
        const status = element('span', 'unit-card-action');
        const lock = element('span', 'lock');
        lock.setAttribute('aria-hidden', 'true');
        status.append(lock, '잠김');
        info.append(status);
      }
      const character = element('div', 'unit-card-character');
      character.setAttribute('aria-hidden', 'true');
      if (unit.character) {
        const image = element('img');
        image.src = unit.character;
        image.alt = '';
        character.append(image);
      } else {
        character.textContent = '🐤';
      }
      card.append(info, character);
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
    find('unit').textContent = yardName(unit.number);
    find('title').textContent = unit.title;
    find('description').textContent = unit.description;
    find('xp-value').textContent = '경험치 ' + total.xp;
    find('count').textContent = progress.completed.length + ' / ' + lessons.length;
    find('progress').max = lessons.length;
    find('progress').value = progress.completed.length;
    find('next-unit').hidden = !next;
    find('next-lock').hidden = nextOpen;
    find('next').textContent = next ? yardName(next.number) + ' · ' + next.title : '';
    find('next-status').textContent = nextOpen ? '다음 마당이 열렸어요.' : '이 마당의 모든 걸음을 마치면 열려요.';
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
      control.setAttribute('aria-label', stepName(index) + ', ' + lesson.title + ', ' + labels[state]);
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
        element('div', 'record', lesson.title + ' · 경험치 +' + lesson.xp + ' · ' + dateFormat.format(new Date(total.date(lesson.id)))))
      : [element('p', '', '아직 완료한 걸음이 없어요.')]));
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
        routeMessage = index < 0 ? '해당 마당을 찾을 수 없어요.' : '앞 마당을 먼저 마쳐 주세요.';
        history.replaceState(null, '', '#/units');
      }
    } else {
      const tab = hash.slice(2);
      page = tab === 'review' || tab === 'history' ? tab : 'learn';
    }
    if (dialog.open) dialog.close();
    if (lessonScreen.open) lessonScreen.close();
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
  window.addEventListener('storage', () => { render(); refreshHearts(); });
  window.addEventListener('pageshow', refreshHearts);
  setInterval(refreshHearts, 1000);
  refreshHearts();
  new ResizeObserver(() => LessonLayout.connect(path)).observe(path);
  renderRoute();
}

async function getData(name) {
  const embedded = find(name + '-data');
  if (embedded) return JSON.parse(embedded.textContent);
  const response = await fetch('./' + name + '.json?v=question-types');
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
