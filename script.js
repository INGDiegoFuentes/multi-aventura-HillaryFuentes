/**
 * ========================================
 * Multi-Aventura: Script JS Principal (FINAL Y FUNCIONAL)
 * Desarrollado por: Diego Fuentes Garcia
 * Lógica del juego, estado, UI y pedagogía STEM.
 * ========================================
 */

// ========================================
// 1. GESTIÓN DEL ESTADO GLOBAL
// ========================================
let gameState = {
    // Configuración inicial
    studentName: '',
    tableNumber: 0,
    gameMode: 'ordenado', // 'ordenado', 'aleatorio', 'pares', 'impares'
    questionType: 'escribir', // 'escribir', 'multiple'

    // Estado del juego
    questions: [],
    currentQuestionIndex: 0,
    startTime: null,
    timerInterval: null,
    
    // Estadísticas
    correctAnswers: 0,
    errorAnswers: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalTime: 0, // Segundos
    answeredCount: 0,
    
    // Configuración de audio
    soundEnabled: true,
};

// ========================================
// 2. CONSTANTES Y REFERENCIAS DOM
// ========================================
const DOM = {
    // Pantallas
    configScreen: document.getElementById('config-screen'),
    gameScreen: document.getElementById('game-screen'),
    certificateScreen: document.getElementById('certificate-screen'),
    
    // Configuración
    studentNameInput: document.getElementById('student-name'),
    tableSelect: document.getElementById('table-select'),
    startGameBtn: document.getElementById('start-game-btn'),
    
    // Juego
    playerNameDisplay: document.getElementById('current-player-name'),
    gameTimer: document.getElementById('game-timer'),
    progressBar: document.getElementById('progress-bar'),
    statsCorrect: document.getElementById('stats-correct'),
    statsError: document.getElementById('stats-error'),
    statsStreak: document.getElementById('stats-streak'),
    currentQuestionIndexDisplay: document.getElementById('current-question-index'),
    totalQuestionsDisplay: document.getElementById('total-questions'),
    questionText: document.getElementById('question-text'),
    answerTypeWrite: document.getElementById('answer-type-write'),
    answerTypeMultiple: document.getElementById('answer-type-multiple'),
    answerInput: document.getElementById('answer-input'),
    submitAnswerBtn: document.getElementById('submit-answer-btn'),
    
    // Certificado
    certStudentName: document.getElementById('cert-student-name'),
    certTableNumber: document.getElementById('cert-table-number'),
    certFinalName: document.getElementById('cert-final-name'),
    certFinalTableNumber: document.getElementById('cert-final-table-number'),
    certCorrect: document.getElementById('cert-correct'),
    certError: document.getElementById('cert-error'),
    certMaxStreak: document.getElementById('cert-max-streak'),
    certTime: document.getElementById('cert-time'),
    certMedal: document.getElementById('cert-medal'),
    certDate: document.getElementById('cert-date'),
    printCertBtn: document.getElementById('print-cert-btn'),
    restartGameBtn: document.getElementById('restart-game-btn'),
    
    // Extras
    confettiCanvas: document.getElementById('confetti-canvas'),
    soundToggle: document.getElementById('sound-toggle'),
    appContainer: document.getElementById('app')
};

let confettiInstance = null;

// ========================================
// 3. FUNCIONES DE UTILIDAD (Pedagogía y Sonido)
// ========================================

/**
 * Crea un sonido simple usando la Web Audio API (para evitar la necesidad de archivos mp3/ogg).
 */
function createWebAudio(frequency, duration, type) {
    if (!gameState.soundEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = type; 
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime); 
        
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); 
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
        }, duration * 1000);
    } catch (e) {
        console.warn("Web Audio API no disponible o error:", e);
    }
}

const AUDIO = {
    CORRECT: () => createWebAudio(600, 0.1, 'sine'), 
    ERROR: () => createWebAudio(150, 0.2, 'square'),
    VICTORY: () => {
        if (!gameState.soundEnabled) return;
        setTimeout(() => createWebAudio(523, 0.15, 'triangle'), 0);
        setTimeout(() => createWebAudio(659, 0.15, 'triangle'), 150);
        setTimeout(() => createWebAudio(784, 0.3, 'triangle'), 300);
    }
};

function playSound(audioFunction) {
    audioFunction();
}

/**
 * Rellena el selector de tablas del 2 al 9.
 */
