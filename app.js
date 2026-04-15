const fileInput = document.querySelector("#fileInput");
const pasteButton = document.querySelector("#pasteButton");
const copyButton = document.querySelector("#copyButton");
const saveButton = document.querySelector("#saveButton");
const resetButton = document.querySelector("#resetButton");
const curveResetButton = document.querySelector("#curveResetButton");
const basicResetButton = document.querySelector("#basicResetButton");
const levelsResetButton = document.querySelector("#levelsResetButton");
const grayscaleButton = document.querySelector("#grayscaleButton");
const invertButton = document.querySelector("#invertButton");
const showSourceButton = document.querySelector("#showSourceButton");
const showOutputButton = document.querySelector("#showOutputButton");
const fitWidthButton = document.querySelector("#fitWidthButton");
const fitHeightButton = document.querySelector("#fitHeightButton");
const canvasFrame = document.querySelector("#canvasFrame");
const toolLinks = [...document.querySelectorAll("[data-copy-target]")];
const statusText = document.querySelector("#statusText");
const imageMeta = document.querySelector("#imageMeta");
const emptyState = document.querySelector("#emptyState");

const sourceCanvas = document.querySelector("#sourceCanvas");
const outputCanvas = document.querySelector("#outputCanvas");
const curveCanvas = document.querySelector("#curveCanvas");

const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const outputCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
const curveCtx = curveCanvas.getContext("2d");

const controls = {
  contrast: document.querySelector("#contrast"),
  sharpness: document.querySelector("#sharpness"),
  blackPoint: document.querySelector("#blackPoint"),
  gamma: document.querySelector("#gamma"),
  whitePoint: document.querySelector("#whitePoint"),
};

const controlOutputs = {
  contrast: document.querySelector("#contrastValue"),
  sharpness: document.querySelector("#sharpnessValue"),
  blackPoint: document.querySelector("#blackPointValue"),
  gamma: document.querySelector("#gammaValue"),
  whitePoint: document.querySelector("#whitePointValue"),
};

const curveInputs = [...document.querySelectorAll("[data-curve-point]")];
const curveOutputs = [...document.querySelectorAll("[data-curve-output]")];

const defaultCurve = [0, 64, 128, 192, 255];
const curveX = [0, 64, 128, 192, 255];

let originalImageData = null;
let renderToken = 0;
let grayscaleEnabled = false;
let invertEnabled = false;
let previewMode = "output";
let previewFitMode = "width";

