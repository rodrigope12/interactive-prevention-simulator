/**
 * Smoking Simulator V2.0 - Game Logic
 * Based on real medical research (UCL/UK, WHO, CDC)
 */

// ========================================
// GAME STATE
// ========================================

const GameState = {
    ageInMonths: 216,       // Start at 18 years
    biologicalAgeInMonths: 216,
    health: 100,            // General Stamina
    toxicity: 0,
    addiction: 0,
    hunger: 0,              // 0-100% (0 = Full, 100 = Starving)
    inactivity: 0,          // 0-100% (0 = Active, 100 = Sedentary)
    cigarettesSmoked: 0,
    lifeLostMinutes: 0,
    monthsSinceLastSmoke: 0,
    bestRecoveryStreak: 0,
    lastInteraction: Date.now(),
    isDead: false,
    isCollapsed: false,
    isHospitalized: false,
    causeOfDeath: null,
    eventsHistory: []
};

// ========================================
// CONSTANTS
// ========================================
const CONFIG = {
    // Time & Aging
    START_AGE_MONTHS: 216,
    MAX_LIFESPAN_MONTHS: 960,
    MONTHS_PER_TICK: 1,

    // Bio Age Penalties (Per Tick/Action)
    BIO_AGE_PENALTY_PER_PACK: 2,
    BIO_AGE_PENALTY_HUNGER: 1,      // Extra months per tick if starving
    BIO_AGE_PENALTY_INACTIVITY: 0.5, // Extra months per tick if sedentary
    REAL_AGE_PER_ACTION: 1,

    // Per Pack effects
    CIGS_PER_ACTION: 20,            // FIX: Missing constant caused NaN
    HEALTH_LOSS_PER_PACK: 5,
    TOXICITY_GAIN_PER_PACK: 25,
    ADDICTION_GAIN_PER_PACK: 15,

    // Recovery / Lifestyle Rates
    HEALTH_GAIN_PER_ACTION: 10,
    HEALTH_GAIN_PER_EXERCISE: 20,
    TOXICITY_LOSS_PER_EXERCISE: 20,
    TOXICITY_DECAY_PER_TICK: 5,
    ADDICTION_LOSS_PER_ACTION: 3,

    // Lifestyle Gain/Loss
    HUNGER_GAIN_PER_TICK: 2,        // Gets hungry fast
    INACTIVITY_GAIN_PER_TICK: 1,    // Gets sedentary slowly
    HUNGER_LOSS_PER_EAT: 50,
    INACTIVITY_LOSS_PER_EXERCISE: 50,

    // Timing
    CRAVING_THRESHOLD_MS: 5000,
    MESSAGE_DURATION_MS: 4000,
    PASSIVE_RECOVERY_RATE: 2,
    PASSIVE_RECOVERY_DELAY_MS: 5000,

    // Thresholds
    TOXICITY_WARNING: 60,
    TOXICITY_COLLAPSE: 100,
    THRESHOLD_HUNGER: 80,           // Warning level
    THRESHOLD_SEDENTARY: 80,        // Warning level
    MIN_REJECTION_ADDICTION: 40,
    MAX_REJECTION_CHANCE: 85,

    // Aging Impact
    AGE_DECAY_START: 216,
    AGE_DECAY_END: 960,
    MAX_AGE_FACTOR: 0.2
};

// Age-Based Disease Risks (Prob starts low, spikes at age)
// We check these against Biological Age
const DISEASES = [
    { name: "Infarto de Miocardio", minAge: 480, prob: 0.05, desc: "Tu corazón envejecido no resistió." }, // 40y
    { name: "EPOC (Enfisema)", minAge: 660, prob: 0.08, desc: "Tus pulmones están destruidos." },          // 55y
    { name: "Cáncer de Pulmón", minAge: 780, prob: 0.1, desc: "Años de humo crearon el tumor." },          // 65y
    { name: "Muerte Natural", minAge: 960, prob: 1.0, desc: "Tu cuerpo simplemente se apagó." }            // 80y
];

