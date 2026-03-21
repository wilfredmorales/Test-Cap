<!doctype html>
<html lang="es" class="h-full">
 <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#4F46E5">
  <meta name="description" content="Conversor de archivos XLSX a cuestionarios interactivos">
  <title>Conversor de Archivos a Cuestionarios</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  </script>
  <style>
   * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      font-size: 18px;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    
    body {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      min-height: 100vh;
      min-height: -webkit-fill-available;
      overflow-x: hidden;
    }
    
    @supports (padding: env(safe-area-inset-top)) {
      body {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      }
    }
    
    * {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    
    input, textarea, select {
      -webkit-user-select: text;
      user-select: text;
      font-size: 16px;
    }

    @media screen and (max-width: 380px) {
      html { font-size: 16px; }
    }

    @media screen and (min-width: 381px) and (max-width: 768px) {
      html { font-size: 17px; }
    }

    @media screen and (min-width: 769px) {
      html { font-size: 18px; }
    }
    
    .file-upload-area {
      border: 2px dashed #CBD5E0;
      transition: all 0.3s ease;
      min-height: 120px;
      touch-action: manipulation;
    }

    @media screen and (max-width: 640px) {
      .file-upload-area {
        min-height: 100px;
        padding: 1rem !important;
      }
    }
    
    .file-upload-area:hover, .file-upload-area:active {
      border-color: #4F46E5;
      background-color: #F0F4FF;
    }
    
    .file-upload-area.dragover {
      border-color: #4F46E5;
      background-color: #E0E7FF;
    }
    
    .question-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    
    .question-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 25px rgba(79, 70, 229, 0.2);
      border-color: #818cf8;
    }
    
    .loading-spinner {
      border: 3px solid #E5E7EB;
      border-top-color: #4F46E5;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease;
      max-width: 90%;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .toast.success { background-color: #10B981; }
    .toast.error { background-color: #EF4444; }
    .toast.info { background-color: #3B82F6; }

    .page-section { display: block; }
    .page-section.hidden-page { display: none; }

    .timer-warning {
      animation: pulse 1.5s ease-in-out infinite;
    }

    .timer-critical {
      animation: shake 0.5s ease-in-out infinite;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .score-blink {
      animation: blink 0.5s ease-in-out 3;
    }

    .option-btn {
      position: relative;
      overflow: hidden;
    }

    .option-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      transition: left 0.5s;
    }

    .option-btn:hover::before {
      left: 100%;
    }

    .badge-modern {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      color: white;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    button {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      min-height: 44px;
      min-width: 44px;
      position: relative;
      font-weight: 600;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 14px 0 rgba(0,0,0,0.15);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px 0 rgba(0,0,0,0.2);
    }

    button:active {
      transform: scale(0.98) translateY(0);
      box-shadow: 0 2px 8px 0 rgba(0,0,0,0.1);
    }

    @media screen and (max-width: 640px) {
      button {
        min-height: 48px;
        padding: 0.75rem 1rem;
      }
    }

    .confirm-delete-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 20px;
    }

    .confirm-delete-modal {
      background: white;
      border-radius: 16px;
      padding: 24px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    @media screen and (max-width: 640px) {
      .max-w-6xl {
        padding-left: 0.75rem;
        padding-right: 0.75rem;
      }

      .confirm-delete-modal {
        margin: 1rem;
        padding: 1.25rem;
      }

      .question-card {
        padding: 1rem !important;
      }
    }

    @media screen and (min-width: 641px) and (max-width: 1024px) {
      .max-w-6xl {
        padding-left: 2rem;
        padding-right: 2rem;
      }
    }

    .truncate-mobile {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    @media screen and (max-width: 640px) {
      .truncate-mobile {
        max-width: 200px;
      }
    }

    .overflow-auto {
      -webkit-overflow-scrolling: touch;
    }

    .custom-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: rgba(79, 70, 229, 0.3) transparent;
    }

    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(79, 70, 229, 0.3);
      border-radius: 3px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(79, 70, 229, 0.5);
    }

    .floating-back-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
      transform: scale(1);
      transition: transform 0.2s ease, opacity 0.3s ease;
      box-shadow: 0 8px 24px rgba(79, 70, 229, 0.4);
    }

    .floating-back-btn:active {
      transform: scale(0.9);
    }

    @media screen and (max-width: 640px) {
      .floating-back-btn {
        bottom: 16px;
        right: 16px;
      }
    }

    .score-green {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
    }

    .score-red {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
    }

    .config-card {
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border: 2px solid #e0e7ff;
      transition: all 0.3s ease;
    }

    .config-card:hover {
      border-color: #c7d2fe;
      box-shadow: 0 8px 24px rgba(79, 70, 229, 0.15);
      transform: translateY(-2px);
    }
  </style>
  <style>@view-transition { navigation: auto; }</style>
  <script src="/_sdk/data_sdk.js" type="text/javascript"></script>
  <script src="/_sdk/element_sdk.js" type="text/javascript"></script>
 </head>
 <body class="h-full"><input type="file" id="file-input" accept=".xlsx,.xls,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf" multiple style="position: absolute; left: -9999px;">
  <div id="app" class="w-full h-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-auto custom-scrollbar">
   <div class="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen"><!-- PAGE 1: Upload -->
    <div id="upload-page" class="page-section">
     <div class="text-center mb-4">
      <h1 id="app-title" class="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">CONVERSOR A CUESTIONARIO</h1>
      <p id="upload-instructions" class="text-xs sm:text-sm text-gray-600">Sube tus archivos XLSX o PDF para generar cuestionarios</p>
     </div>
     <div class="bg-white rounded-xl shadow-lg p-4 mb-4 border border-indigo-100">
      <div id="upload-area" class="file-upload-area rounded-lg p-6 text-center cursor-pointer">
       <div class="mb-2">
        <svg class="w-10 h-10 mx-auto text-indigo-400" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
       </div>
       <p class="text-sm font-semibold text-gray-700 mb-1">📁 Toca aquí para seleccionar archivo(s)</p>
       <p class="text-xs text-gray-400">Formato: XLSX o PDF (Múltiples archivos permitidos)</p>
       <p class="text-xs text-blue-600 mt-2">💡 Puedes cargar PDFs separados: uno con preguntas y otro con respuestas</p>
      </div>
      <div id="files-list" class="hidden mt-4 space-y-2"></div>
      <div id="file-actions" class="hidden mt-4 flex gap-2 justify-center flex-wrap"><button id="process-btn" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:from-indigo-800 active:to-purple-800 text-white font-semibold py-2 px-5 rounded-lg transition-all shadow-lg text-sm whitespace-nowrap"> ✨ Procesar </button> <button id="add-more-btn" class="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 active:from-green-800 active:to-green-900 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-lg text-sm whitespace-nowrap"> ➕ Agregar más </button> <button id="clear-all-btn" class="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 active:from-red-800 active:to-red-900 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-lg text-sm whitespace-nowrap"> 🗑️ Limpiar todo </button>
      </div>
      <div id="loading-section" class="hidden mt-4 text-center">
       <div class="loading-spinner mx-auto mb-3"></div>
       <p class="text-gray-600 text-sm">Procesando archivo(s)...</p>
      </div>
     </div>
    </div><!-- PAGE 2: Quiz Configuration -->
    <div id="config-page" class="page-section hidden-page">
     <div id="config-container"></div>
    </div><!-- PAGE 3: Quiz -->
    <div id="quiz-page" class="page-section hidden-page">
     <div class="bg-white rounded-2xl shadow-xl p-4 sm:p-6 mb-6 border border-indigo-100">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
       <div>
        <h2 class="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">🎯 Cuestionario</h2>
        <p id="questions-count" class="text-gray-600 mt-1 text-xs sm:text-sm"></p>
       </div>
       <div class="flex items-center gap-2 flex-wrap">
        <div id="timer-display" class="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1.5 rounded-lg shadow-lg border-2 border-orange-600 transition-all">
         <p class="text-xs font-medium opacity-90">⏱️ Tiempo</p>
         <p id="timer-text" class="text-lg sm:text-xl font-bold tracking-wider">120:00</p>
        </div>
        <div id="score-display-container" class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1.5 rounded-lg shadow-lg transition-all">
         <p class="text-xs font-medium opacity-90">⭐ Puntos</p>
         <p id="score-display" class="text-base sm:text-lg font-bold">0.0</p>
        </div>
       </div>
      </div>
      <div class="flex gap-2 mb-4 flex-wrap"><button id="finish-quiz-btn" class="flex-1 min-w-[120px] bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 active:from-green-800 active:to-green-900 text-white font-medium py-2 px-3 rounded-lg text-xs transition-all shadow-md"> Finalizar Test </button> <button id="restart-btn" class="flex-1 min-w-[120px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:from-blue-800 acti/activ  00 text-white font-medium py-2 px-3 rounded-lg text-xs transition-all shadow-md"> Reiniciar </button>
      </div>
      <div id="questions-container" class="space-y-4"></div>
     </div>
    </div><!-- PAGE 4: Review -->
    <div id="review-page" class="page-section hidden-page">
     <div id="review-container"></div><button id="floating-back-btn" class="floating-back-btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:from-indigo-800 active:to-purple-800 text-white font-bold py-4 px-6 rounded-full text-lg shadow-2xl"> ← Volver </button>
    </div>
   </div>
  </div>
  <script>
    const STORAGE_KEYS = {
      CURRENT_FILE: 'quiz_app_current_file',
      ALL_QUESTIONS: 'quiz_app_all_questions'
    };

    let currentFiles = [];
    let processedQuestions = [];
    let allQuestions = [];
    let currentScore = 0;
    let currentQuestionIndex = 0;
    let timerInterval = null;
    let timeRemaining = 7200;
    let quizConfig = {
      numQuestions: 100,
      timeLimit: 120,
      selectedSheets: [],
      pointsCorrect: 1,
      pointsIncorrect: -0.5,
      pointsUnanswered: 0,
      passPercentage: 51,
      failPercentage: 49
    };

    function saveToLocalStorage(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        showToast('Error al guardar datos', 'error');
      }
    }

    function loadFromLocalStorage(key) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
      }
    }

    function deleteFromLocalStorage(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        showToast('Error al eliminar datos', 'error');
      }
    }

    function showPage(pageName) {
      document.getElementById('upload-page').classList.add('hidden-page');
      document.getElementById('config-page').classList.add('hidden-page');
      document.getElementById('quiz-page').classList.add('hidden-page');
      document.getElementById('review-page').classList.add('hidden-page');
      
      document.getElementById(pageName + '-page').classList.remove('hidden-page');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function startTimer() {
      stopTimer();
      timeRemaining = quizConfig.timeLimit * 60;
      updateTimerDisplay();
      
      timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
          stopTimer();
          finishQuizDueToTimeout();
        }
      }, 1000);
    }

    function stopTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    function updateTimerDisplay() {
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      const timerText = document.getElementById('timer-text');
      const timerDisplay = document.getElementById('timer-display');
      
      if (timerText) {
        timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      if (timerDisplay) {
        timerDisplay.classList.remove('timer-warning', 'timer-critical');
        
        if (timeRemaining <= 300) {
          timerDisplay.classList.add('timer-critical');
        } else if (timeRemaining <= 1800) {
          timerDisplay.classList.add('timer-warning');
          timerDisplay.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        } else {
          timerDisplay.style.background = 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)';
        }
      }
    }

    function finishQuizDueToTimeout() {
      showToast('⏱️ ¡Tiempo agotado! El cuestionario ha finalizado', 'error');
      showQuizResults();
    }

    function initApp() {
      loadSavedFile();
      setupEventListeners();
      showPage('upload');
    }

    function loadSavedFile() {
      const savedFile = loadFromLocalStorage(STORAGE_KEYS.CURRENT_FILE);
      const savedQuestions = loadFromLocalStorage(STORAGE_KEYS.ALL_QUESTIONS);
      
      if (savedFile && savedQuestions) {
        allQuestions = savedQuestions;
        updateFilesDisplay();
        
        const fileActions = document.getElementById('file-actions');
        
        if (fileActions) {
          fileActions.classList.remove('hidden');
        }
        
        showToast(`✅ ${savedQuestions.length} preguntas cargadas desde la sesión anterior`, 'success');
      }
    }

    function setupEventListeners() {
      const uploadArea = document.getElementById('upload-area');
      const fileInput = document.getElementById('file-input');
      const processBtn = document.getElementById('process-btn');
      const addMoreBtn = document.getElementById('add-more-btn');
      const clearAllBtn = document.getElementById('clear-all-btn');

      if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (fileInput) {
            fileInput.click();
          }
        });
        
        uploadArea.addEventListener('touchend', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (fileInput) {
            fileInput.click();
          }
        });
      }
      
      if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
      }
      
      if (processBtn) processBtn.addEventListener('click', processFiles);
      if (addMoreBtn) {
        addMoreBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          fileInput.click();
        });
      }
      if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllFiles);
    }

    function handleFileSelect(e) {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        addFiles(files);
      }
      e.target.value = '';
    }

    function addFiles(files) {
      files.forEach(file => {
        if (!file.name.match(/\.(xlsx|xls|pdf)$/i)) {
          showToast('Archivo ignorado: ' + file.name + ' (solo XLSX o PDF)', 'error');
          return;
        }

        if (file.size > 50 * 1024 * 1024) {
          showToast('Archivo demasiado grande: ' + file.name, 'error');
          return;
        }

        const exists = currentFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
          currentFiles.push(file);
        }
      });

      updateFilesDisplay();
    }

    function updateFilesDisplay() {
      const filesList = document.getElementById('files-list');
      const fileActions = document.getElementById('file-actions');
      const savedFile = loadFromLocalStorage(STORAGE_KEYS.CURRENT_FILE);

      if (currentFiles.length > 0) {
        filesList.classList.remove('hidden');
        fileActions.classList.remove('hidden');

        filesList.innerHTML = currentFiles.map((file, index) => `
          <div class="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 flex items-center justify-between gap-2">
            <div class="flex items-center min-w-0 flex-1">
              <svg class="w-5 h-5 ${file.name.match(/\.pdf$/i) ? 'text-red-600' : 'text-green-600'} mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <div class="min-w-0">
                <p class="font-semibold text-gray-800 text-sm truncate">${escapeHtml(file.name)}</p>
                <p class="text-xs text-gray-600">${formatFileSize(file.size)}</p>
              </div>
            </div>
            <button class="remove-file-btn bg-red-500 hover:bg-red-600 active:bg-red-700 text-white p-2 rounded-lg transition-all" data-index="${index}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        `).join('');

        document.querySelectorAll('.remove-file-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            removeFile(index);
          });
        });
      } 
      else if (savedFile && savedFile.names && allQuestions.length > 0) {
        filesList.classList.remove('hidden');
        fileActions.classList.remove('hidden');

        filesList.innerHTML = `
          <div class="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center mb-2">
                  <svg class="w-6 h-6 text-green-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <h4 class="font-bold text-green-800 text-sm">Sesión anterior restaurada</h4>
                </div>
                <div class="space-y-1 text-xs text-gray-700">
                  ${savedFile.names.map(name => `
                    <p class="truncate">📄 ${escapeHtml(name)}</p>
                  `).join('')}
                </div>
                <p class="text-xs text-green-700 font-semibold mt-2">
                  ✅ ${allQuestions.length} preguntas disponibles
                </p>
              </div>
            </div>
          </div>
        `;
      } 
      else {
        filesList.classList.add('hidden');
        fileActions.classList.add('hidden');
      }
    }

    function removeFile(index) {
      currentFiles.splice(index, 1);
      updateFilesDisplay();
      showToast('Archivo eliminado', 'info');
    }

    function clearAllFiles() {
      if (currentFiles.length === 0 && allQuestions.length === 0) return;

      const overlay = document.createElement('div');
      overlay.className = 'confirm-delete-overlay';
      
      const itemCount = currentFiles.length > 0 ? currentFiles.length : 'la sesión guardada';
      
      overlay.innerHTML = `
        <div class="confirm-delete-modal">
          <h3 class="text-xl font-bold text-gray-800 mb-3">🗑️ Confirmar Eliminación</h3>
          <p class="text-gray-600 mb-4">¿Eliminar ${itemCount} y todas las preguntas cargadas?</p>
          <div class="flex gap-3">
            <button id="cancel-delete-btn" class="flex-1 bg-gray-500 hover:bg-gray-600 active:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all">
              Cancelar
            </button>
            <button id="confirm-delete-btn" class="flex-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-3 px-4 rounded-lg transition-all">
              Eliminar Todo
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      document.getElementById('cancel-delete-btn').addEventListener('click', () => {
        overlay.remove();
      });

      document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        currentFiles = [];
        allQuestions = [];
        deleteFromLocalStorage(STORAGE_KEYS.CURRENT_FILE);
        deleteFromLocalStorage(STORAGE_KEYS.ALL_QUESTIONS);
        updateFilesDisplay();
        showToast('✓ Todos los archivos eliminados', 'success');
        overlay.remove();
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
        }
      });
    }

    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    async function processFiles() {
      if (currentFiles.length === 0 && allQuestions.length > 0) {
        const savedFile = loadFromLocalStorage(STORAGE_KEYS.CURRENT_FILE);
        showQuizConfiguration(allQuestions, savedFile ? savedFile.names.join(', ') : '');
        return;
      }
      
      if (currentFiles.length === 0) {
        showToast('⚠️ No hay archivos para procesar', 'error');
        return;
      }

      const loadingSection = document.getElementById('loading-section');
      const fileActions = document.getElementById('file-actions');
      const processBtn = document.getElementById('process-btn');

      processBtn.disabled = true;
      processBtn.textContent = 'Procesando...';
      fileActions.classList.add('hidden');
      loadingSection.classList.remove('hidden');

      try {
        console.log(`📦 Procesando ${currentFiles.length} archivo(s)...`);
        
        const pdfFiles = currentFiles.filter(f => f.name.match(/\.pdf$/i));
        const xlsxFiles = currentFiles.filter(f => f.name.match(/\.(xlsx|xls)$/i));

        let allExtractedQuestions = [];
        let globalAnswerMap = new Map();

        for (const pdfFile of pdfFiles) {
          console.log(`📄 Procesando PDF: ${pdfFile.name}`);
          const { questions, answers } = await extractQuestionsAndAnswersFromPDF(pdfFile);
          
          allExtractedQuestions.push(...questions);
          
          answers.forEach((value, key) => {
            if (!globalAnswerMap.has(key)) {
              globalAnswerMap.set(key, value);
            }
          });
          
          console.log(`  ✅ ${questions.length} preguntas, ${answers.size} respuestas`);
        }

        for (const xlsxFile of xlsxFiles) {
          console.log(`📊 Procesando XLSX: ${xlsxFile.name}`);
          const data = await readFileAsArrayBuffer(xlsxFile);
          const workbook = XLSX.read(data, { type: 'array' });
          const questions = extractQuestionsFromWorkbook(workbook);
          allExtractedQuestions.push(...questions);
          console.log(`  ✅ ${questions.length} preguntas`);
        }

        console.log(`🔗 Enlazando ${globalAnswerMap.size} respuestas con preguntas...`);
        let linkedCount = 0;
        allExtractedQuestions.forEach(q => {
          if (!q.answer || q.answer === '') {
            const questionNum = q.questionNum || extractQuestionNumber(q.codigo);
            if (questionNum && globalAnswerMap.has(questionNum)) {
              q.answer = globalAnswerMap.get(questionNum);
              linkedCount++;
              console.log(`  🔗 Pregunta ${questionNum} enlazada con respuesta ${q.answer}`);
            }
          }
        });
        console.log(`✅ Total respuestas enlazadas: ${linkedCount}`);

        if (allExtractedQuestions.length === 0) {
          showToast('⚠️ No se encontraron preguntas válidas en los archivos', 'error');
          return;
        }

        allQuestions = allExtractedQuestions;
        
        const fileData = {
          names: currentFiles.map(f => f.name),
          totalSize: currentFiles.reduce((sum, f) => sum + f.size, 0),
          uploadDate: new Date().toISOString()
        };
        
        saveToLocalStorage(STORAGE_KEYS.CURRENT_FILE, fileData);
        saveToLocalStorage(STORAGE_KEYS.ALL_QUESTIONS, allExtractedQuestions);

        const filesText = currentFiles.length === 1 ? currentFiles[0].name : `${currentFiles.length} archivos`;
        showQuizConfiguration(allExtractedQuestions, filesText);
        showToast(`✅ ${allExtractedQuestions.length} preguntas extraídas correctamente`, 'success');

      } catch (error) {
        console.error('❌ Error al procesar archivos:', error);
        showToast('Error al procesar archivos: ' + error.message, 'error');
      } finally {
        loadingSection.classList.add('hidden');
        fileActions.classList.remove('hidden');
        processBtn.disabled = false;
        processBtn.textContent = '✨ Procesar';
      }
    }

    async function extractQuestionsAndAnswersFromPDF(file) {
      try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        console.log(`📄 PDF cargado: ${pdf.numPages} páginas`);
        
        let allText = '';
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          allText += pageText + '\n';
        }
        
        console.log(`📊 Total texto extraído: ${allText.length} caracteres`);
        
        const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        const answerSectionIndex = findAnswerSection(lines);
        let answerMap = new Map();
        
        if (answerSectionIndex !== -1) {
          answerMap = extractAnswersFromLines(lines.slice(answerSectionIndex));
          console.log(`🔑 Encontradas ${answerMap.size} respuestas en hoja de respuestas`);
        }
        
        const questionsBeforeAnswer = lines.slice(0, answerSectionIndex !== -1 ? answerSectionIndex : lines.length);
        const hasQuestions = questionsBeforeAnswer.some(line => 
          line.match(/^COD:/i) || 
          line.match(/^\d+[\.\)\-:\s]/) ||
          line.match(/^[A-D][\.\)\-:\s]/i)
        );

        let questions = [];
        
        if (hasQuestions) {
          const format1Questions = tryExtractFormat1FromPDF(lines, file.name, answerMap, answerSectionIndex);
          if (format1Questions.length > 0) {
            console.log(`✅ PDF Formato COD detectado (${format1Questions.length} preguntas)`);
            questions = format1Questions;
          } else {
            const format2Questions = tryExtractFormat2FromPDF(lines, file.name, answerMap, answerSectionIndex);
            if (format2Questions.length > 0) {
              console.log(`✅ PDF Formato estándar detectado (${format2Questions.length} preguntas)`);
              questions = format2Questions;
            }
          }
        } else {
          console.log(`📝 Archivo detectado como hoja de RESPUESTAS ÚNICAMENTE`);
        }
        
        return { questions, answers: answerMap };
      } catch (error) {
        console.error('Error al procesar PDF:', error);
        throw new Error('No se pudo leer el archivo PDF: ' + error.message);
      }
    }

    function tryExtractFormat1FromPDF(lines, fileName, answerMap, answerSectionIndex) {
      const questions = [];
      const maxIndex = answerSectionIndex !== -1 ? answerSectionIndex : lines.length;
      
      for (let i = 0; i < maxIndex; i++) {
        const line = lines[i];
        
        if (!line.toUpperCase().startsWith('COD:')) continue;
        if (i + 6 >= maxIndex) continue;
        
        const codigo = line.substring(4).trim();
        const questionNum = extractQuestionNumber(codigo) || (questions.length + 1);
        
        const pregunta = lines[i + 1] || '';
        if (!pregunta) continue;
        
        const opcionA = lines[i + 2] || '';
        const opcionB = lines[i + 3] || '';
        const opcionC = lines[i + 4] || '';
        const opcionD = lines[i + 5] || '';
        const respuestaRaw = lines[i + 6] || '';
        
        const cleanOption = (text) => {
          if (!text) return '';
          return text.replace(/^[A-D][\)\.\-:\s]+/i, '').trim();
        };
        
        const options = [
          { letter: 'A', text: cleanOption(opcionA) },
          { letter: 'B', text: cleanOption(opcionB) },
          { letter: 'C', text: cleanOption(opcionC) },
          { letter: 'D', text: cleanOption(opcionD) }
        ].filter(opt => opt.text !== '');
        
        if (options.length < 2) continue;
        
        let respuesta = '';
        if (respuestaRaw.toUpperCase().includes('RESPUESTA')) {
          const respuestaParts = respuestaRaw.split(':');
          if (respuestaParts.length > 1) {
            respuesta = respuestaParts[1].trim().toUpperCase().charAt(0);
          }
        } else {
          respuesta = extractAnswerLetter(respuestaRaw) || '';
        }
        
        if (!respuesta && answerMap.has(questionNum)) {
          respuesta = answerMap.get(questionNum);
          console.log(`    🔗 Enlazada respuesta ${respuesta} para pregunta ${questionNum}`);
        }
        
        questions.push({
          id: `pdf_q${questions.length + 1}`,
          sheet: fileName,
          fileTitle: fileName,
          codigo: codigo,
          questionNum: questionNum,
          question: pregunta,
          type: 'multiple choice',
          options: options,
          answer: respuesta,
          selectedAnswer: null
        });
        
        i += 6;
      }
      
      return questions;
    }

    function tryExtractFormat2FromPDF(lines, fileName, answerMap, answerSectionIndex) {
      const questions = [];
      const maxIndex = answerSectionIndex !== -1 ? answerSectionIndex : lines.length;
      
      let currentQuestion = null;
      let currentOptions = [];
      
      for (let i = 0; i < maxIndex; i++) {
        const line = lines[i];
        
        const questionNum = extractQuestionNumber(line);
        
        if (questionNum !== null && line.length < 30) {
          if (currentQuestion && currentOptions.length >= 2) {
            const answer = answerMap.get(currentQuestion.questionNum) || currentQuestion.answer || '';
            
            if (answer) {
              console.log(`    🔗 Pregunta ${currentQuestion.questionNum} enlazada con respuesta ${answer}`);
            }
            
            questions.push({
              id: `pdf_q${questions.length + 1}`,
              sheet: fileName,
              fileTitle: fileName,
              codigo: currentQuestion.codigo,
              questionNum: currentQuestion.questionNum,
              question: currentQuestion.text,
              type: 'multiple choice',
              options: currentOptions,
              answer: answer,
              selectedAnswer: null
            });
          }
          
          let questionText = '';
          const questionMatch = line.match(/^\d+[\.\)\-:\s]+(.+)/);
          
          if (questionMatch && questionMatch[1].trim().length > 5) {
            questionText = questionMatch[1].trim();
          } else {
            questionText = lines[i + 1] || line;
            if (lines[i + 1] && lines[i + 1].length > 5) {
              i++;
            }
          }
          
          currentQuestion = {
            questionNum: questionNum,
            codigo: questionNum.toString(),
            text: questionText,
            answer: ''
          };
          currentOptions = [];
          continue;
        }
        
        const optionMatch = line.match(/^([A-D])[\.\)\-:\s](.+)/i);
        if (optionMatch && currentQuestion) {
          const letter = optionMatch[1].toUpperCase();
          const optionText = optionMatch[2].trim();
          
          if (optionText && optionText.length > 1) {
            currentOptions.push({
              letter: letter,
              text: optionText
            });
          }
          continue;
        }
        
        if (currentQuestion && currentOptions.length >= 2) {
          const inlineAnswer = extractAnswerLetter(line);
          if (inlineAnswer && (line.toLowerCase().includes('respuesta') || line.toLowerCase().includes('answer'))) {
            currentQuestion.answer = inlineAnswer;
          }
        }
        
        if (currentQuestion && currentOptions.length === 0 && line.length > 10 && !extractQuestionNumber(line)) {
          currentQuestion.text += ' ' + line;
        }
      }
      
      if (currentQuestion && currentOptions.length >= 2) {
        const answer = answerMap.get(currentQuestion.questionNum) || currentQuestion.answer || '';
        
        if (answer) {
          console.log(`    🔗 Pregunta ${currentQuestion.questionNum} enlazada con respuesta ${answer}`);
        }
        
        questions.push({
          id: `pdf_q${questions.length + 1}`,
          sheet: fileName,
          fileTitle: fileName,
          codigo: currentQuestion.codigo,
          questionNum: currentQuestion.questionNum,
          question: currentQuestion.text,
          type: 'multiple choice',
          options: currentOptions,
          answer: answer,
          selectedAnswer: null
        });
      }
      
      return questions;
    }

    function findAnswerSection(lines) {
      const answerKeywords = [
        'hoja de respuestas',
        'respuestas correctas',
        'clave de respuestas',
        'answer key',
        'gabarito',
        'soluciones'
      ];
      
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 50); i--) {
        const line = lines[i].toLowerCase();
        if (answerKeywords.some(keyword => line.includes(keyword))) {
          return i;
        }
      }
      
      return -1;
    }

    function extractAnswersFromLines(lines) {
      const answerMap = new Map();
      
      for (const line of lines) {
        const match = line.match(/(\d+)[\.\)\-:\s]+([A-D])/i);
        if (match) {
          const questionNum = parseInt(match[1]);
          const answer = match[2].toUpperCase();
          answerMap.set(questionNum, answer);
        }
      }
      
      return answerMap;
    }

    function extractQuestionsFromWorkbook(workbook) {
      const allExtractedQuestions = [];
      
      const answerSheets = findAnswerSheets(workbook);
      const answerMap = extractAnswersFromSheets(workbook, answerSheets);
      
      console.log(`📊 Encontradas ${answerSheets.length} hojas de respuestas`);
      console.log(`🔑 Total respuestas extraídas: ${answerMap.size}`);
      
      workbook.SheetNames.forEach((sheetName, sheetIndex) => {
        if (isAnswerSheet(sheetName)) {
          console.log(`⏩ Saltando hoja de respuestas: ${sheetName}`);
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const fileTitle = extractFileTitle(jsonData);
        
        const questionsFromSheet = extractQuestionsFromSheet(
          jsonData, 
          sheetName, 
          sheetIndex, 
          answerMap,
          fileTitle
        );
        
        console.log(`✅ Extraídas ${questionsFromSheet.length} preguntas de: ${sheetName}`);
        allExtractedQuestions.push(...questionsFromSheet);
      });

      console.log(`🎯 Total preguntas procesadas: ${allExtractedQuestions.length}`);
      return allExtractedQuestions;
    }

    function findAnswerSheets(workbook) {
      const answerKeywords = [
        'respuesta', 'respuestas',
        'answer', 'answers',
        'clave', 'claves',
        'solucion', 'soluciones',
        'key', 'keys',
        'gabarito',
        'corrección', 'correccion'
      ];
      return workbook.SheetNames.filter(name => 
        answerKeywords.some(keyword => name.toLowerCase().includes(keyword))
      );
    }

    function isAnswerSheet(sheetName) {
      const answerKeywords = [
        'respuesta', 'respuestas',
        'answer', 'answers',
        'clave', 'claves',
        'solucion', 'soluciones',
        'key', 'keys',
        'gabarito',
        'corrección', 'correccion'
      ];
      return answerKeywords.some(keyword => sheetName.toLowerCase().includes(keyword));
    }

    function extractFileTitle(jsonData) {
      for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        const row = jsonData[i];
        
        for (let j = 0; j < row.length; j++) {
          const cell = row[j] ? row[j].toString().trim() : '';
          
          const titlePatterns = [
            /^t[ií]tulo[\s:]+(.+)/i,
            /^title[\s:]+(.+)/i,
            /^examen[\s:]+(.+)/i,
            /^test[\s:]+(.+)/i,
            /^cuestionario[\s:]+(.+)/i,
            /^evaluaci[oó]n[\s:]+(.+)/i
          ];
          
          for (const pattern of titlePatterns) {
            const match = cell.match(pattern);
            if (match && match[1].length > 0) {
              return match[1].trim();
            }
          }
          
          if (cell.length > 10 && cell.length < 100 && !extractQuestionNumber(cell)) {
            return cell;
          }
        }
      }
      
      return null;
    }

    function extractAnswersFromSheets(workbook, answerSheets) {
      const answerMap = new Map();

      answerSheets.forEach(sheetName => {
        console.log(`🔍 Procesando hoja de respuestas: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          for (let colIdx = 0; colIdx < row.length - 1; colIdx++) {
            const leftCell = row[colIdx] ? row[colIdx].toString().trim() : '';
            const rightCell = row[colIdx + 1] ? row[colIdx + 1].toString().trim() : '';
            
            const questionNum = extractQuestionNumber(leftCell);
            
            if (questionNum !== null) {
              const answer = extractAnswerLetter(rightCell);
              
              if (answer) {
                answerMap.set(questionNum, answer);
                console.log(`  ✓ Pregunta ${questionNum} → Respuesta ${answer}`);
              }
            }
          }

          for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const cell = row[colIdx] ? row[colIdx].toString().trim() : '';
            
            const concatenatedMatch = cell.match(/^(\d+)[\.\)\-:\s]+([A-D])$/i);
            if (concatenatedMatch) {
              const questionNum = parseInt(concatenatedMatch[1]);
              const answer = concatenatedMatch[2].toUpperCase();
              
              if (!answerMap.has(questionNum)) {
                answerMap.set(questionNum, answer);
                console.log(`  🔗 Pregunta ${questionNum} → Respuesta ${answer} (concatenado)`);
              }
            }
          }
        }
      });

      return answerMap;
    }

    function extractQuestionNumber(text) {
      if (!text) return null;
      
      const cleanText = text.trim();
      
      const patterns = [
        /^(\d+)[\.\)\-:\s]/,
        /^pregunta\s*(\d+)/i,
        /^question\s*(\d+)/i,
        /^p[\.\s]*(\d+)/i,
        /^q[\.\s]*(\d+)/i,
        /^\#(\d+)/,
        /^nº\s*(\d+)/i,
        /^n°\s*(\d+)/i,
        /^no[\.\s]*(\d+)/i,
        /^num[\.\s]*(\d+)/i,
        /^\[(\d+)\]/,
        /^\((\d+)\)/,
        /^(\d+)$/
      ];

      for (const pattern of patterns) {
        const match = cleanText.match(pattern);
        if (match) {
          const num = parseInt(match[1]);
          if (num >= 1 && num <= 9999) {
            return num;
          }
        }
      }

      return null;
    }

    function extractAnswerLetter(text) {
      if (!text) return null;
      
      const cleaned = text.toUpperCase().trim();
      
      const patterns = [
        /^([A-D])[\.\)\-:\s]*$/,
        /^RESPUESTA[\s:\-]*([A-D])/i,
        /^ANSWER[\s:\-]*([A-D])/i,
        /^OPCI[OÓ]N[\s:\-]*([A-D])/i,
        /^OPTION[\s:\-]*([A-D])/i,
        /^ALTERNATIVA[\s:\-]*([A-D])/i,
        /^LETRA[\s:\-]*([A-D])/i,
        /^CLAVE[\s:\-]*([A-D])/i,
        /^CORRECTA[\s:\-]*([A-D])/i,
        /^\(([A-D])\)/,
        /^\[([A-D])\]/,
        /([A-D])$/
      ];

      for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
          return match[1].toUpperCase();
        }
      }

      if (/^[A-D]$/.test(cleaned)) {
        return cleaned;
      }

      return null;
    }

    function extractQuestionsFromSheet(jsonData, sheetName, sheetIndex, answerMap, fileTitle) {
      const questions = [];

      const format1Questions = tryExtractFormat1(jsonData, sheetName, sheetIndex, answerMap, fileTitle);
      if (format1Questions.length > 0) {
        console.log(`  📋 Formato COD: detectado (${format1Questions.length} preguntas)`);
        return format1Questions;
      }

      const format2Questions = tryExtractFormat2(jsonData, sheetName, sheetIndex, answerMap, fileTitle);
      if (format2Questions.length > 0) {
        console.log(`  📋 Formato columnas: detectado (${format2Questions.length} preguntas)`);
        return format2Questions;
      }

      console.log(`  ⚠️ No se detectó formato conocido en: ${sheetName}`);
      return questions;
    }

    function tryExtractFormat1(jsonData, sheetName, sheetIndex, answerMap, fileTitle) {
      const questions = [];
      
      for (let i = 0; i < jsonData.length; i++) {
        const codigoRaw = jsonData[i][0] ? jsonData[i][0].toString().trim() : '';
        
        if (!codigoRaw.toUpperCase().startsWith('COD:')) continue;
        if (i + 6 >= jsonData.length) continue;
        
        const pregunta = jsonData[i + 1][0] ? jsonData[i + 1][0].toString().trim() : '';
        if (!pregunta) continue;
        
        const opcionA = jsonData[i + 2][0] ? jsonData[i + 2][0].toString().trim() : '';
        const opcionB = jsonData[i + 3][0] ? jsonData[i + 3][0].toString().trim() : '';
        const opcionC = jsonData[i + 4][0] ? jsonData[i + 4][0].toString().trim() : '';
        const opcionD = jsonData[i + 5][0] ? jsonData[i + 5][0].toString().trim() : '';
        const respuestaRaw = jsonData[i + 6][0] ? jsonData[i + 6][0].toString().trim() : '';

        const codigo = codigoRaw.substring(4).trim();
        const questionNum = extractQuestionNumber(codigo) || (questions.length + 1);

        let respuesta = '';
        if (respuestaRaw.toUpperCase().includes('RESPUESTA')) {
          const respuestaParts = respuestaRaw.split(':');
          if (respuestaParts.length > 1) {
            respuesta = respuestaParts[1].trim().toUpperCase().charAt(0);
          }
        } else {
          respuesta = extractAnswerLetter(respuestaRaw) || '';
        }

        if (!respuesta && answerMap.has(questionNum)) {
          respuesta = answerMap.get(questionNum);
          console.log(`    🔗 Enlazada respuesta ${respuesta} para pregunta ${questionNum} desde hoja de respuestas`);
        }

        const cleanOption = (text) => {
          if (!text) return '';
          return text.replace(/^[A-D][\)\.\-:\s]+/i, '').trim();
        };

        const options = [
          { letter: 'A', text: cleanOption(opcionA) },
          { letter: 'B', text: cleanOption(opcionB) },
          { letter: 'C', text: cleanOption(opcionC) },
          { letter: 'D', text: cleanOption(opcionD) }
        ].filter(opt => opt.text !== '');

        if (options.length > 0) {
          questions.push({
            id: `sheet${sheetIndex}_q${questions.length + 1}`,
            sheet: sheetName,
            fileTitle: fileTitle || sheetName,
            codigo: codigo,
            questionNum: questionNum,
            question: pregunta,
            type: 'multiple choice',
            options: options,
            answer: respuesta,
            selectedAnswer: null
          });
        }
      }

      return questions;
    }

    function tryExtractFormat2(jsonData, sheetName, sheetIndex, answerMap, fileTitle) {
      const questions = [];
      let currentQuestion = null;
      let currentOptions = [];

      for (let rowIdx = 0; rowIdx < jsonData.length; rowIdx++) {
        const row = jsonData[rowIdx];
        
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          const leftCell = row[colIdx] ? row[colIdx].toString().trim() : '';
          const rightCell = row[colIdx + 1] ? row[colIdx + 1].toString().trim() : '';

          const questionNum = extractQuestionNumber(leftCell);
          
          if (questionNum !== null && leftCell.length < 20) {
            if (currentQuestion && currentOptions.length > 0) {
              const answer = answerMap.get(currentQuestion.questionNum) || currentQuestion.answer || '';
              
              if (answer) {
                console.log(`    🔗 Pregunta ${currentQuestion.questionNum} enlazada con respuesta ${answer}`);
              } else {
                console.log(`    ⚠️ Pregunta ${currentQuestion.questionNum} sin respuesta conocida`);
              }
              
              questions.push({
                id: `sheet${sheetIndex}_q${questions.length + 1}`,
                sheet: sheetName,
                fileTitle: fileTitle || sheetName,
                codigo: currentQuestion.codigo,
                questionNum: currentQuestion.questionNum,
                question: currentQuestion.text,
                type: 'multiple choice',
                options: currentOptions,
                answer: answer,
                selectedAnswer: null
              });
            }

            let questionText = rightCell || leftCell;
            
            if (rightCell && !rightCell.match(/^[A-D][\.\)\-:\s]/i)) {
              questionText = rightCell;
            } else if (rightCell && rightCell.match(/^[A-D][\.\)\-:\s]/i)) {
              const questionMatch = leftCell.match(/^\d+[\.\)\-:\s]+(.+)/);
              if (questionMatch) {
                questionText = questionMatch[1].trim();
              }
            }

            currentQuestion = {
              questionNum: questionNum,
              codigo: questionNum.toString(),
              text: questionText,
              answer: ''
            };
            currentOptions = [];
            
            if (rightCell && rightCell.match(/^[A-D][\.\)\-:\s]/i)) {
              const optionMatch = rightCell.match(/^([A-D])[\.\)\-:\s](.+)/i);
              if (optionMatch) {
                currentOptions.push({
                  letter: optionMatch[1].toUpperCase(),
                  text: optionMatch[2].trim()
                });
              }
            }
            
            continue;
          }

          const optionMatch = leftCell.match(/^([A-D])[\.\)\-:\s]/i);
          if (optionMatch && currentQuestion) {
            const letter = optionMatch[1].toUpperCase();
            const optionText = rightCell || leftCell.substring(optionMatch[0].length).trim();
            
            if (optionText) {
              currentOptions.push({
                letter: letter,
                text: optionText
              });
            }
            continue;
          }

          const concatenatedMatch = leftCell.match(/^([A-D])[\.\)\-:\s](.+)/i);
          if (concatenatedMatch && currentQuestion) {
            const letter = concatenatedMatch[1].toUpperCase();
            const optionText = concatenatedMatch[2].trim();
            
            if (optionText && optionText.length > 1) {
              currentOptions.push({
                letter: letter,
                text: optionText
              });
            }
            continue;
          }

          if (currentQuestion && leftCell.length > 10 && currentOptions.length === 0) {
            currentQuestion.text += ' ' + leftCell;
          }
        }
      }

      if (currentQuestion && currentOptions.length > 0) {
        const answer = answerMap.get(currentQuestion.questionNum) || currentQuestion.answer || '';
        
        if (answer) {
          console.log(`    🔗 Pregunta ${currentQuestion.questionNum} enlazada con respuesta ${answer}`);
        } else {
          console.log(`    ⚠️ Pregunta ${currentQuestion.questionNum} sin respuesta conocida`);
        }
        
        questions.push({
          id: `sheet${sheetIndex}_q${questions.length + 1}`,
          sheet: sheetName,
          fileTitle: fileTitle || sheetName,
          codigo: currentQuestion.codigo,
          questionNum: currentQuestion.questionNum,
          question: currentQuestion.text,
          type: 'multiple choice',
          options: currentOptions,
          answer: answer,
          selectedAnswer: null
        });
      }

      return questions;
    }

    function readFileAsArrayBuffer(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function showQuizConfiguration(questionsSource = allQuestions, filename = '') {
      const configContainer = document.getElementById('config-container');
      const sheets = [...new Set(questionsSource.map(q => q.sheet))];

      const sheetsHTML = sheets.map(sheet => {
        const count = questionsSource.filter(q => q.sheet === sheet).length;
        return `
          <label class="flex items-center p-2.5 bg-white rounded-lg border border-gray-300 hover:border-indigo-400 cursor-pointer transition-all active:bg-indigo-50">
            <input type="checkbox" class="sheet-checkbox w-4 h-4 text-indigo-600 rounded" value="${escapeHtml(sheet)}" checked>
            <div class="ml-2 flex-1">
              <p class="font-semibold text-gray-800 text-sm">${escapeHtml(sheet)}</p>
              <p class="text-xs text-gray-600">${count} preguntas</p>
            </div>
          </label>
        `;
      }).join('');

      configContainer.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl p-4 sm:p-5 border-2 border-indigo-100 config-card">
          <div class="text-center mb-5">
            <div class="inline-block bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full p-3 mb-3 shadow-lg">
              <svg class="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <h2 class="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">⚙️ Configurar Cuestionario</h2>
            ${filename ? `<p class="text-gray-600 text-xs sm:text-sm break-all px-2">📁 ${escapeHtml(filename)}</p>` : ''}
            <p class="text-indigo-600 font-semibold text-sm mt-1">Total: ${questionsSource.length} preguntas disponibles</p>
          </div>

          <div class="space-y-4">
            <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200 config-card">
              <h3 class="text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center">
                <span class="bg-purple-500 text-white p-1.5 rounded-lg mr-2 shadow-md">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  </svg>
                </span>
                Configuración General
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">📊 Número de Preguntas</label>
                  <input type="number" id="num-questions" min="10" max="${questionsSource.length}" value="100" class="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all">
                </div>
                <div>
                  <label class="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">⏱️ Tiempo (minutos)</label>
                  <input type="number" id="time-limit" min="10" max="300" value="120" class="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all">
                </div>
              </div>
            </div>

            <div class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border-2 border-blue-200 config-card">
              <h3 class="text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center">
                <span class="bg-blue-500 text-white p-1.5 rounded-lg mr-2 shadow-md">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                </span>
                Sistema de Puntuación
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs sm:text-sm font-semibold text-green-700 mb-1.5 flex items-center">
                    <span class="mr-1">✅</span> Correcta
                  </label>
                  <input type="number" id="points-correct" min="0" max="10" step="0.5" value="1" class="w-full px-3 py-2 text-sm border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none bg-green-50 focus:ring-2 focus:ring-green-200 transition-all">
                </div>
                <div>
                  <label class="block text-xs sm:text-sm font-semibold text-red-700 mb-1.5 flex items-center">
                    <span class="mr-1">❌</span> Incorrecta
                  </label>
                  <input type="number" id="points-incorrect" min="-5" max="0" step="0.25" value="-0.5" class="w-full px-3 py-2 text-sm border-2 border-red-300 rounded-lg focus:border-red-500 focus:outline-none bg-red-50 focus:ring-2 focus:ring-red-200 transition-all">
                </div>
                <div>
                  <label class="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 flex items-center">
                    <span class="mr-1">⚪</span> Sin responder
                  </label>
                  <input type="number" id="points-unanswered" min="-2" max="1" step="0.25" value="0" class="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-gray-500 focus:outline-none bg-gray-50 focus:ring-2 focus:ring-gray-200 transition-all">
                </div>
              </div>
            </div>

            <div class="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border-2 border-yellow-200 config-card">
              <h3 class="text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center">
                <span class="bg-yellow-500 text-white p-1.5 rounded-lg mr-2 shadow-md">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                  </svg>
                </span>
                Criterios de Calificación
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs sm:text-sm font-semibold text-green-700 mb-1.5 flex items-center">
                    <span class="mr-1">✅</span> Aprobar desde (%)
                  </label>
                  <input type="number" id="pass-percentage" min="0" max="100" step="1" value="51" class="w-full px-3 py-2 text-sm border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none bg-green-50 focus:ring-2 focus:ring-green-200 transition-all">
                  <p class="text-xs text-green-600 mt-1">Porcentaje mínimo para aprobar</p>
                </div>
                <div>
                  <label class="block text-xs sm:text-sm font-semibold text-red-700 mb-1.5 flex items-center">
                    <span class="mr-1">❌</span> Reprobar hasta (%)
                  </label>
                  <input type="number" id="fail-percentage" min="0" max="100" step="1" value="49" class="w-full px-3 py-2 text-sm border-2 border-red-300 rounded-lg focus:border-red-500 focus:outline-none bg-red-50 focus:ring-2 focus:ring-red-200 transition-all">
                  <p class="text-xs text-red-600 mt-1">Porcentaje máximo para reprobar</p>
                </div>
              </div>
            </div>

            <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200 config-card">
              <h3 class="text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center">
                <span class="bg-green-500 text-white p-1.5 rounded-lg mr-2 shadow-md">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </span>
                Seleccionar Hojas
              </h3>
              <div class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                ${sheetsHTML}
              </div>
            </div>
          </div>

          <div class="mt-5 flex gap-3 justify-center flex-wrap">
            <button id="back-to-upload-from-config-btn" class="flex-1 min-w-[120px] max-w-[200px] bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 active:from-gray-800 active:to-gray-900 text-white font-bold py-2.5 px-4 rounded-lg text-sm shadow-md transition-all">
              ← Volver
            </button>
            <button id="start-quiz-btn" class="flex-1 min-w-[120px] max-w-[200px] bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 active:from-indigo-800 active:via-purple-800 active:to-pink-800 text-white font-bold py-2.5 px-4 rounded-lg text-sm shadow-lg transition-all">
              🚀 Iniciar
            </button>
          </div>
        </div>
      `;

      showPage('config');

      document.getElementById('back-to-upload-from-config-btn').addEventListener('click', () => {
        showPage('upload');
        updateFilesDisplay();
      });

      document.getElementById('start-quiz-btn').addEventListener('click', () => {
        const numQuestionsInput = document.getElementById('num-questions');
        const timeLimitInput = document.getElementById('time-limit');
        const pointsCorrectInput = document.getElementById('points-correct');
        const pointsIncorrectInput = document.getElementById('points-incorrect');
        const pointsUnansweredInput = document.getElementById('points-unanswered');
        const passPercentageInput = document.getElementById('pass-percentage');
        const failPercentageInput = document.getElementById('fail-percentage');
        
        quizConfig.numQuestions = parseInt(numQuestionsInput.value);
        quizConfig.timeLimit = parseInt(timeLimitInput.value);
        quizConfig.pointsCorrect = parseFloat(pointsCorrectInput.value);
        quizConfig.pointsIncorrect = parseFloat(pointsIncorrectInput.value);
        quizConfig.pointsUnanswered = parseFloat(pointsUnansweredInput.value);
        quizConfig.passPercentage = parseFloat(passPercentageInput.value);
        quizConfig.failPercentage = parseFloat(failPercentageInput.value);
        
        const selectedSheets = Array.from(document.querySelectorAll('.sheet-checkbox:checked')).map(cb => cb.value);
        quizConfig.selectedSheets = selectedSheets;

        if (selectedSheets.length === 0) {
          showToast('⚠️ Debes seleccionar al menos una hoja', 'error');
          return;
        }

        console.log('📊 Configuración de puntuación:', {
          correcta: quizConfig.pointsCorrect,
          incorrecta: quizConfig.pointsIncorrect,
          sinResponder: quizConfig.pointsUnanswered,
          aprobarDesde: quizConfig.passPercentage + '%',
          reprobarHasta: quizConfig.failPercentage + '%'
        });

        startQuiz(questionsSource);
      });
    }

    function startQuiz(questionsSource = allQuestions) {
      const filteredQuestions = quizConfig.selectedSheets.length > 0
        ? questionsSource.filter(q => quizConfig.selectedSheets.includes(q.sheet))
        : questionsSource;

      const questionsToShow = Math.min(quizConfig.numQuestions, filteredQuestions.length);
      const shuffled = [...filteredQuestions].sort(() => Math.random() - 0.5);
      processedQuestions = shuffled.slice(0, questionsToShow);
      currentScore = 0;
      currentQuestionIndex = 0;
      
      updateScoreDisplay();
      startTimer();
      showPage('quiz');
      renderQuestions();
      setupQuizButtons();
    }

    function setupQuizButtons() {
      const restartBtn = document.getElementById('restart-btn');
      const backBtn = document.getElementById('back-btn');
      const finishBtn = document.getElementById('finish-quiz-btn');

      if (restartBtn) {
        restartBtn.replaceWith(restartBtn.cloneNode(true));
        document.getElementById('restart-btn').addEventListener('click', restartTest);
      }

      if (backBtn) {
        backBtn.replaceWith(backBtn.cloneNode(true));
        document.getElementById('back-btn').addEventListener('click', () => {
          stopTimer();
          showPage('upload');
          updateFilesDisplay();
        });
      }

      if (finishBtn) {
        finishBtn.replaceWith(finishBtn.cloneNode(true));
        document.getElementById('finish-quiz-btn').addEventListener('click', () => {
          stopTimer();
          showQuizResults();
        });
      }
    }

    function renderQuestions() {
      const questionsContainer = document.getElementById('questions-container');
      const questionsCount = document.getElementById('questions-count');

      const questionText = processedQuestions.length === 1 ? 'pregunta' : 'preguntas';
      questionsCount.textContent = `${processedQuestions.length} ${questionText}`;
      questionsContainer.innerHTML = '';

      if (currentQuestionIndex >= processedQuestions.length) {
        stopTimer();
        showQuizResults();
        return;
      }

      const q = processedQuestions[currentQuestionIndex];
      const index = currentQuestionIndex;
      
      const card = document.createElement('div');
      card.className = 'question-card rounded-2xl p-4 sm:p-6 shadow-xl';
      
      let optionsHTML = '';
      if (q.options && q.options.length > 0) {
        optionsHTML = `
          <div class="mt-4">
            <p class="text-sm sm:text-base font-semibold text-gray-700 mb-3 flex items-center">
              <span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm mr-2">📝</span>
              Elige tu respuesta
            </p>
            <div class="grid grid-cols-1 gap-3">
              ${q.options.map(opt => {
                const isSelected = q.selectedAnswer === opt.letter;
                const isCorrect = opt.letter === q.answer;
                
                let buttonClass = 'option-btn text-left text-gray-700 bg-white p-4 rounded-xl border-2 border-gray-300 hover:border-indigo-500 hover:bg-indigo-50 active:bg-indigo-100 hover:shadow-lg transition-all cursor-pointer font-medium text-sm';
                
                if (isSelected && isCorrect) {
                  buttonClass = 'option-btn text-left text-white bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-xl border-2 border-green-600 font-medium text-sm cursor-default shadow-lg';
                } else if (isSelected && !isCorrect) {
                  buttonClass = 'option-btn text-left text-white bg-gradient-to-r from-red-500 to-pink-600 p-4 rounded-xl border-2 border-red-600 font-medium text-sm cursor-default shadow-lg';
                } else if (q.selectedAnswer && isCorrect) {
                  buttonClass = 'option-btn text-left text-white bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-xl border-2 border-green-600 font-medium text-sm cursor-default shadow-lg';
                } else if (q.selectedAnswer) {
                  buttonClass = 'option-btn text-left text-gray-400 bg-gray-100 p-4 rounded-xl border-2 border-gray-300 font-medium text-sm cursor-not-allowed opacity-60';
                }
                
                return `<button class="${buttonClass}" data-question-index="${index}" data-option="${opt.letter}" ${q.selectedAnswer ? 'disabled' : ''}>
                  <span class="font-bold text-base sm:text-lg mr-2">${opt.letter})</span> ${escapeHtml(opt.text)}
                </button>`;
              }).join('')}
            </div>
          </div>
        `;
      }

      let navigationHTML = '';
      const isLastQuestion = currentQuestionIndex === processedQuestions.length - 1;
      
      if (q.selectedAnswer) {
        const buttonText = isLastQuestion ? '✅ Finalizar' : '➡️ Siguiente';
        navigationHTML = `
          <div class="mt-5 flex justify-end">
            <button id="next-question-btn" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:from-indigo-800 active:to-purple-800 text-white font-bold py-3 px-6 sm:px-8 rounded-xl transition-all shadow-lg text-sm sm:text-base">
              ${buttonText}
            </button>
          </div>
        `;
      } else {
        navigationHTML = `
          <div class="mt-5 flex justify-end gap-3">
            <button id="skip-question-btn" class="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 active:from-yellow-700 active:to-orange-700 text-white font-bold py-3 px-6 sm:px-8 rounded-xl transition-all shadow-lg text-base sm:text-lg">
              Saltar ⏩
            </button>
          </div>
        `;
      }

      let codigoHTML = '';
      if (q.codigo && q.codigo !== '') {
        codigoHTML = `<span class="badge-modern">🔖 ${escapeHtml(q.codigo)}</span>`;
      }

      const progress = ((index + 1) / processedQuestions.length * 100).toFixed(0);

      card.innerHTML = `
        <div class="mb-4">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                ${index + 1} / ${processedQuestions.length}
              </span>
              ${codigoHTML}
              <span class="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-300">
                ${escapeHtml(q.sheet)}
              </span>
            </div>
          </div>
          
          <div class="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden shadow-inner">
            <div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-500" style="width: ${progress}%"></div>
          </div>
        </div>
        
        <div class="bg-white bg-opacity-70 rounded-xl p-3 sm:p-4 mb-3 border-l-4 border-indigo-500 shadow-md">
          <p class="text-sm sm:text-base font-bold text-gray-800 leading-relaxed">${escapeHtml(q.question)}</p>
        </div>
        
        ${optionsHTML}
        ${navigationHTML}
      `;

      const optionButtons = card.querySelectorAll('.option-btn');
      optionButtons.forEach(btn => {
        btn.addEventListener('click', handleOptionClick);
      });

      const nextBtn = card.querySelector('#next-question-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', nextQuestion);
      }

      const skipBtn = card.querySelector('#skip-question-btn');
      if (skipBtn) {
        skipBtn.addEventListener('click', skipQuestion);
      }

      questionsContainer.appendChild(card);
    }

    function handleOptionClick(e) {
      const button = e.currentTarget;
      const questionIndex = parseInt(button.dataset.questionIndex);
      const selectedOption = button.dataset.option;
      
      if (processedQuestions[questionIndex].selectedAnswer) {
        return;
      }

      processedQuestions[questionIndex].selectedAnswer = selectedOption;
      
      if (selectedOption === processedQuestions[questionIndex].answer) {
        currentScore += quizConfig.pointsCorrect;
      } else {
        currentScore += quizConfig.pointsIncorrect;
      }
      
      updateScoreDisplay(true);
      renderQuestions();
    }

    function skipQuestion() {
      currentQuestionIndex++;
      renderQuestions();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function nextQuestion() {
      currentQuestionIndex++;
      renderQuestions();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateScoreDisplay(blink = false) {
      const scoreDisplay = document.getElementById('score-display');
      const scoreContainer = document.getElementById('score-display-container');
      
      if (scoreDisplay) {
        scoreDisplay.textContent = currentScore.toFixed(1);
        
        if (blink) {
          scoreDisplay.classList.add('score-blink');
          setTimeout(() => {
            scoreDisplay.classList.remove('score-blink');
          }, 1500);
        }
      }

      if (scoreContainer) {
        const maxPossibleScore = processedQuestions.length * quizConfig.pointsCorrect;
        const passScore = (maxPossibleScore * quizConfig.passPercentage) / 100;
        const failScore = (maxPossibleScore * quizConfig.failPercentage) / 100;
        
        scoreContainer.classList.remove('score-green', 'score-red');
        
        if (currentScore >= passScore) {
          scoreContainer.classList.add('score-green');
        } 
        else if (currentScore <= failScore) {
          scoreContainer.classList.add('score-red');
        }
      }
    }

    function showQuizResults() {
      const questionsContainer = document.getElementById('questions-container');
      
      let totalScore = 0;
      processedQuestions.forEach(q => {
        if (!q.selectedAnswer) {
          totalScore += quizConfig.pointsUnanswered;
        } else if (q.selectedAnswer === q.answer) {
          totalScore += quizConfig.pointsCorrect;
        } else {
          totalScore += quizConfig.pointsIncorrect;
        }
      });

      currentScore = totalScore;

      const maxPossibleScore = processedQuestions.length * quizConfig.pointsCorrect;
      const percentage = maxPossibleScore > 0 ? ((currentScore / maxPossibleScore) * 100).toFixed(1) : 0;
      const passedTest = percentage >= quizConfig.passPercentage;
      const correctAnswers = processedQuestions.filter(q => q.selectedAnswer === q.answer).length;
      const incorrectAnswers = processedQuestions.filter(q => q.selectedAnswer && q.selectedAnswer !== q.answer).length;
      const unanswered = processedQuestions.filter(q => !q.selectedAnswer).length;
      
      questionsContainer.innerHTML = `
        <div class="text-center py-6 sm:py-8 bg-white rounded-2xl border-2 ${passedTest ? 'border-green-400' : 'border-red-400'} shadow-xl">
          <div class="inline-block ${passedTest ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-pink-600'} rounded-full p-4 mb-3 shadow-lg">
            <svg class="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              ${passedTest ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>' : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>'}
            </svg>
          </div>
          <h3 class="text-2xl sm:text-3xl font-bold mb-2 ${passedTest ? 'text-green-700' : 'text-red-700'} px-4">
            ${passedTest ? '🎉 ¡FELICITACIONES!' : '😔 COMPLETADO'}
          </h3>
          
          <div class="grid grid-cols-2 gap-3 max-w-md mx-auto my-4 px-4">
            <div class="bg-gradient-to-br from-indigo-50 to-purple-50 p-3 rounded-xl border-2 border-indigo-300">
              <p class="text-xs text-gray-600 mb-1">Puntuación Total</p>
              <p class="text-xl sm:text-2xl font-bold ${passedTest ? 'text-green-600' : 'text-red-600'}">${currentScore.toFixed(1)}</p>
              <p class="text-xs text-gray-500">de ${maxPossibleScore.toFixed(1)} posibles</p>
            </div>
            <div class="bg-gradient-to-br from-blue-50 to-cyan-50 p-3 rounded-xl border-2 border-blue-300">
              <p class="text-xs text-gray-600 mb-1">Porcentaje</p>
              <p class="text-xl sm:text-2xl font-bold ${passedTest ? 'text-green-600' : 'text-red-600'}">${percentage}%</p>
              <p class="text-xs text-gray-500">obtenido</p>
            </div>
            <div class="bg-gradient-to-br from-green-50 to-emerald-50 p-3 rounded-xl border-2 border-green-300">
              <p class="text-xs text-gray-600 mb-1">✅ Correctas</p>
              <p class="text-xl sm:text-2xl font-bold text-green-700">${correctAnswers}</p>
              <p class="text-xs text-green-600">+${(correctAnswers * quizConfig.pointsCorrect).toFixed(1)} pts</p>
            </div>
            <div class="bg-gradient-to-br from-red-50 to-pink-50 p-3 rounded-xl border-2 border-red-300">
              <p class="text-xs text-gray-600 mb-1">❌ Incorrectas</p>
              <p class="text-xl sm:text-2xl font-bold text-red-700">${incorrectAnswers}</p>
              <p class="text-xs text-red-600">${(incorrectAnswers * quizConfig.pointsIncorrect).toFixed(1)} pts</p>
            </div>
          </div>

          ${unanswered > 0 ? `<div class="bg-gray-100 py-2 px-4 rounded-lg inline-block mb-3">
            <p class="text-gray-700 text-xs sm:text-sm font-semibold">⏭️ ${unanswered} sin responder (${(unanswered * quizConfig.pointsUnanswered).toFixed(1)} pts)</p>
          </div>` : ''}
          
          ${passedTest ? '<p class="text-green-600 font-bold text-base sm:text-lg mb-4 bg-green-50 py-2 px-4 rounded-lg border border-green-400 inline-block mx-4">✅ ¡Aprobado!</p>' : '<p class="text-red-600 font-bold text-base sm:text-lg mb-4 bg-red-50 py-2 px-4 rounded-lg border border-red-400 inline-block mx-4">❌ No aprobado</p>'}
          
          <div class="space-y-2 px-4">
            <div class="flex gap-2 justify-center flex-wrap">
              <button id="review-answers-btn" class="flex-1 min-w-[130px] max-w-[180px] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 active:from-purple-800 active:to-pink-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-all shadow-md text-sm">
                📝 Revisar
              </button>
              <button id="restart-completed-btn" class="flex-1 min-w-[130px] max-w-[180px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 text-white font-semibold py-2.5 px-4 rounded-lg transition-all shadow-md text-sm">
                Nuevo Test
              </button>
            </div>
            <div class="flex gap-2 justify-center flex-wrap">
              <button id="back-completed-btn" class="flex-1 min-w-[130px] max-w-[270px] bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 active:from-gray-800 active:to-gray-900 text-white font-semibold py-2.5 px-4 rounded-lg transition-all shadow-md text-sm">
                ← Inicio
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.getElementById('restart-completed-btn').addEventListener('click', restartTest);
      document.getElementById('back-completed-btn').addEventListener('click', () => {
        showPage('upload');
        updateFilesDisplay();
      });
      document.getElementById('review-answers-btn').addEventListener('click', showReviewPage);
    }

    function showReviewPage() {
      const reviewContainer = document.getElementById('review-container');
      
      const incorrectQuestions = processedQuestions.filter(q => q.selectedAnswer && q.selectedAnswer !== q.answer);
      const correctQuestions = processedQuestions.filter(q => q.selectedAnswer === q.answer);
      const unansweredQuestions = processedQuestions.filter(q => !q.selectedAnswer);

      const renderQuestionList = (questions, title, colorClass, icon) => {
        if (questions.length === 0) return '';
        
        return `
          <div class="mb-6">
            <h3 class="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center">
              <span class="bg-gradient-to-r ${colorClass} text-white p-2 rounded-lg mr-2">${icon}</span>
              ${title} (${questions.length})
            </h3>
            <div class="space-y-3">
              ${questions.map((q, i) => {
                const isCorrect = q.selectedAnswer === q.answer;
                const wasAnswered = q.selectedAnswer !== null;
                
                return `
                  <div class="bg-white p-3 sm:p-4 rounded-xl border-2 ${isCorrect ? 'border-green-300' : wasAnswered ? 'border-red-300' : 'border-gray-300'} shadow-md">
                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2 flex-wrap">
                          <span class="badge-modern">🔖 ${escapeHtml(q.codigo || 'N/A')}</span>
                          <span class="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">📄 ${escapeHtml(q.sheet)}</span>
                        </div>
                        <p class="font-semibold text-gray-800 mb-2 text-sm">${escapeHtml(q.question)}</p>
                        <div class="space-y-1 text-xs sm:text-sm">
                          ${q.options.map(opt => {
                            const isAnswer = opt.letter === q.answer;
                            const isSelected = opt.letter === q.selectedAnswer;
                            let optionClass = 'text-gray-600';
                            let prefix = opt.letter + ')';
                            
                            if (isAnswer) {
                              optionClass = 'text-green-700 font-bold';
                              prefix = '✅ ' + prefix;
                            }
                            if (isSelected && !isAnswer) {
                              optionClass = 'text-red-700 font-bold';
                              prefix = '❌ ' + prefix;
                            }
                            
                            return `<p class="${optionClass}">${prefix} ${escapeHtml(opt.text)}</p>`;
                          }).join('')}
                        </div>
                      </div>
                    </div>
                    ${wasAnswered ? `
                      <div class="mt-3 p-2 ${isCorrect ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'} rounded">
                        <p class="text-xs sm:text-sm ${isCorrect ? 'text-green-800' : 'text-red-800'}">
                          <span class="font-bold">${isCorrect ? '✅ Correcta' : '❌ Tu respuesta: ' + q.selectedAnswer}</span>
                          ${!isCorrect ? ` | Correcta: ${q.answer}` : ''}
                        </p>
                      </div>
                    ` : `
                      <div class="mt-3 p-2 bg-gray-50 border-l-4 border-gray-400 rounded">
                        <p class="text-xs sm:text-sm text-gray-700">⚪ Sin responder | Correcta: ${q.answer}</p>
                      </div>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      };

      reviewContainer.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl p-4 sm:p-8 border border-indigo-200">
          <div class="text-center mb-6 sm:mb-8">
            <div class="inline-block bg-gradient-to-br from-purple-400 to-pink-500 rounded-full p-4 sm:p-5 mb-4 shadow-xl">
              <svg class="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
              </svg>
            </div>
            <h2 class="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">📝 Revisión</h2>
            <p class="text-gray-600 text-sm">Analiza tus respuestas</p>
          </div>

          <div class="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div class="bg-gradient-to-br from-green-50 to-emerald-50 p-3 sm:p-4 rounded-xl border-2 border-green-300">
              <p class="text-green-800 font-bold text-xl sm:text-2xl">${correctQuestions.length}</p>
              <p class="text-green-600 text-xs sm:text-sm">Correctas</p>
            </div>
            <div class="bg-gradient-to-br from-red-50 to-pink-50 p-3 sm:p-4 rounded-xl border-2 border-red-300">
              <p class="text-red-800 font-bold text-xl sm:text-2xl">${incorrectQuestions.length}</p>
              <p class="text-red-600 text-xs sm:text-sm">Incorrectas</p>
            </div>
            <div class="bg-gradient-to-br from-gray-50 to-slate-50 p-3 sm:p-4 rounded-xl border-2 border-gray-300">
              <p class="text-gray-800 font-bold text-xl sm:text-2xl">${unansweredQuestions.length}</p>
              <p class="text-gray-600 text-xs sm:text-sm">Sin responder</p>
            </div>
          </div>

          ${renderQuestionList(incorrectQuestions, 'Incorrectas', 'from-red-500 to-pink-600', '❌')}
          ${renderQuestionList(unansweredQuestions, 'Sin Responder', 'from-gray-500 to-slate-600', '⚪')}
          ${renderQuestionList(correctQuestions, 'Correctas', 'from-green-500 to-emerald-600', '✅')}
        </div>
      `;

      showPage('review');

      const floatingBtn = document.getElementById('floating-back-btn');

      floatingBtn.addEventListener('click', () => {
        currentQuestionIndex = 0;
        renderQuestions();
        showPage('quiz');
      });
    }

    function restartTest() {
      if (allQuestions.length === 0) {
        showToast('No hay preguntas disponibles', 'error');
        return;
      }

      showQuizConfiguration(allQuestions, '');
      showToast('📋 Configura un nuevo test', 'info');
    }

    function showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 3000);
    }

    document.addEventListener('DOMContentLoaded', initApp);
  </script>
 <script>(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'9bb56f8f5581cfb5',t:'MTc2Nzk3NzQ0OS4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script></body>
</html>
