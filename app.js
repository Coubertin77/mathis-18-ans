import { ADMIN_PASSWORD, MATHIS_CODE, FINAL_BONUS } from "./firebase-config.js";
import { initFirebase, isFirebaseReady, CATEGORIES } from "./firebase.js";
import * as db from "./firebase.js";
import {
  shuffleBracket,
  getPlayableDuels,
  getProgress,
  calculateScore,
  getChampion,
  getUnlockedRounds,
  ROUNDS,
  getDuelsForRound,
  getAllDuels
} from "./bracket.js";

const app = document.getElementById("app");

let state = {
  screen: "home",
  categoryId: null,
  playerId: null,
  player: null,
  gameState: null,
  items: [],
  itemsMap: {},
  mathisPlayer: null,
  allPlayers: [],
  adminCategory: "musiques",
  recapPlayerId: null,
  unsubscribers: []
};

function cleanup() {
  state.unsubscribers.forEach((fn) => fn());
  state.unsubscribers = [];
}

function itemById(id) {
  return state.itemsMap[id] || { id, title: "?", imageUrl: "" };
}

function resolveImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    return url;
  }
  return url.replace(/^\.\//, "");
}

function renderCard(item, onClick, label) {
  const src = resolveImageUrl(item.imageUrl);
  const imgPart = src
    ? `<div class="img-wrap"><img src="${esc(src)}" alt="${esc(item.title)}" loading="lazy"></div>`
    : `<div class="no-img">🎲</div>`;
  return `
    <div class="duel-card" data-id="${esc(item.id)}">
      ${imgPart}
      <div class="card-title">${esc(item.title)}</div>
      <button class="pick-btn" type="button">${label}</button>
    </div>`;
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function buildRecapDuels(mathisAnswers, playerAnswers, bracketOrder, isMathisView) {
  const duels = getAllDuels(mathisAnswers, bracketOrder);
  if (duels.length === 0) {
    return `<p class="hint">Aucun duel enregistré pour l'instant.</p>`;
  }

  return duels.map((duel, index) => {
    const roundLabel = ROUNDS.find((r) => r.id === duel.roundId)?.label || duel.roundId;
    const itemA = itemById(duel.a);
    const itemB = itemById(duel.b);
    const mathisPick = mathisAnswers[duel.key];
    const guestPick = playerAnswers?.[duel.key];
    const correct = guestPick && mathisPick && guestPick === mathisPick;
    const isFinal = duel.roundId === "finale";

    const roleA = mathisPick === duel.a ? "picked-mathis" : guestPick === duel.a ? (correct ? "picked-correct" : "picked-wrong") : "";
    const roleB = mathisPick === duel.b ? "picked-mathis" : guestPick === duel.b ? (correct ? "picked-correct" : "picked-wrong") : "";

    const status = isMathisView
      ? ""
      : guestPick
        ? correct
          ? `<span class="recap-badge ok">+1 pt${isFinal ? " · bonus possible" : ""}</span>`
          : `<span class="recap-badge ko">0 pt</span>`
        : `<span class="recap-badge pending">Pas répondu</span>`;

    return `
      <div class="recap-duel">
        <div class="recap-duel-head">
          <span>${roundLabel} · Duel ${index + 1}</span>
          ${status}
        </div>
        <div class="recap-match">
          <div class="recap-option ${roleA}">
            ${resolveImageUrl(itemA.imageUrl) ? `<div class="recap-img-wrap"><img src="${esc(resolveImageUrl(itemA.imageUrl))}" alt=""></div>` : `<div class="recap-no-img">🎲</div>`}
            <span class="recap-label">${esc(itemA.title)}</span>
            ${mathisPick === duel.a ? `<span class="recap-tag mathis">Mathis</span>` : ""}
            ${!isMathisView && guestPick === duel.a ? `<span class="recap-tag guest">Invité</span>` : ""}
          </div>
          <div class="recap-vs">VS</div>
          <div class="recap-option ${roleB}">
            ${resolveImageUrl(itemB.imageUrl) ? `<div class="recap-img-wrap"><img src="${esc(resolveImageUrl(itemB.imageUrl))}" alt=""></div>` : `<div class="recap-no-img">🎲</div>`}
            <span class="recap-label">${esc(itemB.title)}</span>
            ${mathisPick === duel.b ? `<span class="recap-tag mathis">Mathis</span>` : ""}
            ${!isMathisView && guestPick === duel.b ? `<span class="recap-tag guest">Invité</span>` : ""}
          </div>
        </div>
        ${!isMathisView && mathisPick ? `<p class="recap-foot">Choix de Mathis : <strong>${esc(itemById(mathisPick).title)}</strong></p>` : ""}
      </div>`;
  }).join("");
}

// --- Screens ---

function renderHome() {
  const backendOk = isFirebaseReady();
  app.innerHTML = `
    <h1>🎂 Mathis 18 ans</h1>
    <p class="subtitle">Qui le connaît le mieux ?</p>
    ${!backendOk ? `<div class="panel"><div class="alert alert-warning">⚠️ Configurez Firebase dans <code>js/firebase-config.js</code> avant de jouer. Consultez le README.</div></div>` : ""}
    <div class="panel">
      <button class="btn btn-primary" id="btn-player" ${!backendOk ? "disabled" : ""}>🎮 Mode Joueur</button>
      <button class="btn btn-gold" id="btn-admin" ${!backendOk ? "disabled" : ""}>⚙️ Mode Admin</button>
    </div>
    <div class="panel">
      <h2>Comment ça marche ?</h2>
      <p style="font-size:0.9rem;color:var(--muted)">
        <strong>Mathis</strong> choisit ce qu'il préfère vraiment.<br>
        <strong>Les invités</strong> devinent ce que Mathis préfère.<br>
        <strong>+1 pt</strong> par bon duel · <strong>+${FINAL_BONUS} pts</strong> bonus si tu trouves son favori final ! 🏆
      </p>
    </div>`;

  document.getElementById("btn-player")?.addEventListener("click", () => navigate("join"));
  document.getElementById("btn-admin")?.addEventListener("click", () => navigate("admin-login"));
}

function renderAdminLogin() {
  app.innerHTML = `
    <button class="back-link" id="btn-back">← Retour</button>
    <h1>⚙️ Admin</h1>
    <p class="subtitle">Accès organisateur</p>
    <div class="panel">
      <label>Mot de passe</label>
      <input type="password" id="admin-pw" placeholder="Mot de passe admin" autocomplete="current-password">
      <button class="btn btn-primary" id="btn-login">Connexion</button>
    </div>`;

  document.getElementById("btn-back").addEventListener("click", () => navigate("home"));
  document.getElementById("btn-login").addEventListener("click", () => {
    const pw = document.getElementById("admin-pw").value;
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem("mathis18_admin", "1");
      navigate("admin");
    } else {
      alert("Mot de passe incorrect.");
    }
  });
}

