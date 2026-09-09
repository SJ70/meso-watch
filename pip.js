(() => {
  const pipButton = document.getElementById("pipButton");
  const supportsPip = "documentPictureInPicture" in window;
  let pipWindow = null;
  let pipTimeElement = null;
  let pipShortcutElement = null;
  let pipPauseButton = null;
  let pipPlayButton = null;
  let shortcutLabel = "";
  let shortcutConfig = null;

  function draw(time) {
    if (pipTimeElement) pipTimeElement.textContent = time;
  }

  function setRunning(isRunning) {
    if (!pipPauseButton || !pipPlayButton) return;
    pipPauseButton.hidden = !isRunning;
    pipPlayButton.hidden = isRunning;
  }

  function setShortcut(nextShortcutLabel, nextShortcutConfig) {
    shortcutLabel = nextShortcutLabel;
    shortcutConfig = nextShortcutConfig;
    if (pipShortcutElement) pipShortcutElement.textContent = `재시작: ${shortcutLabel}`;
  }

  function matchesShortcut(event) {
    return shortcutConfig
      && event.key.toLowerCase() === shortcutConfig.key
      && event.ctrlKey === shortcutConfig.ctrlKey
      && event.altKey === shortcutConfig.altKey
      && event.shiftKey === shortcutConfig.shiftKey
      && event.metaKey === shortcutConfig.metaKey;
  }

  async function toggle() {
    if (!supportsPip) {
      pipButton.textContent = "PIP 미지원 브라우저";
      return null;
    }

    if (pipWindow) {
      pipWindow.close();
      return false;
    }

    try {
      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 240
      });

      const paletteLink = pipWindow.document.createElement("link");
      paletteLink.rel = "stylesheet";
      paletteLink.href = new URL("color.css", window.location.href).href;
      pipWindow.document.head.appendChild(paletteLink);

      const styleLink = pipWindow.document.createElement("link");
      styleLink.rel = "stylesheet";
      styleLink.href = new URL("pip.css", window.location.href).href;
      pipWindow.document.head.appendChild(styleLink);
      pipWindow.document.title = "메소워치";
      pipWindow.document.body.innerHTML = `
        <main class="pip-surface">
          <p class="pip-label">메소워치</p>
          <p class="pip-time" id="pipTime">00:00</p>
          <p class="pip-shortcut" id="pipShortcut"></p>
          <div class="pip-controls" role="group" aria-label="타이머 제어">
            <button class="pip-control" id="pipPause" type="button" aria-label="일시정지" title="일시정지"><i data-lucide="pause"></i></button>
            <button class="pip-control" id="pipPlay" type="button" aria-label="재생" title="재생"><i data-lucide="play"></i></button>
            <button class="pip-control" id="pipStop" type="button" aria-label="정지" title="정지"><i data-lucide="square"></i></button>
            <button class="pip-control" id="pipRestart" type="button" aria-label="재시작" title="재시작"><i data-lucide="rotate-ccw"></i></button>
          </div>
        </main>`;

      pipTimeElement = pipWindow.document.getElementById("pipTime");
      pipShortcutElement = pipWindow.document.getElementById("pipShortcut");
      setShortcut(shortcutLabel, shortcutConfig);
      pipPauseButton = pipWindow.document.getElementById("pipPause");
      pipPlayButton = pipWindow.document.getElementById("pipPlay");
      const iconScript = pipWindow.document.createElement("script");
      iconScript.src = "https://unpkg.com/lucide@latest";
      iconScript.onload = () => pipWindow.lucide.createIcons();
      pipWindow.document.head.appendChild(iconScript);
      pipPauseButton.addEventListener("click", () => {
        window.dispatchEvent(new Event("pipstop"));
      });
      pipPlayButton.addEventListener("click", () => {
        window.dispatchEvent(new Event("pipplay"));
      });
      pipWindow.document.getElementById("pipStop").addEventListener("click", () => {
        window.dispatchEvent(new Event("pipreset"));
      });
      pipWindow.document.getElementById("pipRestart").addEventListener("click", () => {
        window.dispatchEvent(new Event("piprestart"));
      });
      pipWindow.addEventListener("keydown", (event) => {
        if (!event.repeat && matchesShortcut(event)) {
          event.preventDefault();
          window.dispatchEvent(new Event("piprestart"));
        }
      });
      pipButton.textContent = "종료하기";
      pipWindow.addEventListener("pagehide", closePip);
      return true;
    } catch (error) {
      closePip();
      pipButton.textContent = "PIP 실행 실패";
      return null;
    }
  }

  function closePip() {
    pipWindow = null;
    pipTimeElement = null;
    pipButton.textContent = "시작하기";
    pipShortcutElement = null;
    pipPauseButton = null;
    pipPlayButton = null;
    window.dispatchEvent(new Event("pipclosed"));
  }

  window.pipController = { draw, setRunning, setShortcut, toggle };
})();