function clamp(value, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

function syncOutputs() {
  controlOutputs.contrast.value = controls.contrast.value;
  controlOutputs.sharpness.value = controls.sharpness.value;
  controlOutputs.blackPoint.value = controls.blackPoint.value;
  controlOutputs.whitePoint.value = controls.whitePoint.value;
  controlOutputs.gamma.value = (Number(controls.gamma.value) / 100).toFixed(2);
  grayscaleButton.textContent = grayscaleEnabled ? "ON" : "OFF";
  grayscaleButton.setAttribute("aria-pressed", String(grayscaleEnabled));
  invertButton.textContent = invertEnabled ? "ON" : "OFF";
  invertButton.setAttribute("aria-pressed", String(invertEnabled));
  showSourceButton.setAttribute("aria-pressed", String(previewMode === "source"));
  showOutputButton.setAttribute("aria-pressed", String(previewMode === "output"));
  fitWidthButton.setAttribute("aria-pressed", String(previewFitMode === "width"));
  fitHeightButton.setAttribute("aria-pressed", String(previewFitMode === "height"));

  curveInputs.forEach((input, index) => {
    curveOutputs[index].value = input.value;
  });
}

function syncPreviewVisibility() {
  sourceCanvas.classList.toggle("is-hidden", previewMode !== "source");
  outputCanvas.classList.toggle("is-hidden", previewMode !== "output");
}

function syncPreviewFitMode() {
  canvasFrame.classList.toggle("fit-width", previewFitMode === "width");
  canvasFrame.classList.toggle("fit-height", previewFitMode === "height");
}

function getCurveValues() {
  return curveInputs.map((input) => Number(input.value));
}

function buildToneCurve(values) {
  const table = new Uint8ClampedArray(256);

  for (let x = 0; x < 256; x += 1) {
    let segment = 0;
    while (segment < curveX.length - 2 && x > curveX[segment + 1]) {
      segment += 1;
    }

    const x0 = curveX[Math.max(0, segment - 1)];
    const x1 = curveX[segment];
    const x2 = curveX[segment + 1];
    const x3 = curveX[Math.min(curveX.length - 1, segment + 2)];

    const y0 = values[Math.max(0, segment - 1)];
    const y1 = values[segment];
    const y2 = values[segment + 1];
    const y3 = values[Math.min(values.length - 1, segment + 2)];

    const span = x2 - x1 || 1;
    const t = clamp((x - x1) / span, 0, 1);

    const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const b = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c = -0.5 * y0 + 0.5 * y2;
    const d = y1;

    table[x] = clamp(Math.round(((a * t + b) * t + c) * t + d));
  }

  return table;
}

function drawCurve() {
  const values = getCurveValues();
  const table = buildToneCurve(values);

  curveCtx.clearRect(0, 0, curveCanvas.width, curveCanvas.height);
  curveCtx.strokeStyle = "rgba(105, 82, 51, 0.22)";
  curveCtx.lineWidth = 1;

  for (let i = 0; i <= 8; i += 1) {
    const p = i * 32;
    curveCtx.beginPath();
    curveCtx.moveTo(p, 0);
    curveCtx.lineTo(p, 256);
    curveCtx.stroke();

    curveCtx.beginPath();
    curveCtx.moveTo(0, p);
    curveCtx.lineTo(256, p);
    curveCtx.stroke();
  }

  curveCtx.strokeStyle = "rgba(124, 89, 49, 0.35)";
  curveCtx.beginPath();
  curveCtx.moveTo(0, 256);
  curveCtx.lineTo(256, 0);
  curveCtx.stroke();

  curveCtx.strokeStyle = "#ad5c2b";
  curveCtx.lineWidth = 3;
  curveCtx.beginPath();

  for (let x = 0; x < 256; x += 1) {
    const y = 255 - table[x];
    if (x === 0) {
      curveCtx.moveTo(x, y);
    } else {
      curveCtx.lineTo(x, y);
    }
  }

  curveCtx.stroke();

  curveCtx.fillStyle = "#8f4316";
  values.forEach((value, index) => {
    curveCtx.beginPath();
    curveCtx.arc(curveX[index], 255 - value, 5, 0, Math.PI * 2);
    curveCtx.fill();
  });
}

function getSettings() {
  return {
    contrast: Number(controls.contrast.value),
    sharpness: Number(controls.sharpness.value),
    blackPoint: Number(controls.blackPoint.value),
    whitePoint: Number(controls.whitePoint.value),
    gamma: Number(controls.gamma.value) / 100,
    toneCurve: buildToneCurve(getCurveValues()),
    grayscale: grayscaleEnabled,
    invert: invertEnabled,
  };
}

function applyAdjustments(sourceData, settings) {
  const pixels = new Uint8ClampedArray(sourceData.data);
  const result = new ImageData(pixels, sourceData.width, sourceData.height);
  const contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast || 1));
  const levelRange = Math.max(1, settings.whitePoint - settings.blackPoint);

  for (let i = 0; i < pixels.length; i += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      let value = pixels[i + channel];
      value = ((value - settings.blackPoint) / levelRange) * 255;
      value = clamp(value);
      value = 255 * Math.pow(value / 255, 1 / settings.gamma);
      value = clamp(contrastFactor * (value - 128) + 128);
      value = settings.toneCurve[clamp(Math.round(value))];
      pixels[i + channel] = value;
    }

    if (settings.grayscale) {
      const gray = clamp(
        Math.round(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114),
      );
      pixels[i] = gray;
      pixels[i + 1] = gray;
      pixels[i + 2] = gray;
    }

    if (settings.invert) {
      pixels[i] = 255 - pixels[i];
      pixels[i + 1] = 255 - pixels[i + 1];
      pixels[i + 2] = 255 - pixels[i + 2];
    }
  }

  if (settings.sharpness > 0) {
    return applyUnsharpMask(result, settings.sharpness / 100);
  }

  return result;
}