function renderAdmin() {
  if (!sessionStorage.getItem("mathis18_admin")) {
    navigate("admin-login");
    return;
  }

  const cat = CATEGORIES.find((c) => c.id === state.adminCategory);

  app.innerHTML = `
    <button class="back-link" id="btn-back">← Accueil</button>
    <h1>⚙️ Administration</h1>
    <div class="tabs">
      ${CATEGORIES.map((c) => `<button class="tab ${c.id === state.adminCategory ? "active" : ""}" data-cat="${c.id}">${c.emoji} ${c.label}</button>`).join("")}
    </div>
    <div class="panel">
      <h2>${cat.emoji} ${cat.label} — ${state.items.length}/16 choix</h2>
      <div class="alert alert-info">
        📷 <strong>Photos gratuites</strong> : mettez vos images dans le dossier
        <code>images/${state.adminCategory}/</code> sur votre PC, publiez avec GitHub Desktop,
        puis indiquez le chemin ci-dessous (ex. <code>images/musiques/stromae.jpg</code>).
        Firebase Storage n'est pas nécessaire.
      </div>
      <label>Titre</label>
      <input type="text" id="item-title" placeholder="Ex : Stromae">
      <label>Chemin ou URL de la photo</label>
      <input type="text" id="item-url" placeholder="images/musiques/stromae.jpg">
      <button class="btn btn-primary" id="btn-add-item">➕ Ajouter</button>
      <ul class="item-list" id="item-list">
        ${state.items.map((item) => {
          const src = resolveImageUrl(item.imageUrl);
          return `
          <li>
            ${src ? `<img src="${esc(src)}" alt="">` : `<div style="width:48px;height:48px;background:#e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center">📷</div>`}
            <span class="item-title">${esc(item.title)}</span>
            <button class="btn btn-danger btn-sm btn-del" data-id="${esc(item.id)}">✕</button>
          </li>`;
        }).join("")}
      </ul>
    </div>
    <div class="panel">
      <h2>🚀 Lancer une partie</h2>
      ${state.items.length < 16
        ? `<div class="alert alert-warning">Il faut exactement 16 choix (actuellement ${state.items.length}).</div>`
        : state.gameState?.activeCategory === state.adminCategory && state.gameState?.status === "playing"
          ? `<div class="alert alert-info">Partie en cours pour ${cat.label} !</div>`
          : ""}
      <button class="btn btn-gold" id="btn-start" ${state.items.length !== 16 ? "disabled" : ""}>
        ▶️ Lancer ${cat.label}
      </button>
      <button class="btn btn-secondary" id="btn-reset-players">🔄 Réinitialiser les joueurs (${cat.label})</button>
      <button class="btn btn-secondary" id="btn-scores">🏆 Voir les scores</button>
    </div>`;

  document.getElementById("btn-back").addEventListener("click", () => navigate("home"));
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      state.adminCategory = t.dataset.cat;
      loadAdminItems();
    })
  );
  document.getElementById("btn-add-item").addEventListener("click", addItem);
  document.querySelectorAll(".btn-del").forEach((b) =>
    b.addEventListener("click", () => deleteItemAdmin(b.dataset.id))
  );
  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-reset-players").addEventListener("click", resetPlayers);
  document.getElementById("btn-scores").addEventListener("click", () => {
    state.categoryId = state.adminCategory;
    state.recapPlayerId = null;
    setupScoresView(state.adminCategory);
  });
}