function populateTableSelector() {
    for (let i = 2; i <= 9; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Tabla del ${i}`;
        DOM.tableSelect.appendChild(option);
    }
}

/**
 * Genera el set de preguntas para la tabla seleccionada y el modo de juego.
 */
function generateQuestions() {
    const table = parseInt(DOM.tableSelect.value);
    let factors = Array.from({ length: 10 }, (_, i) => i + 1); // Factores: 1 a 10
    
    // Filtrar por modos saltados
    const gameMode = document.querySelector('input[name="game-mode"]:checked').value;
    if (gameMode === 'pares') {
        factors = factors.filter(f => f % 2 === 0);
    } else if (gameMode === 'impares') {
        factors = factors.filter(f => f % 2 !== 0);
    }

    let questions = factors.map(factor => ({
        factor1: table,
        factor2: factor,
        result: table * factor,
        answered: false
    }));
    
    // Modo aleatorio
    if (gameMode === 'aleatorio') {
        questions = questions.sort(() => Math.random() - 0.5);
    }

    return questions;
}

/**
 * Formatea segundos a MM:SS.
 */
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Genera opciones incorrectas cercanas para Opción Múltiple (Distractores Pedagógicos).
 */
function generateDistractors(correctResult) {
    const distractors = new Set();
    
    // Intenta generar 3 opciones incorrectas
    while (distractors.size < 3) {
        let offset = Math.floor(Math.random() * 8) - 4; // Rango de -4 a +3
        if (offset === 0) continue; // Evita el resultado correcto

        let distractor = correctResult + offset;
        
        // Asegura que el resultado sea positivo y no duplicado
        if (distractor > 0 && distractor !== correctResult) {
            distractors.add(distractor);
        }
    }
    return Array.from(distractors);
}

// ========================================
// 4. LÓGICA DE FLUJO Y UI
// ========================================

function startTimer() {
    gameState.startTime = Date.now();
    gameState.timerInterval = setInterval(() => {
        gameState.totalTime = Math.floor((Date.now() - gameState.startTime) / 1000);
        DOM.gameTimer.textContent = formatTime(gameState.totalTime);
    }, 1000);
}

function stopTimer() {
    clearInterval(gameState.timerInterval);
}

/**
 * Actualiza la barra de progreso y las estadísticas.
 */
function updateProgress() {
    const progress = (gameState.answeredCount / gameState.questions.length) * 100;
    DOM.progressBar.style.width = `${progress}%`;
    
    // Actualizar todas las estadísticas visibles
    DOM.statsCorrect.textContent = gameState.correctAnswers;
    DOM.statsError.textContent = gameState.errorAnswers;
    DOM.statsStreak.textContent = gameState.currentStreak;
}

/**
 * Muestra la siguiente pregunta o finaliza el juego.
 */
function showNextQuestion() {
    if (gameState.answeredCount >= gameState.questions.length) {
        endGame();
        return;
    }
    
    // Cargar pregunta actual
    gameState.currentQuestionIndex = gameState.answeredCount;
    const q = gameState.questions[gameState.currentQuestionIndex];

    DOM.currentQuestionIndexDisplay.textContent = gameState.currentQuestionIndex + 1;
    DOM.totalQuestionsDisplay.textContent = gameState.questions.length;
    DOM.questionText.textContent = `${q.factor1} x ${q.factor2} = ?`;

    // Limpiar y mostrar el área de respuesta según el tipo
    DOM.answerTypeWrite.classList.remove('active');
    DOM.answerTypeMultiple.classList.remove('active');

    if (gameState.questionType === 'escribir') {
        DOM.answerTypeWrite.classList.add('active');
        DOM.answerInput.value = '';
        DOM.answerInput.style.borderColor = window.var_primary_color || '#ddd'; // Resetear color
        DOM.answerInput.focus();
    } else { // Opción Múltiple
        DOM.answerTypeMultiple.classList.add('active');
        renderMultipleChoice(q.result);
    }
    
    updateProgress();
}

/**
 * Renderiza los botones de opción múltiple.
 */
function renderMultipleChoice(correctResult) {
    DOM.answerTypeMultiple.innerHTML = '';
    const options = generateDistractors(correctResult);
    options.push(correctResult);
    options.sort(() => Math.random() - 0.5); // Barajar
    
    DOM.answerTypeMultiple.className = 'multiple-options-grid active';
    
    options.forEach(option => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.textContent = option;
        btn.dataset.value = option;
        btn.disabled = false;
        
        btn.addEventListener('click', (e) => {
            // Deshabilitar todos los botones inmediatamente
            document.querySelectorAll('#answer-type-multiple .option-btn').forEach(b => b.disabled = true);
            
            checkAnswer(parseInt(e.target.dataset.value), btn);
            
            // Avanzar después del feedback
            setTimeout(() => {
                gameState.answeredCount++; 
                showNextQuestion();
            }, 1000); 
        });
        
        DOM.answerTypeMultiple.appendChild(btn);
    });
}

/**
 * Verifica la respuesta del usuario (Lógica central del juego).
 */
function checkAnswer(userAnswer, targetElement = null) {
    const currentQ = gameState.questions[gameState.currentQuestionIndex];
    const isCorrect = userAnswer === currentQ.result;
    
    if (isCorrect) {
        // Acierto
        gameState.correctAnswers++;
        gameState.currentStreak++;
        gameState.maxStreak = Math.max(gameState.maxStreak, gameState.currentStreak);
        
        playSound(AUDIO.CORRECT);
        triggerConfetti(100);
        
        if (targetElement) {
            targetElement.classList.add('correct-feedback');
        } else {
            // Feedback verde y avance inmediato en modo 'escribir'
            DOM.answerInput.style.borderColor = window.var_success_color;
            gameState.answeredCount++;
            setTimeout(showNextQuestion, 300); 
        }
        
    } else {
        // Error
        gameState.errorAnswers++;
        gameState.currentStreak = 0;
        
        playSound(AUDIO.ERROR);
        
        if (targetElement) {
            targetElement.classList.add('error-feedback');
            // Muestra la respuesta correcta para aprender
            document.querySelectorAll('#answer-type-multiple .option-btn').forEach(btn => {
                if (parseInt(btn.dataset.value) === currentQ.result) {
                    btn.classList.add('correct-feedback');
                }
            });
        } else {
            // Vibración y borde rojo en modo 'escribir'
            DOM.appContainer.classList.add('vibrate');
            DOM.answerInput.style.borderColor = window.var_error_color;
            setTimeout(() => {
                DOM.appContainer.classList.remove('vibrate');
                // No avanza, el usuario debe corregir
            }, 500);
        }
    }
    updateProgress();
}

/**
 * Finaliza el juego, detiene el tiempo y muestra el certificado.
 */
function endGame() {
    stopTimer();
    
    // 1. Confeti de victoria y sonido
    triggerConfetti(500, true);
    playSound(AUDIO.VICTORY); 
    
    // 2. Transición a pantalla de certificado
    switchScreen('certificate-screen');
    
    // 3. Generar y mostrar certificado
    const totalQuestions = gameState.questions.length;
    
    let medal = '';
    // Lógica de medallas: Oro (0 errores), Plata (~10%), Bronce (~20%)
    if (gameState.errorAnswers === 0) {
        medal = '🏅 Oro Perfecto';
    } else if (gameState.errorAnswers <= Math.ceil(totalQuestions * 0.1)) {
        medal = '🥈 Plata (Casi Perfecto)';
    } else if (gameState.errorAnswers <= Math.ceil(totalQuestions * 0.2)) {
        medal = '🥉 Bronce';
    } else {
        medal = '⭐ Participación';
    }

    // Llenar campos del certificado
    DOM.certStudentName.textContent = gameState.studentName;
    DOM.certTableNumber.textContent = gameState.tableNumber;
    DOM.certFinalName.textContent = gameState.studentName;
    DOM.certFinalTableNumber.textContent = gameState.tableNumber;
    DOM.certCorrect.textContent = gameState.correctAnswers;
    DOM.certError.textContent = gameState.errorAnswers;
    DOM.certMaxStreak.textContent = gameState.maxStreak;
    DOM.certTime.textContent = formatTime(gameState.totalTime);
    DOM.certMedal.textContent = medal;
    DOM.certDate.textContent = new Date().toLocaleDateString('es-ES');
    
    saveHighScore(gameState.tableNumber, gameState.totalTime, gameState.errorAnswers);
}

// ========================================
// 5. EVENT LISTENERS (Conexión de la lógica)
// ========================================

/**
 * Manejador principal para iniciar el juego.
 */
DOM.startGameBtn.addEventListener('click', () => {
    const name = DOM.studentNameInput.value.trim() || "Multi-Aventurero/a";
    if (DOM.tableSelect.value === "") {
        alert('¡Por favor, elige una tabla!');
        return;
    }
    
    // Guardar la configuración en el estado
    gameState.studentName = name;
    gameState.tableNumber = parseInt(DOM.tableSelect.value);
    gameState.gameMode = document.querySelector('input[name="game-mode"]:checked').value;
    gameState.questionType = document.querySelector('input[name="question-type"]:checked').value;
    
    resetGameState();
    gameState.questions = generateQuestions();
    
    DOM.playerNameDisplay.textContent = gameState.studentName;
    
    switchScreen('game-screen');
    startTimer();
    showNextQuestion();
});

/**
 * Listener para el botón de verificar respuesta (Modo Escribir).
 * ¡Lógica de verificación funcional!
 */
DOM.submitAnswerBtn.addEventListener('click', () => {
    const answer = parseInt(DOM.answerInput.value); 
    if (!isNaN(answer)) {
        checkAnswer(answer);
        // Si es incorrecto, el foco se mantiene para corregir. Si es correcto, showNextQuestion se encarga del foco.
    } else {
        alert("Por favor, introduce un número.");
    }
});

/**
 * Listener para permitir la verificación al presionar Enter en el input.
 */
DOM.answerInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        DOM.submitAnswerBtn.click();
    }
});

/**
 * Listener para imprimir/guardar el certificado.
 */
DOM.printCertBtn.addEventListener('click', () => {
    window.print();
});

/**
 * Listener para reiniciar el juego.
 */
DOM.restartGameBtn.addEventListener('click', () => {
    switchScreen('config-screen');
    resetGameState();
});

/**
 * Listener para el toggle de sonido.
 */
DOM.soundToggle.addEventListener('change', (e) => {
    gameState.soundEnabled = e.target.checked;
});

// ========================================
// 6. FUNCIONES DE SISTEMA Y UTILIDAD
// ========================================

/**
 * Alterna la visibilidad de las pantallas.
 */
function switchScreen(screenId) {
    const allScreens = [DOM.configScreen, DOM.gameScreen, DOM.certificateScreen];
    
    allScreens.forEach(screen => {
        if (screen.id === screenId) {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    });
}

/**
 * Restablece todas las estadísticas del juego.
 */
function resetGameState() {
    gameState.questions = [];
    gameState.currentQuestionIndex = 0;
    gameState.startTime = null;
    stopTimer();
    gameState.timerInterval = null;
    gameState.correctAnswers = 0;
    gameState.errorAnswers = 0;
    gameState.currentStreak = 0;
    gameState.maxStreak = 0;
    gameState.totalTime = 0;
    gameState.answeredCount = 0;
    
    // Limpiar UI
    DOM.gameTimer.textContent = '00:00';
    DOM.progressBar.style.width = '0%';
    updateProgress();
}

/**
 * Inicializa la librería de confeti y lo dispara.
 */
function triggerConfetti(particleCount, bigExplosion = false) {
    // Si ya existe una instancia de confeti (por acierto rápido), la limpiamos para no sobrecargar
    if (confettiInstance) {
        confettiInstance.clear();
        confettiInstance = null;
    }
    
    confettiInstance = new ConfettiGenerator({
        target: DOM.confettiCanvas,
        max: bigExplosion ? 300 : 80, 
        size: bigExplosion ? 2 : 1.2,
        animate: true,
        props: ['circle', 'square', 'triangle', 'line'],
        colors: [[165, 104, 246], [230, 61, 135], [0, 199, 228], [253, 214, 126]],
        clock: 30, 
        elementCount: bigExplosion ? 300 : particleCount,
        duration: bigExplosion ? 4000 : 800,
    });
    
    confettiInstance.render();
    
    // Limpiar el confeti después de su duración
    setTimeout(() => {
        if (confettiInstance) {
            confettiInstance.clear();
            confettiInstance = null; 
        }
    }, bigExplosion ? 4000 : 800);
}

/**
 * Guarda el récord en localStorage (Extra).
 */
function saveHighScore(table, time, errors) {
    try {
        const key = `multi_score_table_${table}`;
        const currentRecord = JSON.parse(localStorage.getItem(key)) || { time: Infinity, errors: Infinity };
        
        // El récord es mejor si tiene menos tiempo o, si el tiempo es similar, menos errores.
        if (time < currentRecord.time || (time === currentRecord.time && errors < currentRecord.errors)) {
            const newRecord = {
                time: time,
                errors: errors,
                date: new Date().toISOString(),
                player: gameState.studentName
            };
            localStorage.setItem(key, JSON.stringify(newRecord));
            console.log(`¡Nuevo récord para la Tabla del ${table}!`, newRecord);
        }
    } catch (e) {
        console.warn("LocalStorage no disponible o error al guardar récord:", e);
    }
}


// ========================================
// 7. INICIALIZACIÓN
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    populateTableSelector();
    
    // Obtener los colores CSS (variables) para usarlos en JS para el feedback de input
    const style = getComputedStyle(document.documentElement);
    window.var_success_color = style.getPropertyValue('--success-color').trim();
    window.var_error_color = style.getPropertyValue('--error-color').trim();
    window.var_primary_color = style.getPropertyValue('--primary-color').trim(); // Para resetear el borde
    
    // Asegurar que la pantalla de inicio esté visible
    switchScreen('config-screen');
});