// ========================================
// REAL SYMPTOMS DATABASE (Medical Sources)
// ========================================
const SYMPTOMS = {
    smoking: [
        { text: "Tu presión arterial acaba de subir.", source: "American Heart Association" },
        { text: "El monóxido de carbono está reemplazando el oxígeno en tu sangre.", source: "CDC" },
        { text: "Los cilios de tus pulmones acaban de paralizarse.", source: "NIH" },
        { text: "Tus arterias se estrecharon. Tu corazón trabaja más.", source: "WHO" },
        { text: "Nicotina llegó a tu cerebro en 10 segundos.", source: "Cleveland Clinic" }
    ],
    craving: [
        { text: "Siento ansiedad... necesito fumar.", source: "Síndrome de Abstinencia" },
        { text: "No puedo concentrarme. Solo pienso en eso.", source: "Withdrawal Day 1-3" },
        { text: "Me tiemblan las manos. Dame solo uno.", source: "Síntoma Físico Real" },
        { text: "Estoy irritable. Todo me molesta.", source: "Nicotine Withdrawal" }
    ],
    recovery: [
        { text: "20 minutos sin fumar: Mi pulso está volviendo a la normalidad.", source: "WHO Timeline" },
        { text: "¡La comida empieza a saber mejor!", source: "48h Recovery" },
        { text: "Respiro un poco más fácil hoy.", source: "2 Weeks Recovery" },
        { text: "Mi riesgo de infarto acaba de bajar un poco.", source: "1 Year Milestone" }
    ],
    rejection: [
        { text: "NO QUIERO ESO. Dame lo otro.", source: "Adicción Activa" },
        { text: "Ahora no... después como sano.", source: "Racionalización" },
        { text: "Solo un cigarro más y luego paro.", source: "Autoengaño" }
    ],
    toxicity: [
        { text: "Me siento mareado...", source: "Intoxicación Leve" },
        { text: "Tengo ganas de vomitar.", source: "Sistema Nervioso" },
        { text: "Me zumban los oídos.", source: "Presión Arterial" },
        { text: "Todo me da vueltas.", source: "Vértigo" }
    ],
    exercise: [
        { text: "Tu capacidad pulmonar mejora.", source: "Recuperación Activa" },
        { text: "Tu corazón late más fuerte y sano.", source: "Cardio 30 min" },
        { text: "Estás sudando las toxinas.", source: "Metabolismo" },
        { text: "La ansiedad ha bajado notablemente.", source: "Endorfinas" }
    ],
    passive: [
        { text: "Tu cuerpo se está limpiando solo.", source: "Recuperación Pasiva" },
        { text: "La presión arterial se normaliza.", source: "Abstinencia" }
    ]
};

const DEFAULT_MESSAGE = {
    text: "Hola. Soy tu reflejo. ¿Qué harás conmigo?",
    source: "Simulador"
};

// ========================================
// DOM REFERENCES
// ========================================
const UI = {
    body: document.body,
    healthValue: document.getElementById('health-value'),
    addictionValue: document.getElementById('addiction-value'),
    addictionCard: document.getElementById('addiction-card'),
    lifeLostCard: document.getElementById('life-lost-card'),
    lifeLostValue: document.getElementById('life-lost-value'),
    toxicityValue: document.getElementById('toxicity-value'),
    hungerValue: document.getElementById('hunger-value'),
    inactivityValue: document.getElementById('inactivity-value'),
    toxicityBar: document.getElementById('toxicity-bar'),
    hungerBar: document.getElementById('hunger-bar'),
    inactivityBar: document.getElementById('inactivity-bar'),
    streakValue: document.getElementById('streak-value'),
    packsValue: document.getElementById('packs-value'),
    riskScoreValue: document.getElementById('risk-score-value'),
    riskNote: document.getElementById('risk-note'),
    riskPill: document.getElementById('risk-pill'),
    character: document.getElementById('character'),
    messageCard: document.querySelector('#message-area .glass-card'),
    gameMessage: document.getElementById('game-message'),
    messageSource: document.getElementById('message-source'),
    thoughtBubble: document.getElementById('thought-bubble'),
    smokeCloud: document.getElementById('smoke-cloud'),
    modal: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalReset: document.getElementById('modal-reset')
};

// ========================================
// INITIALIZATION
// ========================================
function init() {
    loadState();
    restoreSessionFlags();

    document.getElementById('btn-smoke').addEventListener('click', actionSmoke);
    document.getElementById('btn-heal').addEventListener('click', actionHeal);
    document.getElementById('btn-exercise').addEventListener('click', actionExercise);

    UI.modalReset.addEventListener('click', resetGame);

    renderPersistentMessage();
    updateUI();
    restoreModalState();
    startGameLoop();
}

function loadState() {
    const saved = localStorage.getItem('smokingsim_v2');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(GameState, parsed);

            sanitizeLoadedState();
        } catch (e) {
            console.error("Save corrupted, resetting", e);
            // Default GameState is already set
        }
    }
}