async function addItem() {
  const title = document.getElementById("item-title").value.trim();
  const imageUrl = document.getElementById("item-url").value.trim();

  if (!title) {
    alert("Entrez un titre.");
    return;
  }
  if (state.items.length >= 16) {
    alert("Maximum 16 choix par catégorie.");
    return;
  }

  try {
    await db.saveItem(state.adminCategory, { title, imageUrl });
    document.getElementById("item-title").value = "";
    document.getElementById("item-url").value = "";
  } catch (e) {
    alert("Erreur : " + e.message);
  }
}

async function deleteItemAdmin(id) {
  if (!confirm("Supprimer ce choix ?")) return;
  await db.deleteItem(state.adminCategory, id);
}

async function startGame() {
  if (!confirm(`Lancer la partie ${state.adminCategory} ? Les joueurs pourront rejoindre.`)) return;
  const ids = state.items.map((i) => i.id);
  const bracketOrder = shuffleBracket(ids);
  await db.clearPlayersForCategory(state.adminCategory);
  await db.startCategory(state.adminCategory, bracketOrder);
  alert("Partie lancée ! Les joueurs peuvent rejoindre.");
}

async function resetPlayers() {
  if (!confirm("Supprimer tous les joueurs de cette catégorie ?")) return;
  await db.clearPlayersForCategory(state.adminCategory);
  alert("Joueurs réinitialisés.");
}

function renderJoin() {
  const activeCats = CATEGORIES.filter(() => true);

  app.innerHTML = `
    <button class="back-link" id="btn-back">← Retour</button>
    <h1>🎮 Rejoindre</h1>
    <p class="subtitle">Entre ton prénom pour jouer</p>
    <div class="panel">
      <label>Prénom</label>
      <input type="text" id="player-name" placeholder="Ton prénom" maxlength="20" autocomplete="name">
      <label>Code Mathis (laisser vide si tu es invité)</label>
      <input type="password" id="mathis-code" placeholder="Code secret" autocomplete="off">
      <label>Catégorie</label>
      <div class="tabs" id="cat-tabs">
        ${CATEGORIES.map((c) => `<button class="tab ${c.id === (state.categoryId || "musiques") ? "active" : ""}" data-cat="${c.id}" type="button">${c.emoji} ${c.label}</button>`).join("")}
      </div>
      <button class="btn btn-primary" id="btn-join">C'est parti ! 🎉</button>
    </div>`;

  if (!state.categoryId) state.categoryId = "musiques";

  document.getElementById("btn-back").addEventListener("click", () => navigate("home"));
  document.querySelectorAll("#cat-tabs .tab").forEach((t) =>
    t.addEventListener("click", () => {
      state.categoryId = t.dataset.cat;
      document.querySelectorAll("#cat-tabs .tab").forEach((x) => x.classList.toggle("active", x.dataset.cat === state.categoryId));
    })
  );
  document.getElementById("btn-join").addEventListener("click", joinGame);
}

