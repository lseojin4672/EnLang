'use strict';

const LessonLayout = (() => {
  const limit = (value, fallback, min, max) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

  function apply(row, layout, id, state) {
    const spec = layout.lessons?.[id] ?? {};
    row.style.setProperty('--x', limit(spec.x, 50, 0, 100) + '%');
    row.style.setProperty('--gap', limit(spec.gap, 4, 1, 50) + 'cqi');
    row.style.setProperty('--diameter', limit(spec.size, 19, 1, 100) + 'cqi');
    const sprite = typeof spec.sprite === 'string' ? spec.sprite : spec.sprite?.[state];
    return typeof sprite === 'string' && sprite.trim() ? sprite.trim() : null;
  }

  function connect(path) {
    path.querySelectorAll('.connector').forEach(line => line.remove());
    const discs = [...path.querySelectorAll('.disc')];
    if (!path.clientWidth) return;
    const area = path.getBoundingClientRect();
    let previous;
    for (const disc of discs) {
      const rect = disc.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2 - area.left,
        y: rect.top + rect.height / 2 - area.top,
        radius: rect.width / 2
      };
      if (previous) {
        const line = document.createElement('li');
        line.className = 'connector';
        line.setAttribute('aria-hidden', 'true');
        const dx = center.x - previous.x;
        const dy = center.y - previous.y;
        const distance = Math.hypot(dx, dy);
        line.style.left = previous.x + dx * previous.radius / distance + 'px';
        line.style.top = previous.y + dy * previous.radius / distance - 1 + 'px';
        line.style.width = Math.max(0, distance - previous.radius - center.radius) + 'px';
        line.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
        path.prepend(line);
      }
      previous = center;
    }
  }

  return { apply, connect };
})();
