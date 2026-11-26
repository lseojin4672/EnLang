'use strict';

const Learning = (() => {
  const key = 'enlang.progress.v1';
  let memory = {};

  let storageAvailable = true;

  function read() {
    if (!storageAvailable) return memory;
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      memory = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    } catch {}
    return memory;
  }

  function progress(lessons) {
    const saved = read();
    const completed = lessons.filter(({ id }) =>
      typeof saved[id] === 'string' && Number.isFinite(Date.parse(saved[id])));
    return {
      completed,
      xp: completed.reduce((total, lesson) => total + lesson.xp, 0),
      date: id => saved[id],
      status(index) {
        if (completed.includes(lessons[index])) return 'complete';
        if (index === 0 || completed.includes(lessons[index - 1])) return 'available';
        return 'locked';
      }
    };
  }

  function complete(lessons, index) {
    if (progress(lessons).status(index) !== 'available') return false;
    memory = { ...read(), [lessons[index].id]: new Date().toISOString() };
    try {
      localStorage.setItem(key, JSON.stringify(memory));
    } catch {
      storageAvailable = false;
    }
    return true;
  }

  const heartKey = 'enlang.hearts.v1';
  const heartMax = 5;
  const heartInterval = 10 * 60 * 1000;
  let heartMemory = { count: heartMax, next: null };

  function hearts(now = Date.now()) {
    let saved = heartMemory;
    if (storageAvailable) {
      try {
        const stored = JSON.parse(localStorage.getItem(heartKey));
        if (Number.isInteger(stored?.count) && stored.count >= 0 && stored.count < heartMax
            && Number.isFinite(stored.next) && stored.next > 0) saved = stored;
        else saved = { count: heartMax, next: null };
      } catch {}
    }
    if (saved.count === heartMax || now < saved.next) return saved;
    const recovered = 1 + Math.floor((now - saved.next) / heartInterval);
    const count = Math.min(heartMax, saved.count + recovered);
    return { count, next: count === heartMax ? null : saved.next + recovered * heartInterval };
  }

  function spendHeart(now = Date.now()) {
    const current = hearts(now);
    if (!current.count) return current;
    heartMemory = { count: current.count - 1, next: current.next ?? now + heartInterval };
    if (storageAvailable) {
      try {
        localStorage.setItem(heartKey, JSON.stringify(heartMemory));
      } catch {
        storageAvailable = false;
      }
    }
    return heartMemory;
  }

  return { progress, complete, hearts, spendHeart, heartMax };
})();