async function joinGame() {
  const name = document.getElementById("player-name").value.trim();
  const code = document.getElementById("mathis-code").value.trim();
  const isMathis = code === MATHIS_CODE;

  if (!name) {
    alert("Entre ton prénom !");
    return;
  }
  if (code && !isMathis) {
    alert("Code Mathis incorrect.");
    return;
  }

  const gameState = await db.getGameState();
  if (!gameState || gameState.status !== "playing" || gameState.activeCategory !== state.categoryId) {
    alert("Aucune partie en cours pour cette catégorie. Demande à l'organisateur de la lancer !");
    return;
  }

  if (isMathis) {
    const existing = await db.getMathisPlayer(state.categoryId);
    if (existing) {
      alert("Mathis est déjà connecté !");
      return;
    }
  }

  const playerId = await db.registerPlayer(name, isMathis, state.categoryId);
  state.playerId = playerId;
  navigate("play");
}

function renderPlay() {
  const { player, gameState, mathisPlayer, items } = state;
  if (!player || !gameState) return;

  const cat = CATEGORIES.find((c) => c.id === gameState.activeCategory);
  const bracketOrder = gameState.bracketOrder;
  const mathisAnswers = mathisPlayer?.answers || {};
  const isMathis = player.isMathis;

  const progress = getProgress(player.answers, mathisAnswers, bracketOrder, isMathis);
  const playable = getPlayableDuels(player.answers, mathisAnswers, bracketOrder, isMathis);
  const allDone = progress.answered >= progress.total && progress.total > 0;

  if (allDone) {
    renderPlayDone();
    return;
  }

  if (!isMathis && playable.length === 0 && progress.answered < progress.total) {
    const nextRound = ROUNDS.find((r) => {
      if (!getUnlockedRounds(mathisAnswers, bracketOrder).includes(r.id)) return true;
      const duels = getDuelsForRound(r.id, mathisAnswers, bracketOrder);
      return duels.some((d) => !player.answers[d.key]);
    });

    app.innerHTML = `
      <div class="waiting-box">
        <div class="emoji-big">⏳</div>
        <h2 style="color:#fff">En attente de Mathis…</h2>
        <p style="opacity:0.9;margin-top:0.5rem">
          Mathis doit finir le tour précédent pour débloquer
          <strong>${nextRound ? nextRound.label : "le tour suivant"}</strong>.
        </p>
        <p style="opacity:0.8;margin-top:1rem;font-size:0.9rem">
          ${cat.emoji} ${cat.label} · ${progress.answered}/${progress.total} duels joués
        </p>
      </div>`;
    return;
  }

  const duel = playable[0];
  const itemA = itemById(duel.a);
  const itemB = itemById(duel.b);
  const roundLabel = ROUNDS.find((r) => r.id === duel.roundId)?.label || duel.roundId;
  const pct = progress.total ? Math.round((progress.answered / progress.total) * 100) : 0;

  const instruction = isMathis
    ? "Choisis ce que TU préfères vraiment :"
    : "Que va choisir Mathis ?";

  app.innerHTML = `
    <div class="duel-header">
      <div>${cat.emoji} ${cat.label} ${isMathis ? '<span class="badge badge-mathis">Mathis</span>' : ""}</div>
      <div class="round-label">${roundLabel} · Duel ${progress.answered + 1}/${progress.total}</div>
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>
    <p style="text-align:center;color:#fff;font-weight:600;margin-bottom:0.75rem">${instruction}</p>
    <div class="duel-cards side-by-side">
      ${renderCard(itemA, null, isMathis ? "Je préfère ça !" : "Mathis choisira ça")}
      <div class="duel-vs">VS</div>
      ${renderCard(itemB, null, isMathis ? "Je préfère ça !" : "Mathis choisira ça")}
    </div>`;

  document.querySelectorAll(".duel-card").forEach((card) => {
    card.addEventListener("click", async () => {
      const choiceId = card.dataset.id;
      await db.saveAnswer(state.playerId, duel.key, choiceId);
    });
  });
}

