(function () {
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg"]);
  const CONFIG = window.BACKGROUND_REMOVER_CONFIG || {};
  const STORAGE_KEY = "background-remover-api-endpoint";

  const fileInput = document.getElementById("fileInput");
  const selectButton = document.getElementById("selectButton");
  const dropZone = document.getElementById("dropZone");
  const apiEndpoint = document.getElementById("apiEndpoint");
  const saveEndpoint = document.getElementById("saveEndpoint");
  const message = document.getElementById("message");
  const resultImage = document.getElementById("resultImage");
  const emptyState = document.getElementById("emptyState");
  const downloadButton = document.getElementById("downloadButton");
  const previewStage = document.getElementById("previewStage");
  const bgButtons = document.querySelectorAll("[data-preview-bg]");

  let resultUrl = "";
  let resultFileName = "background-removed.png";

  apiEndpoint.value = localStorage.getItem(STORAGE_KEY) || CONFIG.apiEndpoint || "";

  function setMessage(text, type) {
    message.textContent = text;
    message.className = type ? `message ${type}` : "message";
  }

  function setBusy(isBusy) {
    selectButton.disabled = isBusy;
    saveEndpoint.disabled = isBusy;
    downloadButton.disabled = isBusy || !resultUrl;
    dropZone.setAttribute("aria-busy", String(isBusy));
  }

  function validateFile(file) {
    if (!file) return "画像ファイルを選択してください。";
    if (!ACCEPTED_TYPES.has(file.type)) return "PNG / JPG / JPEG の画像を選択してください。";
    if (file.size > MAX_FILE_SIZE) return "画像サイズは 5MB 以下にしてください。";
    return "";
  }

  function getEndpoint() {
    return apiEndpoint.value.trim();
  }

  function makeDownloadName(fileName) {
    const baseName = fileName.replace(/\.[^.]+$/, "") || "image";
    return `${baseName}-transparent.png`;
  }

  async function removeBackground(file) {
    const validationError = validateFile(file);
    if (validationError) {
      setMessage(validationError, "error");
      return;
    }

    const endpoint = getEndpoint();
    if (!endpoint) {
      setMessage("Cloud Run API URL を入力してください。", "error");
      apiEndpoint.focus();
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setBusy(true);
    setMessage("背景を削除しています。", "");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      if (blob.type && blob.type !== "image/png") {
        throw new Error("APIからPNG以外のデータが返されました。");
      }

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(blob);
      resultFileName = makeDownloadName(file.name);
      resultImage.src = resultUrl;
      resultImage.hidden = false;
      emptyState.hidden = true;
      downloadButton.disabled = false;
      setMessage("透過PNGを作成しました。", "success");
    } catch (error) {
      setMessage(`処理に失敗しました: ${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  selectButton.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("click", (event) => {
    if (event.target !== selectButton) fileInput.click();
  });
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    removeBackground(fileInput.files[0]);
    fileInput.value = "";
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragging");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
    removeBackground(event.dataTransfer.files[0]);
  });

  saveEndpoint.addEventListener("click", () => {
    const endpoint = getEndpoint();
    localStorage.setItem(STORAGE_KEY, endpoint);
    setMessage(endpoint ? "API URLを保存しました。" : "API URLを空にしました。", "success");
  });

  downloadButton.addEventListener("click", () => {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = resultFileName;
    link.click();
  });

  bgButtons.forEach((button) => {
    button.addEventListener("click", () => {
      bgButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      previewStage.className = `preview-stage ${button.dataset.previewBg}`;
    });
  });
})();
