/**
 * Logique du bracket à 16 items.
 * Les duels du 1/16 sont fixes (paires dans l'ordre du tirage).
 * Les tours suivants utilisent les vainqueurs selon les choix de Mathis.
 */

export const ROUNDS = [
  { id: "1/16", duelCount: 8, label: "1/16 de finale" },
  { id: "1/8", duelCount: 4, label: "1/8 de finale" },
  { id: "1/4", duelCount: 2, label: "1/4 de finale" },
  { id: "finale", duelCount: 1, label: "Finale" }
];

export function duelKey(roundId, duelIndex) {
  return `${roundId}-${duelIndex}`;
}

/** Génère un ordre aléatoire des 16 IDs */
export function shuffleBracket(itemIds) {
  const arr = [...itemIds];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Paires fixes du 1/16 à partir de l'ordre du bracket */
export function getRound16Duels(bracketOrder) {
  const duels = [];
  for (let i = 0; i < 16; i += 2) {
    duels.push({
      key: duelKey("1/16", i / 2),
      roundId: "1/16",
      duelIndex: i / 2,
      a: bracketOrder[i],
      b: bracketOrder[i + 1]
    });
  }
  return duels;
}

/** Vainqueurs d'un tour selon un ensemble de réponses */
export function getWinnersForRound(roundId, answers, bracketOrder) {
  const duels = getDuelsForRound(roundId, answers, bracketOrder);
  return duels.map((d) => answers[d.key] || null).filter(Boolean);
}

/** Tous les duels d'un tour (basés sur les vainqueurs Mathis pour les tours > 1/16) */
export function getDuelsForRound(roundId, mathisAnswers, bracketOrder) {
  if (roundId === "1/16") {
    return getRound16Duels(bracketOrder);
  }

  const roundIndex = ROUNDS.findIndex((r) => r.id === roundId);
  if (roundIndex <= 0) return [];

  const prevRound = ROUNDS[roundIndex - 1];
  const prevWinners = getWinnersForRound(prevRound.id, mathisAnswers, bracketOrder);

  const duels = [];
  const count = ROUNDS[roundIndex].duelCount;
  for (let i = 0; i < count; i++) {
    duels.push({
      key: duelKey(roundId, i),
      roundId,
      duelIndex: i,
      a: prevWinners[i * 2],
      b: prevWinners[i * 2 + 1]
    });
  }
  return duels;
}

/** Tous les duels de la partie (pour le scoring) */
export function getAllDuels(mathisAnswers, bracketOrder) {
  return ROUNDS.flatMap((round) => getDuelsForRound(round.id, mathisAnswers, bracketOrder));
}

/** Le champion final selon les réponses */
export function getChampion(answers, bracketOrder) {
  const finalDuels = getDuelsForRound("finale", answers, bracketOrder);
  if (finalDuels.length === 0) return null;
  return answers[finalDuels[0].key] || null;
}

/** Vérifie si Mathis a terminé un tour entier */
export function isRoundComplete(roundId, answers, bracketOrder) {
  const duels = getDuelsForRound(roundId, answers, bracketOrder);
  return duels.every((d) => answers[d.key]);
}

/** Prochain tour débloqué pour un joueur (selon progression Mathis) */
export function getUnlockedRounds(mathisAnswers, bracketOrder) {
  const unlocked = [];
  for (let i = 0; i < ROUNDS.length; i++) {
    const round = ROUNDS[i];
    if (i === 0) {
      unlocked.push(round.id);
      continue;
    }
    const prev = ROUNDS[i - 1];
    if (isRoundComplete(prev.id, mathisAnswers, bracketOrder)) {
      unlocked.push(round.id);
    } else {
      break;
    }
  }
  return unlocked;
}

/** Duels jouables pour un invité (tour débloqué, pas encore répondu) */
export function getPlayableDuels(playerAnswers, mathisAnswers, bracketOrder, isMathis) {
  const unlocked = isMathis
    ? ROUNDS.map((r) => r.id)
    : getUnlockedRounds(mathisAnswers, bracketOrder);

  const playable = [];
  for (const roundId of unlocked) {
    const duels = getDuelsForRound(roundId, mathisAnswers, bracketOrder);
    for (const duel of duels) {
      if (!playerAnswers[duel.key]) {
        playable.push(duel);
      }
    }
  }
  return playable;
}

/** Calcul du score d'un invité */
export function calculateScore(playerAnswers, mathisAnswers, bracketOrder, finalBonus = 10) {
  const allDuels = getAllDuels(mathisAnswers, bracketOrder);
  let duelPoints = 0;

  for (const duel of allDuels) {
    const mathisChoice = mathisAnswers[duel.key];
    const playerChoice = playerAnswers[duel.key];
    if (mathisChoice && playerChoice === mathisChoice) {
      duelPoints++;
    }
  }

  const mathisChampion = getChampion(mathisAnswers, bracketOrder);
  const finalDuels = getDuelsForRound("finale", mathisAnswers, bracketOrder);

  let bonus = 0;
  if (finalDuels.length > 0) {
    const finalKey = finalDuels[0].key;
    if (mathisAnswers[finalKey] && playerAnswers[finalKey] === mathisAnswers[finalKey]) {
      bonus = finalBonus;
    }
  }

  return {
    duelPoints,
    bonus,
    total: duelPoints + bonus,
    maxDuels: allDuels.length,
    championId: mathisChampion
  };
}

/** Progression en pourcentage */
export function getProgress(playerAnswers, mathisAnswers, bracketOrder, isMathis) {
  const allDuels = getAllDuels(mathisAnswers, bracketOrder);
  const answered = allDuels.filter((d) => playerAnswers[d.key]).length;
  return { answered, total: allDuels.length };
}