function renderPlayDone() {
  const { player, gameState, mathisPlayer } = state;
  const cat = CATEGORIES.find((c) => c.id === gameState.activeCategory);
  const bracketOrder = gameState.bracketOrder;
  const mathisAnswers = mathisPlayer?.answers || {};

  if (player.isMathis) {
    const champion = getChampion(mathisAnswers, bracketOrder);
    const champItem = itemById(champion);

    app.innerHTML = `
      <div class="waiting-box">
        <div class="emoji-big">🎉</div>
        <h2 style="color:#fff">Bravo Mathis !</h2>
        <p style="color:#fff;opacity:0.9">Tu as terminé ${cat.label}.</p>
      </div>
      <div class="panel champion-reveal">
        <p>Ton favori :</p>
        ${resolveImageUrl(champItem.imageUrl) ? `<img src="${esc(resolveImageUrl(champItem.imageUrl))}" alt="">` : "<div style='font-size:4rem'>🏆</div>"}
        <div class="champion-name">${esc(champItem.title)}</div>
      </div>
      <div class="panel">
        <button class="btn btn-primary" id="btn-scores">🏆 Voir le classement</button>
        <button class="btn btn-secondary" id="btn-recap">📋 Voir mes choix</button>
      </div>`;
  } else {
    const score = calculateScore(player.answers, mathisAnswers, bracketOrder, FINAL_BONUS);

    app.innerHTML = `
      <div class="waiting-box">
        <div class="emoji-big">${score.bonus > 0 ? "🏆" : "🎉"}</div>
        <h2 style="color:#fff">Terminé !</h2>
        <p style="color:#fff;font-size:2rem;font-weight:800">${score.total} pts</p>
      </div>
      <div class="panel">
        <p><strong>${score.duelPoints}</strong> bons duels sur ${score.maxDuels}</p>
        ${score.bonus > 0
          ? `<p style="color:#d97706;font-weight:700">🌟 BONUS +${score.bonus} — Tu as trouvé le favori de Mathis !</p>`
          : `<p class="hint">Pas de bonus finale cette fois…</p>`}
      </div>
      <div class="panel">
        <button class="btn btn-primary" id="btn-scores">🏆 Voir le classement</button>
        <button class="btn btn-secondary" id="btn-recap">📋 Voir mes choix vs Mathis</button>
        <button class="btn btn-secondary" id="btn-home">🏠 Accueil</button>
      </div>`;
  }

  document.getElementById("btn-scores")?.addEventListener("click", () => setupScoresView(state.categoryId));
  document.getElementById("btn-recap")?.addEventListener("click", () => {
    state.recapPlayerId = state.playerId;
    setupRecapView(state.categoryId);
  });
  document.getElementById("btn-home")?.addEventListener("click", () => navigate("home"));
}

function setupScoresView(categoryId) {
  cleanup();
  state.screen = "scores";
  state.categoryId = categoryId;
  if (!state.recapPlayerId && state.mathisPlayer) {
    state.recapPlayerId = state.mathisPlayer.id;
  }

  const unsubGame = db.listenGameState((gs) => {
    if (gs?.activeCategory === categoryId) state.gameState = gs;
    if (state.screen === "scores") showScores();
  });
  state.unsubscribers.push(unsubGame);

  const unsubPlayers = db.listenPlayers(categoryId, (players) => {
    state.allPlayers = players;
    state.mathisPlayer = players.find((p) => p.isMathis) || null;
    if (!state.recapPlayerId && state.mathisPlayer) state.recapPlayerId = state.mathisPlayer.id;
    if (state.screen === "scores") showScores();
  });
  state.unsubscribers.push(unsubPlayers);

  const unsubItems = db.listenItems(categoryId, (items) => {
    state.items = items;
    state.itemsMap = Object.fromEntries(items.map((i) => [i.id, i]));
    if (state.screen === "scores") showScores();
  });
  state.unsubscribers.push(unsubItems);

  db.getGameState().then((gs) => {
    state.gameState = gs;
    showScores();
  });
}