function applyUnsharpMask(imageData, amount) {
  const { width, height, data } = imageData;
  const blurred = new Uint8ClampedArray(data.length);
  const weights = [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1,
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const base = (y * width + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let weightSum = 0;

        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const nx = clamp(x + kx, 0, width - 1);
            const ny = clamp(y + ky, 0, height - 1);
            const neighbor = (ny * width + nx) * 4 + channel;
            const weight = weights[(ky + 1) * 3 + (kx + 1)];
            sum += data[neighbor] * weight;
            weightSum += weight;
          }
        }

        const blurValue = sum / weightSum;
        const detail = data[base + channel] - blurValue;
        const edgeBoost = data[base + channel] < 220 ? 1.15 : 0.8;
        blurred[base + channel] = clamp(data[base + channel] + detail * amount * 2.2 * edgeBoost);
      }

      blurred[base + 3] = data[base + 3];
    }
  }

  return new ImageData(blurred, width, height);
}

function fitCanvas(canvas, width, height) {
  canvas.width = width;
  canvas.height = height;
}

function hasLoadedImage() {
  return Boolean(originalImageData);
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

async function copyOutputImageToClipboard(successMessage, failureMessage) {
  if (!hasLoadedImage()) {
    return false;
  }

  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    statusText.textContent = failureMessage;
    return false;
  }

  try {
    const blob = await canvasToBlob(outputCanvas);

    if (!blob) {
      statusText.textContent = failureMessage;
      return false;
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blob,
      }),
    ]);
    statusText.textContent = successMessage;
    return true;
  } catch (_error) {
    statusText.textContent = failureMessage;
    return false;
  }
}

function renderImage() {
  if (!originalImageData) {
    return;
  }

  const token = ++renderToken;
  syncOutputs();
  drawCurve();
  statusText.textContent = "補正を更新中…";

  window.requestAnimationFrame(() => {
    if (token !== renderToken || !originalImageData) {
      return;
    }

    const adjusted = applyAdjustments(originalImageData, getSettings());
    outputCtx.putImageData(adjusted, 0, 0);
    statusText.textContent = "補正を反映しました。必要に応じて保存できます。";
  });
}

function loadImageElement(image) {
  fitCanvas(sourceCanvas, image.naturalWidth, image.naturalHeight);
  fitCanvas(outputCanvas, image.naturalWidth, image.naturalHeight);
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  sourceCtx.drawImage(image, 0, 0);
  originalImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  emptyState.hidden = true;
  copyButton.disabled = false;
  saveButton.disabled = false;
  imageMeta.textContent = `${image.naturalWidth} x ${image.naturalHeight}px`;
  syncPreviewVisibility();
  renderImage();
}

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    statusText.textContent = "画像ファイルを選んでください。";
    return;
  }

  const reader = new FileReader();
  statusText.textContent = `読み込み中: ${file.name}`;

  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      statusText.textContent = `読み込み完了: ${file.name}`;
      loadImageElement(image);
    };
    image.src = reader.result;
  };

  reader.readAsDataURL(file);
}

function resetControls() {
  resetBasicControls();
  resetLevelsControls();
  resetCurveControls();
  syncOutputs();
  drawCurve();
  renderImage();
}

function resetBasicControls() {
  controls.contrast.value = 0;
  controls.sharpness.value = 0;
  grayscaleEnabled = false;
  invertEnabled = false;
}

function resetLevelsControls() {
  controls.blackPoint.value = 0;
  controls.gamma.value = 100;
  controls.whitePoint.value = 255;
}

function resetCurveControls() {
  curveInputs.forEach((input, index) => {
    input.value = defaultCurve[index];
  });
}