function saveState() {
    localStorage.setItem('smokingsim_v2', JSON.stringify(GameState));
}

function sanitizeLoadedState() {
    const numericFields = [
        ['ageInMonths', CONFIG.START_AGE_MONTHS, CONFIG.MAX_LIFESPAN_MONTHS],
        ['biologicalAgeInMonths', CONFIG.START_AGE_MONTHS, CONFIG.MAX_LIFESPAN_MONTHS + 240],
        ['health', 0, 100],
        ['toxicity', 0, 100],
        ['addiction', 0, 100],
        ['hunger', 0, 100],
        ['inactivity', 0, 100],
        ['cigarettesSmoked', 0, 1000000],
        ['monthsSinceLastSmoke', 0, 100000],
        ['bestRecoveryStreak', 0, 100000],
        ['lastInteraction', 0, Number.MAX_SAFE_INTEGER]
    ];

    for (const [key, min, max] of numericFields) {
        const value = Number(GameState[key]);
        const fallback = key.includes('Age') ? CONFIG.START_AGE_MONTHS : 0;
        GameState[key] = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    }

    GameState.lastInteraction = GameState.lastInteraction || Date.now();
    GameState.isDead = Boolean(GameState.isDead);
    GameState.isCollapsed = Boolean(GameState.isCollapsed);
    GameState.isHospitalized = Boolean(GameState.isHospitalized);
    GameState.eventsHistory = Array.isArray(GameState.eventsHistory) ? GameState.eventsHistory : [];
    GameState.bestRecoveryStreak = Math.max(GameState.bestRecoveryStreak, GameState.monthsSinceLastSmoke);
    GameState.biologicalAgeInMonths = Math.max(GameState.biologicalAgeInMonths, GameState.ageInMonths);

    if (!GameState.causeOfDeath || typeof GameState.causeOfDeath !== 'object') {
        GameState.causeOfDeath = null;
    }
}

function restoreSessionFlags() {
    if (GameState.isCollapsed) {
        GameState.isCollapsed = false;
        GameState.toxicity = Math.min(GameState.toxicity, 50);
        saveState();
        showMessage({
            text: "Volviste tras un colapso. Tu cuerpo sigue bajo presión.",
            source: "Reingreso"
        });
    }
}

function restoreModalState() {
    if (GameState.isDead) {
        triggerDeath(GameState.causeOfDeath || {
            name: "Fallo sistémico",
            desc: "Tu cuerpo no soportó la acumulación de daño."
        });
    }
}

function markInteraction() {
    GameState.lastInteraction = Date.now();
}

// ========================================
// CORE ACTIONS
// ========================================
function actionSmoke() {
    if (GameState.isDead || GameState.isCollapsed) return;

    // Acute Toxicity Check (Vomiting/Dizziness)
    if (GameState.toxicity >= CONFIG.TOXICITY_COLLAPSE) {
        triggerCollapse();
        return;
    }

    // ACTION: 1 Click = 1 Action Time + Smoking Damage

    // 1. Time Passes (Real Age)
    GameState.ageInMonths += CONFIG.REAL_AGE_PER_ACTION;

    // 2. Biological Aging (Accelerated)
    // 1 Pack = +2 Months extra
    GameState.biologicalAgeInMonths += (CONFIG.REAL_AGE_PER_ACTION + CONFIG.BIO_AGE_PENALTY_PER_PACK);

    // 3. Acute Stats
    GameState.health = Math.max(0, GameState.health - CONFIG.HEALTH_LOSS_PER_PACK); // Stamina drain
    GameState.addiction = Math.min(100, GameState.addiction + CONFIG.ADDICTION_GAIN_PER_PACK);
    GameState.toxicity = Math.min(100, GameState.toxicity + CONFIG.TOXICITY_GAIN_PER_PACK);

    GameState.cigarettesSmoked += CONFIG.CIGS_PER_ACTION;
    GameState.monthsSinceLastSmoke = 0;
    markInteraction();

    // Effects & Feedback
    triggerSmokeEffect();

    // Check specific risk on ACTION (Active Risk)
    // Every pack rolls a dice based on Bio Age
    checkActionRisk();
    if (GameState.isDead) return;

    // Acute Warning
    if (GameState.toxicity > CONFIG.TOXICITY_WARNING) {
        showMessage(getRandomItem(SYMPTOMS.toxicity));
        UI.character.classList.add('shake');
        setTimeout(() => UI.character.classList.remove('shake'), 500);
    } else {
        const gap = Math.floor((GameState.biologicalAgeInMonths - GameState.ageInMonths) / 12);
        if (gap > 5) showMessage({ text: `Tu cuerpo es ${gap} años más viejo que tú.`, source: "Envejecimiento Acelerado" });
        else showMessage(getRandomItem(SYMPTOMS.smoking));
    }

    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    if (checkCriticalConditions()) return;
    saveState();
    updateUI();
}

