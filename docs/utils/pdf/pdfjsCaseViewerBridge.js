(function () {
  const OPEN_MESSAGE = 'case-tools-open-pdf';
  const READY_MESSAGE = 'case-tools-pdfjs-ready';
  const SAVED_MESSAGE = 'case-tools-pdfjs-saved';
  const ERROR_MESSAGE = 'case-tools-pdfjs-error';
  const STATUS_MESSAGE = 'case-tools-pdfjs-status';
  const parentOrigin = window.location.origin;
  let currentFileName = '';
  let saveButton = null;
  let statusEl = null;

  function postToParent(message, transfers) {
    window.parent.postMessage(message, parentOrigin, transfers || []);
  }

  function postError(message, error) {
    console.error(message, error);
    postToParent({
      type: ERROR_MESSAGE,
      message,
      detail: error?.message || String(error || ''),
    });
  }

  function bytesToTransferableBuffer(bytes) {
    if (bytes instanceof ArrayBuffer) {
      return bytes;
    }

    if (ArrayBuffer.isView(bytes)) {
      const view = bytes;
      if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
        return view.buffer;
      }
      return view.slice().buffer;
    }

    return new Uint8Array(bytes).buffer;
  }

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('case-tools-status-error', isError);
    if (message) {
      window.setTimeout(() => {
        if (statusEl?.textContent === message) {
          statusEl.textContent = '';
          statusEl.classList.remove('case-tools-status-error');
        }
      }, 5000);
    }
  }

  async function waitForViewerApplication() {
    for (let i = 0; i < 200; i++) {
      const app = window.PDFViewerApplication;
      if (app?.initializedPromise) {
        await app.initializedPromise;
        return app;
      }
      await new Promise(resolve => window.setTimeout(resolve, 50));
    }
    throw new Error('PDF.js viewer did not initialize.');
  }

  async function openPdf({ fileName, pdfBytes }) {
    const app = await waitForViewerApplication();
    currentFileName = fileName || 'document.pdf';
    setStatus(`Opening ${currentFileName}...`);

    if (app.pdfDocument || app.pdfLoadingTask) {
      await app.close();
    }

    await app.open({
      data: new Uint8Array(pdfBytes),
      filename: currentFileName,
    });

    document.title = currentFileName;
    setStatus(`${currentFileName} loaded.`);
  }

  async function saveToCaseTools() {
    const app = await waitForViewerApplication();
    if (!app.pdfDocument) {
      setStatus('No PDF is loaded.', true);
      return;
    }

    if (saveButton) {
      saveButton.disabled = true;
    }
    setStatus('Saving annotations to CaseTools...');
    postToParent({ type: STATUS_MESSAGE, message: 'Saving annotations...' });

    try {
      await app.pdfScriptingManager?.dispatchWillSave?.();
      const bytes = await app.pdfDocument.saveDocument();
      const buffer = bytesToTransferableBuffer(bytes);
      postToParent({
        type: SAVED_MESSAGE,
        fileName: currentFileName,
        pdfBytes: buffer,
      }, [buffer]);
      await app.pdfScriptingManager?.dispatchDidSave?.();
      setStatus('Saved to CaseTools.');
    } catch (error) {
      postError('Could not save annotations to CaseTools.', error);
      setStatus('Save failed.', true);
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
      }
    }
  }

  function installCaseToolsUi() {
    if (document.getElementById('caseToolsSaveButton')) return;

    const style = document.createElement('style');
    style.textContent = `
      #caseToolsSaveButton {
        width: auto;
        min-width: 9.5rem;
        padding: 0 0.75rem;
        font-weight: 600;
      }

      #caseToolsSaveButton::before {
        display: none;
      }

      #caseToolsStatus {
        align-self: center;
        max-width: 18rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--toolbar-icon-bg-color);
        font-size: 0.75rem;
      }

      #caseToolsStatus.case-tools-status-error {
        color: #d72638;
      }
    `;
    document.head.appendChild(style);

    for (const id of ['secondaryOpenFile', 'viewsManagerAddFileButton']) {
      const element = document.getElementById(id);
      if (element) {
        element.hidden = true;
      }
    }

    const toolbarRight = document.getElementById('toolbarViewerRight');
    const downloadButton = document.getElementById('downloadButton');
    if (!toolbarRight) return;

    saveButton = document.createElement('button');
    saveButton.id = 'caseToolsSaveButton';
    saveButton.className = 'toolbarButton';
    saveButton.type = 'button';
    saveButton.title = 'Save annotations back to this CaseTools evidence PDF';
    saveButton.textContent = 'Save to CaseTools';
    saveButton.addEventListener('click', () => {
      saveToCaseTools();
    });

    statusEl = document.createElement('span');
    statusEl.id = 'caseToolsStatus';
    statusEl.setAttribute('role', 'status');

    const referenceNode = downloadButton?.parentElement === toolbarRight ? downloadButton : null;
    toolbarRight.insertBefore(saveButton, referenceNode);
    toolbarRight.insertBefore(statusEl, saveButton.nextSibling);
  }

  window.addEventListener('message', event => {
    if (event.origin !== parentOrigin) return;
    const message = event.data || {};
    if (message.type !== OPEN_MESSAGE) return;

    openPdf(message).catch(error => {
      postError('Could not open PDF in PDF.js viewer.', error);
      setStatus('Open failed.', true);
    });
  });

  waitForViewerApplication()
    .then(() => {
      installCaseToolsUi();
      postToParent({ type: READY_MESSAGE });
    })
    .catch(error => {
      postError('Could not initialize PDF.js viewer bridge.', error);
    });
})();