function showScores() {
  const categoryId = state.categoryId || state.gameState?.activeCategory || state.adminCategory;
  const cat = CATEGORIES.find((c) => c.id === categoryId);

  const bracketOrder = state.gameState?.bracketOrder || [];
  const mathisAnswers = state.mathisPlayer?.answers || {};
  const champion = getChampion(mathisAnswers, bracketOrder);
  const champItem = itemById(champion);

  const guests = state.allPlayers
    .filter((p) => !p.isMathis)
    .map((p) => {
      const s = calculateScore(p.answers || {}, mathisAnswers, bracketOrder, FINAL_BONUS);
      return { ...p, score: s };
    })
    .sort((a, b) => b.score.total - a.score.total);

  const rankClass = (i) => (i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "");

  app.innerHTML = `
    <button class="back-link" id="btn-back">← Retour</button>
    <h1>🏆 Classement</h1>
    <p class="subtitle">${cat?.emoji || ""} ${cat?.label || categoryId}</p>
    ${champion ? `
    <div class="panel champion-reveal">
      <p>Le favori de Mathis :</p>
      ${resolveImageUrl(champItem.imageUrl) ? `<img src="${esc(resolveImageUrl(champItem.imageUrl))}" alt="">` : ""}
      <div class="champion-name">${esc(champItem.title)}</div>
    </div>` : `<div class="panel"><div class="alert alert-info">Mathis n'a pas encore terminé…</div></div>`}
    <div class="panel">
      <h2>Qui le connaît le mieux ?</h2>
      ${guests.length === 0
        ? `<p class="hint">Aucun invité pour l'instant.</p>`
        : `<ul class="leaderboard">
          ${guests.map((p, i) => `
            <li>
              <span class="rank ${rankClass(i)}">${i + 1}</span>
              <div class="player-info">
                <div class="player-name">${esc(p.name)}</div>
                <div class="player-detail">${p.score.duelPoints} bons duels${p.score.bonus ? ` · +${p.score.bonus} bonus 🌟` : ""}</div>
              </div>
              <span class="player-score">${p.score.total}</span>
            </li>`).join("")}
        </ul>`}
    </div>
    <div class="panel">
      <h2>📋 Détail des choix</h2>
      <p class="hint" style="margin-bottom:0.75rem">Compare les réponses de chaque joueur avec Mathis.</p>
      <div class="recap-player-tabs" id="recap-tabs">
        ${state.mathisPlayer ? `<button class="tab recap-tab ${state.recapPlayerId === state.mathisPlayer.id ? "active" : ""}" data-id="${esc(state.mathisPlayer.id)}">👑 Mathis</button>` : ""}
        ${guests.map((p) => `<button class="tab recap-tab ${state.recapPlayerId === p.id ? "active" : ""}" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join("")}
      </div>
      ${state.recapPlayerId ? `<div class="recap-list">${renderRecapContent(state.recapPlayerId)}</div>` : `<p class="hint">Sélectionnez un joueur ci-dessus.</p>`}
    </div>`;

  document.getElementById("btn-back").addEventListener("click", () => {
    if (state.playerId) navigate("play");
    else if (sessionStorage.getItem("mathis18_admin")) navigate("admin");
    else navigate("home");
  });

  document.querySelectorAll(".recap-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.recapPlayerId = btn.dataset.id;
      showScores();
    });
  });
}

function renderRecapContent(playerId) {
  const player = state.allPlayers.find((p) => p.id === playerId) || state.player;
  if (!player) return `<p class="hint">Joueur introuvable.</p>`;

  const bracketOrder = state.gameState?.bracketOrder || [];
  const mathisAnswers = state.mathisPlayer?.answers || {};
  const isMathisView = player.isMathis;

  return `
    <h3 style="margin-bottom:0.75rem">${isMathisView ? "Les choix de Mathis" : `Choix de ${esc(player.name)} vs Mathis`}</h3>
    ${buildRecapDuels(mathisAnswers, player.answers || {}, bracketOrder, isMathisView)}`;
}

function setupRecapView(categoryId, playerId = null) {
  cleanup();
  state.screen = "recap";
  state.categoryId = categoryId;
  state.recapPlayerId = playerId || state.playerId || null;

  const unsubGame = db.listenGameState((gs) => {
    if (gs?.activeCategory === categoryId) state.gameState = gs;
    if (state.screen === "recap") showRecap();
  });
  state.unsubscribers.push(unsubGame);

  const unsubPlayers = db.listenPlayers(categoryId, (players) => {
    state.allPlayers = players;
    state.mathisPlayer = players.find((p) => p.isMathis) || null;
    if (!state.recapPlayerId && state.mathisPlayer) state.recapPlayerId = state.mathisPlayer.id;
    if (state.screen === "recap") showRecap();
  });
  state.unsubscribers.push(unsubPlayers);

  const unsubItems = db.listenItems(categoryId, (items) => {
    state.items = items;
    state.itemsMap = Object.fromEntries(items.map((i) => [i.id, i]));
    if (state.screen === "recap") showRecap();
  });
  state.unsubscribers.push(unsubItems);

  db.getGameState().then((gs) => {
    state.gameState = gs;
    showRecap();
  });
}