function checkActionRisk() {
    // 1% Chance to trigger a check per pack?
    // Or check if Bio Age crossed a threshold recently?
    // For now, simple random check weighted by age
    const riskFactor = (GameState.biologicalAgeInMonths - 480) / 480; // Starts becoming relevant after 40y
    if (riskFactor > 0 && Math.random() < (0.01 * riskFactor)) {
        // Find a disease that matches age
        const d = DISEASES.find(d => GameState.biologicalAgeInMonths >= d.minAge && d.name !== "Muerte Natural");
        if (d) triggerDeath(d);
    }
}

function getRecoveryFactor() {
    // Linear decay from 18y (100%) to 80y (20%)
    // Real life: Healing is ~4x slower in elderly.
    const age = GameState.biologicalAgeInMonths;
    if (age <= CONFIG.AGE_DECAY_START) return 1.0;
    if (age >= CONFIG.AGE_DECAY_END) return 0.2;

    const range = CONFIG.AGE_DECAY_END - CONFIG.AGE_DECAY_START;
    const progress = (age - CONFIG.AGE_DECAY_START) / range;
    return 1.0 - (progress * 0.8); // drops to 0.2
}

function actionHeal() { // "Comer Sano"
    if (GameState.isDead || GameState.isCollapsed || GameState.isHospitalized) return;

    // Addiction rejection mechanic
    if (GameState.addiction > CONFIG.MIN_REJECTION_ADDICTION) {
        const rejectionChance = Math.min(GameState.addiction, CONFIG.MAX_REJECTION_CHANCE);
        if (Math.random() * 100 < rejectionChance) {
            showMessage(getRandomItem(SYMPTOMS.rejection));
            UI.character.classList.add('shake');
            setTimeout(() => UI.character.classList.remove('shake'), 500);
            return;
        }
    }

    // Age-Dependent Recovery
    const factor = getRecoveryFactor();
    const amount = CONFIG.HEALTH_GAIN_PER_ACTION * factor;

    // Eat Effect (Scale: 1 Click = 1 Month of Food)
    GameState.hunger = 0; // Fully reset

    // Apply healing
    GameState.health = Math.min(100, GameState.health + amount);
    GameState.addiction = Math.max(0, GameState.addiction - CONFIG.ADDICTION_LOSS_PER_ACTION);
    markInteraction();

    // Feedback 
    showMessage({ text: "Comida nutritiva para un mes completo.", source: "Dieta Saludable" });

    if (checkCriticalConditions()) return;
    saveState();
    updateUI();
}

function actionExercise() {
    if (GameState.isDead || GameState.isCollapsed || GameState.isHospitalized) return;

    const factor = getRecoveryFactor();

    // Exercise Effect
    GameState.inactivity = Math.max(0, GameState.inactivity - CONFIG.INACTIVITY_LOSS_PER_EXERCISE);

    // Apply gains
    GameState.health = Math.min(100, GameState.health + (CONFIG.HEALTH_GAIN_PER_EXERCISE * factor));
    GameState.toxicity = Math.max(0, GameState.toxicity - (CONFIG.TOXICITY_LOSS_PER_EXERCISE * factor));
    GameState.addiction = Math.max(0, GameState.addiction - (CONFIG.ADDICTION_LOSS_PER_ACTION * 2));
    markInteraction();

    // Visual feedback
    UI.character.classList.add('bounce');
    setTimeout(() => UI.character.classList.remove('bounce'), 500);

    if (factor < 0.6) {
        showMessage({ text: "Te cuesta respirar al ejercitarte.", source: "Capacidad Pulmonar Reducida" });
    } else {
        showMessage(getRandomItem(SYMPTOMS.exercise));
    }

    if (checkCriticalConditions()) return;
    saveState();
    updateUI();
}

