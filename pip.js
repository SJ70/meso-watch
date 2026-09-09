(() => {
  const pipButton = document.getElementById("pipButton");
  const supportsPip = "documentPictureInPicture" in window;
  let pipWindow = null;
  let pipTimeElement = null;

  function draw(time) {
    if (pipTimeElement) pipTimeElement.textContent = time;
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
        height: 200
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
        </main>`;

      pipTimeElement = pipWindow.document.getElementById("pipTime");
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
    window.dispatchEvent(new Event("pipclosed"));
  }

  window.pipController = { draw, toggle };
})();