function showRecap() {
  const categoryId = state.categoryId || state.gameState?.activeCategory;
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const guests = state.allPlayers.filter((p) => !p.isMathis);
  const isAdmin = sessionStorage.getItem("mathis18_admin");

  app.innerHTML = `
    <button class="back-link" id="btn-back">← Retour</button>
    <h1>📋 Détail des duels</h1>
    <p class="subtitle">${cat?.emoji || ""} ${cat?.label || categoryId}</p>
    <div class="panel">
      <p class="hint" style="margin-bottom:0.75rem">
        🟡 Mathis · 🟢 bon choix invité · 🔴 mauvais choix
      </p>
      <div class="recap-player-tabs">
        ${state.mathisPlayer ? `<button class="tab recap-tab ${state.recapPlayerId === state.mathisPlayer.id ? "active" : ""}" data-id="${esc(state.mathisPlayer.id)}">👑 Mathis</button>` : ""}
        ${guests.map((p) => `<button class="tab recap-tab ${state.recapPlayerId === p.id ? "active" : ""}" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join("")}
      </div>
    </div>
    <div class="panel recap-list">
      ${state.recapPlayerId ? renderRecapContent(state.recapPlayerId) : `<p class="hint">Choisissez un joueur.</p>`}
    </div>`;

  document.getElementById("btn-back").addEventListener("click", () => {
    if (state.playerId && !isAdmin) navigate("play");
    else if (isAdmin) setupScoresView(categoryId);
    else navigate("home");
  });

  document.querySelectorAll(".recap-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.recapPlayerId = btn.dataset.id;
      showRecap();
    });
  });
}

// --- Navigation & listeners ---

function navigate(screen) {
  cleanup();
  state.screen = screen;

  switch (screen) {
    case "home":
      renderHome();
      break;
    case "admin-login":
      renderAdminLogin();
      break;
    case "admin":
      loadAdminItems();
      break;
    case "join":
      renderJoin();
      break;
    case "play":
      setupPlayListeners();
      break;
  }
}

function loadAdminItems() {
  cleanup();
  const unsub = db.listenItems(state.adminCategory, (items) => {
    state.items = items;
    state.itemsMap = Object.fromEntries(items.map((i) => [i.id, i]));
    if (state.screen === "admin") renderAdmin();
  });
  state.unsubscribers.push(unsub);

  const unsubGame = db.listenGameState((gs) => {
    state.gameState = gs;
    if (state.screen === "admin") renderAdmin();
  });
  state.unsubscribers.push(unsubGame);

  state.screen = "admin";
  renderAdmin();
}

function setupPlayListeners() {
  cleanup();
  state.playerId = db.getLocalPlayerId();

  if (!state.playerId) {
    navigate("join");
    return;
  }

  const unsubPlayer = db.listenPlayer(state.playerId, (p) => {
    state.player = p;
    if (p) state.categoryId = p.categoryId;
    if (state.screen === "play") renderPlay();
  });
  state.unsubscribers.push(unsubPlayer);

  const unsubGame = db.listenGameState((gs) => {
    state.gameState = gs;
    if (state.screen === "play") renderPlay();
  });
  state.unsubscribers.push(unsubGame);

  const loadCategory = async () => {
    const p = await db.getPlayer(state.playerId);
    if (!p) {
      navigate("join");
      return;
    }
    state.categoryId = p.categoryId;

    const unsubItems = db.listenItems(p.categoryId, (items) => {
      state.items = items;
      state.itemsMap = Object.fromEntries(items.map((i) => [i.id, i]));
      if (state.screen === "play") renderPlay();
    });
    state.unsubscribers.push(unsubItems);

    const unsubMathis = db.listenPlayers(p.categoryId, (players) => {
      state.allPlayers = players;
      state.mathisPlayer = players.find((pl) => pl.isMathis) || null;
      if (state.screen === "play" || state.screen === "scores") {
        if (state.screen === "scores") showScores();
        else renderPlay();
      }
    });
    state.unsubscribers.push(unsubMathis);
  };

  loadCategory();
  state.screen = "play";
}

// --- Init ---

const ready = initFirebase();
if (ready) {
  const savedPlayer = db.getLocalPlayerId();
  if (savedPlayer && window.location.hash === "#play") {
    navigate("play");
  } else {
    renderHome();
  }
} else {
  renderHome();
}