// ========================================
// UI UPDATE
// ========================================
// ========================================
// UI UPDATE
// ========================================
function updateUI() {
    const risk = getRiskSnapshot();

    // Numeric displays
    UI.healthValue.textContent = `${Math.round(GameState.health)}%`;
    UI.addictionValue.textContent = `${Math.round(GameState.addiction)}%`;
    UI.toxicityValue.textContent = `${Math.round(GameState.toxicity)}%`;
    UI.hungerValue.textContent = `${Math.round(GameState.hunger)}%`;
    UI.inactivityValue.textContent = `${Math.round(GameState.inactivity)}%`;

    UI.toxicityBar.style.width = `${GameState.toxicity}%`;
    UI.hungerBar.style.width = `${GameState.hunger}%`;
    UI.inactivityBar.style.width = `${GameState.inactivity}%`;

    // Timeline / Age Display
    UI.lifeLostCard.classList.remove('hidden');

    // Calculate Years
    const realAgeYears = Math.floor(GameState.ageInMonths / 12);
    const bioAgeYears = Math.floor(GameState.biologicalAgeInMonths / 12);
    const lostYears = bioAgeYears - realAgeYears; // explicitly calculated "lost" time

    // Color coding for Lost Years
    let lostColor = '#4caf50'; // Green (Good)
    if (lostYears > 2) lostColor = '#ffeb3b'; // Yellow
    if (lostYears > 10) lostColor = '#ff4444'; // Red

    UI.lifeLostValue.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:flex-start">
            <span style="font-size:0.8rem; color:#aaa">Edad Real: <strong style="color:#fff">${realAgeYears}</strong></span>
            <span style="font-size:0.8rem; color:#aaa">Edad Bio: <strong style="color:${lostColor}">${bioAgeYears}</strong></span>
            <span style="font-size:0.7rem; margin-top:2px; border-top:1px solid #444; width:100%">
                Perdidos: <span style="color:${lostColor}">+${lostYears} años</span>
            </span>
        </div>
    `;

    UI.streakValue.textContent = Math.floor(GameState.monthsSinceLastSmoke);
    UI.packsValue.textContent = Math.floor(GameState.cigarettesSmoked / CONFIG.CIGS_PER_ACTION);
    UI.riskScoreValue.textContent = risk.score;
    UI.riskNote.textContent = risk.note;

    UI.riskPill.textContent = risk.label;
    UI.riskPill.className = `risk-pill ${risk.className}`;

    // Addiction warning
    if (GameState.addiction > 50) {
        UI.addictionCard.classList.add('stat-warning');
    } else {
        UI.addictionCard.classList.remove('stat-warning');
    }

    // Lifestyle Warnings (Visual only for now, could add icons)
    if (GameState.hunger > CONFIG.THRESHOLD_HUNGER) {
        if (Math.random() < 0.05) showMessage({ text: "¡Necesitas comer pronto! Tu cuerpo se debilita.", source: "Hambre" });
    }
    if (GameState.inactivity > CONFIG.THRESHOLD_SEDENTARY) {
        if (Math.random() < 0.05) showMessage({ text: "¡Estás muy sedentario! Tus células envejecen.", source: "Inactividad" });
    }

    // Body & Character State (Based on Bio Age)
    updateVisualState(risk);
    updateThoughtBubble(risk);

    if (!currentMessageTimeout) {
        renderPersistentMessage();
    }

    // Check Death (Age Based)
    checkMortality();
}

function updateVisualState(risk) {
    // Character gets "Old" visually?
    UI.body.classList.remove('state-healthy', 'state-warning', 'state-danger');
    UI.character.classList.remove('state-healthy', 'state-sick', 'state-critical');

    UI.body.classList.add(risk.bodyState);

    // Filter grey based on age? 
    // Or just use health for acute states
    if (GameState.health < 30) {
        UI.character.classList.add('state-critical'); // Exhausted
    } else if (GameState.biologicalAgeInMonths > 720) { // 60y
        UI.character.classList.add('state-sick'); // Old/Worn
    } else {
        UI.character.classList.add('state-healthy');
    }
}

function updateThoughtBubble(risk) {
    if (GameState.isDead || GameState.isCollapsed) {
        UI.thoughtBubble.classList.remove('visible');
        return;
    }

    let bubble = '';

    if (GameState.addiction >= 60) bubble = '🚬';
    else if (GameState.hunger >= CONFIG.THRESHOLD_HUNGER) bubble = '🍽️';
    else if (GameState.inactivity >= CONFIG.THRESHOLD_SEDENTARY) bubble = '🏃';
    else if (risk.score <= 30 && GameState.monthsSinceLastSmoke >= 6) bubble = '✨';

    if (!bubble) {
        UI.thoughtBubble.classList.remove('visible');
        return;
    }

    UI.thoughtBubble.textContent = bubble;
    UI.thoughtBubble.classList.add('visible');
}

function checkMortality() {
    if (GameState.isDead) return;

    // Check Max Lifespan
    if (GameState.biologicalAgeInMonths >= CONFIG.MAX_LIFESPAN_MONTHS) {
        triggerDeath(DISEASES.find(d => d.name === "Muerte Natural"));
        return;
    }

    // Check Disease Risks per tick
    // We only check this occasionally or on specific milestones
    // For simplicity, random chance increases with age gap

    // Find applicable diseases
    const riskyDiseases = DISEASES.filter(d => GameState.biologicalAgeInMonths >= d.minAge && d.name !== "Muerte Natural");

    for (const d of riskyDiseases) {
        // Base probability per ticking month is very low naturally, 
        // but smoking events trigger "Risk Checks".
        // Here we just check if we are unlucky on a tick? 
        // Better to check on "Action" to avoid random death while idle
        // BUT natural death should happen while idle.

        // Very small chance per tick? 
        if (Math.random() < 0.0005) { // Rare random event per second
            triggerDeath(d);
        }
    }
}

function getRiskSnapshot() {
    const ageGapYears = Math.max(0, (GameState.biologicalAgeInMonths - GameState.ageInMonths) / 12);
    const score = Math.round(
        ((100 - GameState.health) * 0.28) +
        (GameState.toxicity * 0.24) +
        (GameState.addiction * 0.18) +
        (GameState.hunger * 0.12) +
        (GameState.inactivity * 0.08) +
        (Math.min(100, ageGapYears * 8) * 0.10)
    );

    if (score >= 80 || GameState.health <= 20 || GameState.toxicity >= 85) {
        return {
            score,
            label: "Crítico",
            className: "risk-critical",
            bodyState: "state-danger",
            note: "La mezcla de daño acumulado y desgaste agudo ya es compatible con colapso."
        };
    }

    if (score >= 55 || GameState.addiction >= 60 || GameState.toxicity >= CONFIG.TOXICITY_WARNING) {
        return {
            score,
            label: "Alto",
            className: "risk-high",
            bodyState: "state-danger",
            note: "Tu organismo está compensando como puede. Una cajetilla más acelera mucho el daño."
        };
    }

    if (score >= 30 || GameState.hunger >= 60 || GameState.inactivity >= 60) {
        return {
            score,
            label: "Vigilancia",
            className: "risk-medium",
            bodyState: "state-warning",
            note: "Todavía hay margen para revertir, pero ya aparecen señales de deterioro."
        };
    }

    return {
        score,
        label: "Estable",
        className: "risk-low",
        bodyState: "state-healthy",
        note: "Tu cuerpo sigue estable. Lo peligroso es acostumbrarse a hacer daño sin sentirlo de inmediato."
    };
}

// ========================================
// EFFECTS & FEEDBACK
// ========================================
function triggerSmokeEffect() {
    UI.smokeCloud.classList.remove('active');
    void UI.smokeCloud.offsetWidth; // Force reflow
    UI.smokeCloud.classList.add('active');
}

let currentMessageTimeout = null;

function renderPersistentMessage() {
    const ambientMessage = getAmbientMessage();
    UI.gameMessage.textContent = ambientMessage.text;
    UI.messageSource.textContent = ambientMessage.source ? `— ${ambientMessage.source}` : '';
    UI.messageCard.classList.add('visible');
}

function showMessage(symptom) {
    // Clear previous timeout if exists (Instant Swap)
    if (currentMessageTimeout) {
        clearTimeout(currentMessageTimeout);
        UI.messageCard.classList.remove('visible');
        void UI.messageCard.offsetWidth; // Force reflow
    }

    UI.gameMessage.textContent = symptom.text;
    UI.messageSource.textContent = symptom.source ? `— ${symptom.source}` : '';

    UI.messageCard.classList.add('visible');

    currentMessageTimeout = setTimeout(() => {
        renderPersistentMessage();
        currentMessageTimeout = null;
    }, CONFIG.MESSAGE_DURATION_MS);
}

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getAmbientMessage() {
    if (GameState.isDead) {
        return {
            text: GameState.causeOfDeath?.desc || DEFAULT_MESSAGE.text,
            source: GameState.causeOfDeath?.name || DEFAULT_MESSAGE.source
        };
    }

    if (GameState.addiction >= 65) {
        return { text: "La adicción está decidiendo por ti. Cada pausa sin fumar vale más ahora.", source: "Dependencia" };
    }

    if (GameState.toxicity >= CONFIG.TOXICITY_WARNING) {
        return { text: "Tus síntomas ya no son invisibles. Tu cuerpo te está avisando con claridad.", source: "Toxicidad" };
    }

    if (GameState.hunger >= CONFIG.THRESHOLD_HUNGER) {
        return { text: "Sin nutrición suficiente, no solo pierdes energía: también envejeces más rápido.", source: "Hambre" };
    }

    if (GameState.inactivity >= CONFIG.THRESHOLD_SEDENTARY) {
        return { text: "Estar quieto demasiado tiempo también envejece. Muévete antes de normalizarlo.", source: "Sedentarismo" };
    }

    if (GameState.monthsSinceLastSmoke >= 12) {
        return { text: "Llevas un año simulado sin fumar. El beneficio es real, aunque no se vea en una sola acción.", source: "Recuperación" };
    }

    return DEFAULT_MESSAGE;
}

// ========================================
// GAME LOOP (Craving System)
// ========================================
// ========================================
// GAME LOOP (Natural Aging)
// ========================================
// ========================================
// GAME LOOP (Natural Aging + Lifestyle)
// ========================================
function startGameLoop() {
    setInterval(() => {
        if (GameState.isDead || GameState.isCollapsed) return;

        // 1. Natural Aging (1 Month per second)
        GameState.ageInMonths += CONFIG.MONTHS_PER_TICK;
        GameState.monthsSinceLastSmoke += CONFIG.MONTHS_PER_TICK;
        GameState.bestRecoveryStreak = Math.max(GameState.bestRecoveryStreak, GameState.monthsSinceLastSmoke);
        let bioAcceleration = CONFIG.MONTHS_PER_TICK;

        // 2. Lifestyle Decay
        GameState.hunger = Math.min(100, GameState.hunger + CONFIG.HUNGER_GAIN_PER_TICK);
        GameState.inactivity = Math.min(100, GameState.inactivity + CONFIG.INACTIVITY_GAIN_PER_TICK);

        // 3. Penalties for Neglect & Progressive Decay
        // Ref: Physio effects of starvation (Glycogen depletion -> Fat oxidation -> Protein catabolism)

        // Stage 1: Malnutrition (50% - 80%)
        // Minor weakness, slow health drain.
        if (GameState.hunger > 50 && GameState.hunger <= CONFIG.THRESHOLD_HUNGER) {
            GameState.health = Math.max(0, GameState.health - 0.2);
        }

        // Stage 2: Severe Starvation (> 80%)
        // Rapid weight loss, organ stress. Fast health drain + Aging.
        if (GameState.hunger > CONFIG.THRESHOLD_HUNGER) {
            bioAcceleration += CONFIG.BIO_AGE_PENALTY_HUNGER;
            GameState.health = Math.max(0, GameState.health - 1.0);
        }

        // Stage 3: Terminal Starvation (100%)
        // Catabolism of vital organs. Extremely rapid death.
        if (GameState.hunger >= 100) {
            GameState.health = Math.max(0, GameState.health - 5.0);
            // We let them die by Health = 0 naturally below, or trigger special check
            if (GameState.health <= 0) {
                triggerDeath({ name: "Inanición", desc: "Fallo multiorgánico por falta de nutrientes." });
                return;
            }
        }

        if (GameState.inactivity > CONFIG.THRESHOLD_SEDENTARY) {
            bioAcceleration += CONFIG.BIO_AGE_PENALTY_INACTIVITY;
        }

        GameState.biologicalAgeInMonths += bioAcceleration;

        // 4. Passive Recovery (Stamina/Toxicity)
        const idleTime = Date.now() - GameState.lastInteraction;

        // Recover Stamina/Health if idle AND not starving
        if (idleTime > CONFIG.PASSIVE_RECOVERY_DELAY_MS && GameState.health < 100 && GameState.hunger < 50) {
            GameState.health = Math.min(100, GameState.health + CONFIG.PASSIVE_RECOVERY_RATE);
        }

        // Decay Toxicity
        if (GameState.toxicity > 0) {
            GameState.toxicity = Math.max(0, GameState.toxicity - CONFIG.TOXICITY_DECAY_PER_TICK);
        }

        if (checkCriticalConditions()) return;
        updateUI(); // Updates visuals and checks for death via checkMortality()
        saveState();
    }, 1000); // 1 Tick = 1 Real Second
}

function checkCriticalConditions() {
    if (GameState.isDead || GameState.isCollapsed) return true;

    if (GameState.health <= 0) {
        triggerDeath({
            name: "Fallo sistémico",
            desc: "El daño acumulado terminó afectando funciones vitales."
        });
        return true;
    }

    if (GameState.toxicity >= CONFIG.TOXICITY_COLLAPSE) {
        triggerCollapse();
        return true;
    }

    return false;
}

// ========================================
// GAME OVER
// ========================================
// ========================================
// GAME OVER & TOXICITY
// ========================================
// ========================================
// DEATH & EVENTS
// ========================================

// Replaces 'Hospitalization' for simplicity in Age Mode for now, or we can add it back later.
// Focusing on the Death Logic first as requested.

function triggerDeath(cause) {
    GameState.isDead = true;
    GameState.causeOfDeath = cause;
    saveState();

    const realAge = Math.floor(GameState.ageInMonths / 12);
    const bioAge = Math.floor(GameState.biologicalAgeInMonths / 12);
    const lostYears = bioAge - realAge;

    // Reusing the modal logic
    UI.modal.classList.add('visible');
    UI.modalTitle.textContent = cause.name === "Muerte Natural" ? "Final de ciclo" : "Juego terminado";

    let titleColor = cause.name === "Muerte Natural" ? "#4caf50" : "#ff4444";

    UI.modalBody.innerHTML = `
        <strong style="color:${titleColor}; font-size: 1.5em">${cause.name}</strong><br>
        <small>${cause.desc}</small><br><br>
        <div style="text-align:left; margin: 20px auto; width: fit-content;">
            💀 <strong>Edad Real:</strong> ${realAge} años<br>
            🧬 <strong>Edad Biológica:</strong> ${bioAge} años<br>
            📉 <strong>Años Perdidos:</strong> ${lostYears} años
        </div>
        Consumiste <strong>${Math.floor(GameState.cigarettesSmoked / 20)} cajetillas</strong>.<br><br>
        <em>${cause.name === "Muerte Natural" ? "Viviste una vida completa." : "Tu vida terminó antes de tiempo."}</em>
    `;

    // Reset button
    UI.modalReset.textContent = "Reencarnar (Reiniciar)";
    UI.modalReset.disabled = false;
}

function resetGame() {
    GameState.ageInMonths = CONFIG.START_AGE_MONTHS;
    GameState.biologicalAgeInMonths = CONFIG.START_AGE_MONTHS;
    GameState.health = 100;
    GameState.addiction = 0;
    GameState.toxicity = 0;
    GameState.hunger = 0;
    GameState.inactivity = 0;
    GameState.cigarettesSmoked = 0;
    GameState.monthsSinceLastSmoke = 0;
    GameState.bestRecoveryStreak = 0;
    GameState.isDead = false;
    GameState.isCollapsed = false;
    GameState.isHospitalized = false;
    GameState.causeOfDeath = null;
    markInteraction();

    UI.modalTitle.textContent = "Colapso";
    UI.modalReset.textContent = "Intentar de nuevo";
    UI.modalReset.disabled = false;
    UI.modal.classList.remove('visible');
    saveState();
    updateUI();
    showMessage({ text: "Tienes 18 años otra vez. Elige sabiamente.", source: "Vida" });
}

// Keeping basic collapse for acute toxicity
function triggerCollapse() {
    if (GameState.isCollapsed) return;

    GameState.isCollapsed = true;
    saveState();
    UI.modalTitle.textContent = "Colapso";
    UI.modalReset.textContent = "Recuperando...";
    UI.modalReset.disabled = true;
    UI.modalBody.innerHTML = `
        <strong>Colapso (Intoxicación)</strong><br>
        Demasiada nicotina de golpe.<br>
        <em>Esperando recuperación...</em>
    `;
    UI.modal.classList.add('visible');

    setTimeout(() => {
        GameState.isCollapsed = false;
        GameState.toxicity = 50;
        UI.modalReset.textContent = "Intentar de nuevo";
        UI.modalReset.disabled = false;
        UI.modal.classList.remove('visible');
        saveState();
        updateUI();
    }, 4000);
}



// ========================================
// START
// ========================================
window.addEventListener('DOMContentLoaded', init);
