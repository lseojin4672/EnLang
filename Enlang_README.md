# EnLang

EnLang is a mobile-first browser app for learning practical Jeju
language expressions through short quizzes, XP rewards, and an
interactive Jeju adventure map.

## What is EnLang?

EnLang helps learners practice Jeju language through short, quiz-based
lessons. Lessons are arranged in a zigzag progression, and learners can
track their progress as they complete activities.

-   **Learn:** Practice practical Jeju language expressions through
    multiple-choice quizzes.
-   **Earn XP:** Gain experience points by completing lessons.
-   **Explore:** Unlock regions of Jeju as you progress through the
    lessons.
-   **Track progress:** Completed lessons and learning history are saved
    in the browser.

## Tech Stack

  -----------------------------------------------------------------------
  Category                            Technology
  ----------------------------------- -----------------------------------
  Languages                           HTML, CSS, JavaScript, JSON

  Framework / runtime                 Static browser application; no
                                      framework or build step

  Browser APIs and features           Native Web Components APIs,
                                      `<dialog>`, `localStorage`,
                                      `ResizeObserver`, inline SVG

  Content and layout                  JSON-driven content and layout

  Deployment                          GitHub Pages-compatible static site
  -----------------------------------------------------------------------

## Project Structure

``` text
EnLang/
├── index.html       # App structure, lesson map, navigation, and Jeju SVG
├── app.js           # UI rendering, lesson interactions, navigation, and adventure state
├── learning.js      # Progress, XP, completion dates, and localStorage persistence
├── layout.js        # Lesson positioning and connector rendering
├── content.json     # Unit, lesson, and Jeju region content
├── layout.json      # Lesson positions and state-specific SVG sprites
├── style.css        # Responsive mobile layout and component styling
├── assets/          # Logos, lesson icons, navigation icons, and map imagery
└── EnLang.zip       # Downloadable snapshot of the web app
```

## How It Works

1.  `index.html` loads the JavaScript modules and stylesheet.
2.  `app.js` fetches `content.json` and `layout.json`.
3.  The app renders the lesson path, quiz dialogs, adventure map, and
    learning history.
4.  `layout.js` applies JSON-defined lesson positions and draws
    connectors between lesson nodes.
5.  `learning.js` manages lesson progress, XP, completion dates, and
    browser-based persistence.

## Getting Started

No dependencies or build tools are required.

### Run locally

``` bash
git clone https://github.com/lseojin4672/EnLang.git
cd EnLang
python3 -m http.server 4173
```

Then open <http://localhost:4173> in your browser.

A local HTTP server is recommended to ensure JSON files load reliably.
You can also open `index.html` directly, or deploy the repository using
GitHub Pages.

## Data Storage and Privacy

Learning progress and completion timestamps are stored locally in the
browser using `localStorage`, under the key:

``` text
enlang.progress.v1
```

The app does not require environment variables or external services.