fileInput.addEventListener("change", (event) => {
  loadFile(event.target.files?.[0]);
});

pasteButton.addEventListener("click", async () => {
  statusText.textContent = "このページを選択して `Ctrl/Cmd + V` を押すと画像を貼り付けられます。";

  if (!navigator.clipboard?.read) {
    return;
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (imageType) {
        const blob = await item.getType(imageType);
        loadFile(new File([blob], "clipboard-image.png", { type: imageType }));
        return;
      }
    }
    statusText.textContent = "クリップボード内に画像が見つかりませんでした。";
  } catch (_error) {
    statusText.textContent = "ブラウザ制限で直接読めない場合があります。そのときはページ上で貼り付けてください。";
  }
});

document.addEventListener("paste", (event) => {
  const items = [...(event.clipboardData?.items || [])];
  const imageItem = items.find((item) => item.type.startsWith("image/"));

  if (!imageItem) {
    return;
  }

  const file = imageItem.getAsFile();
  if (file) {
    loadFile(file);
  }
});

Object.values(controls).forEach((input) => {
  input.addEventListener("input", renderImage);
});

curveInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    const nextValue = Number(input.value);

    for (let i = 0; i < index; i += 1) {
      if (Number(curveInputs[i].value) > nextValue) {
        curveInputs[i].value = nextValue;
      }
    }

    for (let i = index + 1; i < curveInputs.length; i += 1) {
      if (Number(curveInputs[i].value) < nextValue) {
        curveInputs[i].value = nextValue;
      }
    }

    renderImage();
  });
});

curveResetButton.addEventListener("click", () => {
  resetCurveControls();
  renderImage();
});

basicResetButton.addEventListener("click", () => {
  resetBasicControls();
  renderImage();
});

levelsResetButton.addEventListener("click", () => {
  resetLevelsControls();
  renderImage();
});

grayscaleButton.addEventListener("click", () => {
  grayscaleEnabled = !grayscaleEnabled;
  renderImage();
});

invertButton.addEventListener("click", () => {
  invertEnabled = !invertEnabled;
  renderImage();
});

showSourceButton.addEventListener("click", () => {
  previewMode = "source";
  syncOutputs();
  syncPreviewVisibility();
});

showOutputButton.addEventListener("click", () => {
  previewMode = "output";
  syncOutputs();
  syncPreviewVisibility();
});

fitWidthButton.addEventListener("click", () => {
  previewFitMode = "width";
  syncOutputs();
  syncPreviewFitMode();
});

fitHeightButton.addEventListener("click", () => {
  previewFitMode = "height";
  syncOutputs();
  syncPreviewFitMode();
});

resetButton.addEventListener("click", resetControls);

copyButton.addEventListener("click", async () => {
  await handleCopyButtonAction();
});

async function handleCopyButtonAction() {
  if (!hasLoadedImage()) {
    statusText.textContent = "コピーする画像がありません。";
    return false;
  }

  return copyOutputImageToClipboard(
    "補正画像をクリップボードにコピーしました。",
    "クリップボードへのコピーに失敗しました。ブラウザ権限を確認してください。",
  );
}

toolLinks.forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();

    const destination = link.getAttribute("href");
    const toolName = link.dataset.toolName || "外部ツール";

    if (!destination) {
      return;
    }

    if (!hasLoadedImage()) {
      statusText.textContent = `${toolName}を開きます。`;
      window.location.href = destination;
      return;
    }

    const copied = await handleCopyButtonAction();

    if (!copied) {
      statusText.textContent = `画像コピーに失敗したため、そのまま${toolName}を開きます。`;
    } else {
      statusText.textContent = `画像をコピーして${toolName}へ移動します。`;
    }

    window.location.href = destination;
  });
});

saveButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "corrected-image.png";
  link.href = outputCanvas.toDataURL("image/png");
  link.click();
});

syncOutputs();
syncPreviewVisibility();
syncPreviewFitMode();
drawCurve();
