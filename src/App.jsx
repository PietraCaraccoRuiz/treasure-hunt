import { useEffect, useMemo, useState } from "react";
import "./App.css";
import DraggableInventory from "./components/draggableInventory";
import Particles from "./components/particles";
import TreasureMap from "./components/treasureMap";
import FINAL_ENIGMA from "./config/finalEnigma";
import TREASURES from "./config/gameData";
import loadState from "./utils/loadState";
import saveState from "./utils/saveState";

const STORAGE_KEY = "cacaPokebolas_v1";
const BOSS = {
  name: "Mewtwo Sombrio",
  hp: 320,
  color: "#c88cff",
  sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png",
};

function PokeballIcon({ size = 28 }) {
  return (
    <span className="pokeball-icon" style={{ "--ball-size": `${size}px` }} aria-hidden="true" />
  );
}

function PokemonCard({ point, locked = false, compact = false }) {
  return (
    <article className={`pokemon-card ${locked ? "is-locked" : ""} ${compact ? "is-compact" : ""}`}>
      <div className="pokemon-card__glow" style={{ background: point.color }} />
      <div className="pokemon-card__top">
        <span>{locked ? "#???" : `#${String(point.pokemon.dex).padStart(3, "0")}`}</span>
        <span className="pokemon-card__type">{locked ? "???" : point.type}</span>
      </div>
      <img className="pokemon-card__sprite" src={point.pokemon.sprite} alt={locked ? "Pokemon misterioso" : point.pokemon.name} />
      <div className="pokemon-card__body">
        <strong>{locked ? "?????" : point.pokemon.name}</strong>
        <span>{locked ? "Responda ao quiz para revelar" : point.description}</span>
      </div>
    </article>
  );
}

export default function App() {
  const saved = loadState();
  const [screen, setScreen] = useState(saved ? "map" : "intro");
  const [unlocked, setUnlocked] = useState(saved?.unlocked || []);
  const [clues, setClues] = useState(saved?.clues || {});
  const [quizDone, setQuizDone] = useState(saved?.quizDone || []);
  const [clueOrder, setClueOrder] = useState(saved?.clueOrder || TREASURES.map((t) => t.id));
  const [activePoint, setActivePoint] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [enigmaSolved, setEnigmaSolved] = useState(saved?.enigmaSolved || false);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState("map");
  const [reward, setReward] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(saved?.selectedTeam || []);
  const [battle, setBattle] = useState(null);
  const [finalKeyword, setFinalKeyword] = useState("");
  const [showCompletion, setShowCompletion] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const [finalUnlock, setFinalUnlock] = useState(false);
  const [draggingBattleId, setDraggingBattleId] = useState(null);

  const collectedCount = unlocked.length;
  const totalCount = TREASURES.length;
  const fullClues = Object.values(clues).filter((value) => value === "full").length;

  const currentPoint = useMemo(
    () => TREASURES.find((point) => point.id === quizState?.pointId),
    [quizState],
  );

  useEffect(() => {
    saveState({ unlocked, clues, quizDone, clueOrder, enigmaSolved, selectedTeam });
  }, [unlocked, clues, quizDone, clueOrder, enigmaSolved, selectedTeam]);

  function notify(msg, color = "#ffcb05") {
    setNotification({ msg, color });
    window.setTimeout(() => setNotification(null), 2800);
  }

  function canOpen(point) {
    return point.id === 1 || unlocked.includes(point.id - 1) || unlocked.includes(point.id);
  }

  function handlePointClick(point) {
    if (!canOpen(point)) {
      notify("Venca a rota anterior para liberar esta area.", "#ff5c7a");
      return;
    }

    if (!quizDone.includes(point.id)) {
      setQuizState({ pointId: point.id, selected: null, result: null });
      setActiveTab("quiz");
      return;
    }

    setActivePoint(point);
  }

  function handleAnswer(index) {
    if (!currentPoint || quizState.result) return;

    const correct = index === currentPoint.quiz.correct;
    setQuizState((state) => ({ ...state, selected: index, result: correct ? "correct" : "wrong" }));

    window.setTimeout(() => {
      if (correct) {
        const completingDex = !unlocked.includes(currentPoint.id) && unlocked.length + 1 === totalCount;
        setUnlocked((items) => (items.includes(currentPoint.id) ? items : [...items, currentPoint.id]));
        setQuizDone((items) => (items.includes(currentPoint.id) ? items : [...items, currentPoint.id]));
        setClues((items) => ({ ...items, [currentPoint.id]: "full" }));
        setSelectedTeam((items) => (items.includes(currentPoint.id) ? items : [...items, currentPoint.id]));
        notify(`${currentPoint.pokemon.name} entrou para sua equipe!`, currentPoint.color);
        setPendingCompletion(completingDex);
        setReward(currentPoint);
      } else {
        notify("A Pokebola escapou! Tente o quiz de novo para capturar.", "#ff9f43");
      }

      setQuizState(null);
      setActivePoint(null);
      setActiveTab("map");
    }, 1100);
  }

  function resetGame() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  function endSession() {
    setReward(null);
    setActivePoint(null);
    setQuizState(null);
    setBattle(null);
    setActiveTab("map");
    setScreen("intro");
  }

  function getPokemonStats(point) {
    return {
      hp: point.battle?.hp || 90,
      attack: point.battle?.attack || 22,
      special: point.battle?.special || 38,
      move: point.battle?.move || "Ataque rapido",
      specialMove: point.battle?.specialMove || "Golpe especial",
    };
  }

  function toggleTeam(id) {
    if (!unlocked.includes(id) || battle?.phase === "fight") return;
    setSelectedTeam((team) => (team.includes(id) ? team.filter((item) => item !== id) : [...team, id]));
  }

  function getBattleOrder() {
    const ordered = clueOrder.filter((id) => unlocked.includes(id));
    const missing = unlocked.filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  }

  function reorderBattleOrder(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    setClueOrder((current) => {
      const ordered = current.filter((id) => unlocked.includes(id));
      const missing = unlocked.filter((id) => !ordered.includes(id));
      const battleOrder = [...ordered, ...missing];
      const sourceIndex = battleOrder.indexOf(sourceId);
      const targetIndex = battleOrder.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;

      const updatedBattleOrder = [...battleOrder];
      const [removed] = updatedBattleOrder.splice(sourceIndex, 1);
      updatedBattleOrder.splice(targetIndex, 0, removed);
      const untouched = current.filter((id) => !updatedBattleOrder.includes(id));
      return [...updatedBattleOrder, ...untouched];
    });
  }

  function startBattle() {
    if (collectedCount < totalCount) {
      notify("Capture todos os Pokemon antes de enfrentar o chefao.", "#ff5c7a");
      return;
    }

    setFinalKeyword("");
    const team = getBattleOrder();
    const hp = Object.fromEntries(team.map((id) => {
      const point = TREASURES.find((item) => item.id === id);
      return [id, getPokemonStats(point).hp];
    }));

    setSelectedTeam(team);
    setBattle({
      phase: "fight",
      activeId: team[0],
      order: team,
      bossHp: BOSS.hp,
      teamHp: hp,
      energy: 1,
      defending: false,
      resolving: false,
      turn: 1,
      bossCharge: 0,
      effect: "start",
      message: `${TREASURES.find((item) => item.id === team[0]).pokemon.name} entrou na arena!`,
      log: ["Mewtwo Sombrio bloqueou o premio final.", "Escolha ataque, defesa ou carregue um especial."],
    });
  }

  function finishBattle(won, message) {
    setBattle((current) => ({
      ...current,
      phase: won ? "won" : "lost",
      resolving: false,
      effect: won ? "victory" : "danger",
      message,
      log: [message, ...current.log].slice(0, 6),
    }));
  }

  function bossCounter(nextBattle, playerAction) {
    if (nextBattle.bossHp <= 0) {
      finishBattle(true, "Voce derrotou Mewtwo Sombrio!");
      return;
    }

    const active = TREASURES.find((item) => item.id === nextBattle.activeId);
    const shield = playerAction === "defend" ? 0.45 : 1;
    const nextCharge = nextBattle.bossCharge + 1;
    const bossSpecial = nextCharge >= 3;
    const baseDamage = bossSpecial ? 38 + Math.floor(Math.random() * 12) : 18 + Math.floor(Math.random() * 11);
    const damage = Math.round(baseDamage * shield);
    const currentHp = nextBattle.teamHp[nextBattle.activeId];
    const nextHp = Math.max(0, currentHp - damage);
    const nextTeamHp = { ...nextBattle.teamHp, [nextBattle.activeId]: nextHp };
    const alive = (nextBattle.order || selectedTeam).filter((id) => nextTeamHp[id] > 0);
    const bossMove = bossSpecial ? "Explosao Psiquica" : "Pulso Sombrio";
    const bossText = `${BOSS.name} usou ${bossMove} e causou ${damage} de dano.`;

    if (!alive.length) {
      finishBattle(false, "Sua equipe caiu. Reorganize os Pokemon e tente de novo.");
      return;
    }

    const nextActiveId = nextHp > 0 ? nextBattle.activeId : alive[0];
    const faintText = nextHp > 0 ? "" : `${active.pokemon.name} caiu. ${TREASURES.find((item) => item.id === nextActiveId).pokemon.name} assumiu a luta.`;

    setBattle({
      ...nextBattle,
      activeId: nextActiveId,
      teamHp: nextTeamHp,
      defending: false,
      resolving: false,
      bossCharge: bossSpecial ? 0 : nextCharge,
      effect: bossSpecial ? "boss-special" : "boss-hit",
      turn: nextBattle.turn + 1,
      message: faintText || bossText,
      log: [faintText || bossText, ...nextBattle.log].filter(Boolean).slice(0, 6),
    });
  }

  function getTypeBonus(active) {
    const bonuses = {
      Fantasma: 1.25,
      Eletrico: 1.12,
      Fogo: 1,
      Agua: 0.95,
      Grama: 0.9,
    };
    return bonuses[active.type] || 1;
  }

  function getBattleSymbol(effect) {
    if (effect === "defend") return "DEF";
    if (effect === "boss-hit" || effect === "boss-special") return "HIT";
    if (effect === "special") return "SP";
    if (effect === "switch") return "SW";
    return "ATK";
  }

  function battleAction(action) {
    if (!battle || battle.phase !== "fight" || battle.resolving) return;
    const active = TREASURES.find((item) => item.id === battle.activeId);
    const stats = getPokemonStats(active);
    const typeBonus = getTypeBonus(active);

    if (action === "special" && battle.energy < 3) {
      notify("Carregue energia antes do especial.", "#ff9f43");
      return;
    }

    if (action === "defend") {
      const healedHp = Math.min(stats.hp, battle.teamHp[active.id] + 8);
      const nextBattle = {
        ...battle,
        teamHp: { ...battle.teamHp, [active.id]: healedHp },
        energy: Math.min(3, battle.energy + 1),
        defending: true,
        resolving: true,
        effect: "defend",
        message: `${active.pokemon.name} se defendeu e recuperou folego.`,
        log: [`${active.pokemon.name} levantou guarda e recuperou 8 HP.`, ...battle.log].slice(0, 6),
      };
      window.setTimeout(() => bossCounter(nextBattle, "defend"), 450);
      setBattle(nextBattle);
      return;
    }

    const isSpecial = action === "special";
    const rawDamage = (isSpecial ? stats.special : stats.attack) + Math.floor(Math.random() * 9);
    const damage = Math.round(rawDamage * typeBonus);
    const nextBossHp = Math.max(0, battle.bossHp - damage);
    const moveName = isSpecial ? stats.specialMove : stats.move;
    const nextBattle = {
      ...battle,
      bossHp: nextBossHp,
      energy: isSpecial ? 0 : Math.min(3, battle.energy + 1),
      resolving: true,
      effect: isSpecial ? "special" : "attack",
      message: `${active.pokemon.name} usou ${moveName}!`,
      log: [`${moveName} causou ${damage} de dano${typeBonus > 1 ? " com vantagem" : ""}.`, ...battle.log].slice(0, 6),
    };

    setBattle(nextBattle);
    window.setTimeout(() => bossCounter(nextBattle, action), 520);
  }

  function switchPokemon(id) {
    if (!battle || battle.phase !== "fight" || battle.teamHp[id] <= 0 || battle.activeId === id) return;
    setBattle((current) => ({
      ...current,
      activeId: id,
      energy: Math.min(3, current.energy + 1),
      effect: "switch",
      message: `${TREASURES.find((item) => item.id === id).pokemon.name} entrou na luta!`,
      log: [`Troca feita. Energia +1.`, ...current.log].slice(0, 6),
    }));
  }

  function unlockFinalPrize() {
    if (finalKeyword.trim().toUpperCase() !== FINAL_ENIGMA.keyword) {
      notify("Palavra-chave incorreta. Confira o premio liberado pelo chefao.", "#ff5c7a");
      return;
    }

    setEnigmaSolved(true);
    setFinalUnlock(true);
    window.setTimeout(() => setScreen("victory"), 3200);
  }

  if (screen === "intro") {
    return (
      <main className="app-shell intro-screen">
        <Particles count={34} color="#ffcb05" />
        <section className="phone-frame intro-phone">
          <div className="top-bar">
            <span><PokeballIcon size={18} /> {collectedCount + 317}</span>
            <span>POKEMON QUEST</span>
          </div>
          <div className="hero-stack">
            <div className="hero-pokemon">
              <img src={TREASURES[0].pokemon.sprite} alt="Pikachu" />
            </div>
            <div className="menu-badge">
              <PokeballIcon size={20} />
              <span>Kanto adventure</span>
            </div>
            <h1>Caca-Pokebolas</h1>
            <p>
              Capture sua equipe, descubra rotas misteriosas e enfrente o chefao na arena final.
            </p>
          </div>
          <div className="menu-status-grid">
            <div>
              <strong>{collectedCount}/{totalCount}</strong>
              <span>capturados</span>
            </div>
            <div>
              <strong>{quizDone.length}</strong>
              <span>quizzes</span>
            </div>
            <div>
              <strong>{enigmaSolved ? "ON" : "OFF"}</strong>
              <span>arena</span>
            </div>
          </div>
          <div className="menu-team-preview">
            {TREASURES.map((point) => (
              <img
                key={point.id}
                src={point.pokemon.sprite}
                alt={unlocked.includes(point.id) ? point.pokemon.name : "Pokemon misterioso"}
                className={unlocked.includes(point.id) ? "" : "is-hidden"}
              />
            ))}
          </div>
          <div className="menu-actions">
            <button className="primary-button" onClick={() => setScreen(saved ? "map" : "tutorial")}>
              {saved ? "Continuar jornada" : "Comecar jornada"}
            </button>
            <button className="secondary-button" onClick={() => setScreen("tutorial")}>
              Como jogar
            </button>
            {saved && (
              <button className="danger-button" onClick={resetGame}>
                Nova jornada
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  if (screen === "tutorial") {
    return (
      <main className="app-shell">
        <section className="phone-frame tutorial-phone">
          <div className="section-heading">
            <span className="eyebrow">Guia rapido</span>
            <h2>Como jogar</h2>
          </div>
          {[
            ["Mapa", "Arraste, aproxime e clique nas Pokebolas liberadas para iniciar quizzes."],
            ["Captura", "Voce so ganha o Pokemon se acertar. Se errar, ele continua misterioso e voce tenta de novo."],
            ["Equipe", "No inventario, veja os Pokemon capturados e prepare sua equipe."],
            ["Final", "Capture todos, escolha sua equipe e lute contra o chefao."],
          ].map(([title, text]) => (
            <div className="tutorial-row" key={title}>
              <PokeballIcon size={32} />
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </div>
          ))}
          <button className="primary-button" onClick={() => setScreen("map")}>
            Ir para o mapa
          </button>
        </section>
      </main>
    );
  }

  if (screen === "victory") {
    return (
      <main className="app-shell victory-screen">
        <Particles count={48} color="#ffcb05" />
        <section className="phone-frame victory-phone">
          <div className="legendary-ball"><PokeballIcon size={118} /></div>
          <p className="eyebrow">Premio final desbloqueado</p>
          <h1>Voce venceu o chefao!</h1>
          <p className="victory-answer">{FINAL_ENIGMA.answer}</p>
          <div className="team-strip">
            {TREASURES.map((point) => (
              <img key={point.id} src={point.pokemon.sprite} alt={point.pokemon.name} />
            ))}
          </div>
          <button className="primary-button" onClick={resetGame}>Resetar jogo</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell dashboard-screen">
      {notification && (
        <div className="toast" style={{ "--toast-color": notification.color }}>
          {notification.msg}
        </div>
      )}

      <section className="dashboard">
        <header className="dashboard-header">
          <div>
            <span className="eyebrow">Pokemon world</span>
            <h1>Caca-Pokebolas</h1>
          </div>
          <div className="header-actions">
            <button className="menu-button" onClick={endSession}>
              Menu
            </button>
            <div className="score-pill">
              <PokeballIcon size={18} />
              {collectedCount}/{totalCount}
            </div>
          </div>
        </header>

        <div className="content-grid">
          <section className="map-panel">
            {activeTab === "map" && (
              <>
                <div className="section-heading inline">
                  <div>
                    <span className="eyebrow">Mapa de Kanto</span>
                    <h2>Rotas de captura</h2>
                  </div>
                  <span>{quizDone.length} quizzes</span>
                </div>
                <TreasureMap
                  treasures={TREASURES}
                  unlocked={unlocked}
                  quizDone={quizDone}
                  onPointClick={handlePointClick}
                />
              </>
            )}

            {activeTab === "quiz" && currentPoint && (
              <section className="quiz-panel">
                <PokemonCard point={currentPoint} locked={!unlocked.includes(currentPoint.id) && quizState.result !== "correct"} />
                <div className="quiz-box">
                  <span className="eyebrow">Quiz de treinador</span>
                  <h2>{currentPoint.quiz.question}</h2>
                  <div className="answer-list">
                    {currentPoint.quiz.options.map((option, index) => {
                      const showResult = quizState.result !== null;
                      const isSelected = quizState.selected === index;
                      const isCorrect = currentPoint.quiz.correct === index;
                      return (
                        <button
                          className={`answer-button ${isSelected ? "is-selected" : ""} ${showResult && isCorrect ? "is-correct" : ""} ${showResult && isSelected && !isCorrect ? "is-wrong" : ""}`}
                          key={option}
                          onClick={() => handleAnswer(index)}
                          disabled={showResult}
                        >
                          <span>{["A", "B", "C", "D"][index]}</span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {activeTab === "inventory" && (
              <section className="inventory-panel">
                <div className="section-heading">
                  <span className="eyebrow">Equipe e pistas</span>
                  <h2>Organize seus Pokemon</h2>
                </div>
                <DraggableInventory
                  treasures={TREASURES}
                  clueOrder={clueOrder}
                  clues={clues}
                  onReorder={setClueOrder}
                />
                {collectedCount === totalCount && (
                  <div className="team-ready-panel">
                    <span className="eyebrow">Equipe pronta</span>
                    <p>Arraste as pistas para definir a ordem de entrada na arena.</p>
                    <button className="primary-button" onClick={() => setActiveTab("enigma")}>
                      Ir para a luta final
                    </button>
                  </div>
                )}
              </section>
            )}

            {activeTab === "enigma" && (
              <section className="enigma-panel">
                <div className="legendary-ball small"><PokeballIcon size={76} /></div>
                <div className="section-heading">
                  <span className="eyebrow">Arena final</span>
                  <h2>Batalha contra o chefao</h2>
                  <p>{collectedCount < totalCount ? "Capture todos os Pokemon para liberar a luta final." : "Escolha seus Pokemon, derrote Mewtwo Sombrio e use a palavra-chave para pegar o premio final."}</p>
                </div>
                {!battle || battle.phase === "lost" ? (
                  <>
                    {battle?.phase === "lost" && <div className="battle-message is-danger">{battle.message}</div>}
                    <div className="battle-order-strip">
                      <span className="eyebrow">Ordem da luta vem do inventario</span>
                      <p>Arraste as pistas na aba Equipe para mudar esta sequencia.</p>
                      <div>
                        {getBattleOrder().map((id, index) => {
                          const point = TREASURES.find((item) => item.id === id);
                          return (
                            <figure
                              key={id}
                              className={draggingBattleId === id ? "is-dragging" : ""}
                              draggable
                              onDragStart={(event) => {
                                setDraggingBattleId(id);
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", String(id));
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                const sourceId = Number(event.dataTransfer.getData("text/plain"));
                                reorderBattleOrder(sourceId, id);
                                setDraggingBattleId(null);
                              }}
                              onDragEnd={() => setDraggingBattleId(null)}
                            >
                              <span>{index + 1}</span>
                              <img src={point.pokemon.sprite} alt={point.pokemon.name} />
                              <figcaption>{point.pokemon.name}</figcaption>
                            </figure>
                          );
                        })}
                      </div>
                    </div>
                    <button className="primary-button" onClick={startBattle} disabled={collectedCount < totalCount || getBattleOrder().length === 0}>
                      Iniciar batalha
                    </button>
                  </>
                ) : battle.phase === "fight" ? (() => {
                  const active = TREASURES.find((item) => item.id === battle.activeId);
                  const activeStats = getPokemonStats(active);
                  const activeHp = battle.teamHp[active.id];
                  return (
                    <div className={`battle-game effect-${battle.effect || "idle"}`}>
                      <div className="battle-hud">
                        <span>Turno {battle.turn}</span>
                        <span>Energia {battle.energy}/3</span>
                        <span>Carga do chefao {battle.bossCharge}/3</span>
                        <span>Vantagem x{getTypeBonus(active).toFixed(2)}</span>
                      </div>
                      <div className={`battle-symbol effect-${battle.effect || "attack"}`}>
                        {getBattleSymbol(battle.effect)}
                      </div>
                      <div className="battle-stage">
                        <div className="fighter player">
                          <div className="fighter-tag">Sua vez</div>
                          <div className="hp-bar"><span style={{ width: `${(activeHp / activeStats.hp) * 100}%` }} /></div>
                          <img src={active.pokemon.sprite} alt={active.pokemon.name} />
                          <strong>{active.pokemon.name}</strong>
                          <small>{activeHp}/{activeStats.hp} HP</small>
                        </div>
                        <div className="versus">VS</div>
                        <div className="fighter boss">
                          <div className="fighter-tag danger">Chefao</div>
                          <div className="hp-bar boss-hp"><span style={{ width: `${(battle.bossHp / BOSS.hp) * 100}%` }} /></div>
                          <img src={BOSS.sprite} alt={BOSS.name} />
                          <strong>{BOSS.name}</strong>
                          <small>{battle.bossHp}/{BOSS.hp} HP</small>
                        </div>
                      </div>
                      <div className="battle-message">{battle.message}</div>
                      <div className="battle-actions">
                        <button className="attack-action" onClick={() => battleAction("attack")} disabled={battle.resolving}>
                          <strong>Atacar</strong>
                          <span>{activeStats.move}</span>
                        </button>
                        <button className="defend-action" onClick={() => battleAction("defend")} disabled={battle.resolving}>
                          <strong>Defender</strong>
                          <span>Reduz dano e cura 8 HP</span>
                        </button>
                        <button className="special-action" onClick={() => battleAction("special")} disabled={battle.resolving || battle.energy < 3}>
                          <strong>Especial {battle.energy}/3</strong>
                          <span>{activeStats.specialMove}</span>
                        </button>
                      </div>
                      <div className="battle-team">
                        {(battle.order || selectedTeam).map((id) => {
                          const point = TREASURES.find((item) => item.id === id);
                          const hp = battle.teamHp[id];
                          return (
                            <button
                              key={id}
                              onClick={() => switchPokemon(id)}
                              disabled={hp <= 0}
                              className={battle.activeId === id ? "is-active" : ""}
                            >
                              <img src={point.pokemon.sprite} alt={point.pokemon.name} />
                              <span>{hp}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="battle-log">
                        {battle.log.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
                      </div>
                    </div>
                  );
                })() : battle.phase === "won" ? (
                  <div className="final-prize-panel">
                    <div className="legendary-ball small"><PokeballIcon size={92} /></div>
                    <span className="eyebrow">Chefao derrotado</span>
                    <h2>Palavra-chave liberada: {FINAL_ENIGMA.keyword}</h2>
                    <p>{battle.message} Digite a palavra-chave para abrir o premio final.</p>
                    <input
                      value={finalKeyword}
                      onChange={(event) => setFinalKeyword(event.target.value)}
                      placeholder="Digite a palavra-chave"
                    />
                    <button className="primary-button" onClick={unlockFinalPrize} disabled={!finalKeyword.trim() || finalUnlock}>
                      Desbloquear premio final
                    </button>
                    {finalUnlock && (
                      <div className="final-unlock-show">
                        <Particles count={44} color="#ffcb05" />
                        <div className="unlock-beam" />
                        <div className="unlock-aura" />
                        <div className="unlock-burst" />
                        <div className="unlock-shards">
                          {Array.from({ length: 16 }, (_, index) => <span key={index} style={{ "--i": index }} />)}
                        </div>
                        <div className="unlock-ring">
                          <span className="unlock-core" />
                          <PokeballIcon size={128} />
                        </div>
                        <div className="unlock-team">
                          {TREASURES.map((point, index) => (
                            <img key={point.id} src={point.pokemon.sprite} alt={point.pokemon.name} style={{ "--i": index }} />
                          ))}
                        </div>
                        <strong>PREMIO FINAL DESBLOQUEADO</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="battle-message">{battle.message}</div>
                )}
                {battle?.phase !== "fight" && <div className="clue-board battle-clues">
                  {clueOrder.map((id, index) => {
                    const point = TREASURES.find((item) => item.id === id);
                    const state = clues[id];
                    return (
                      <div className={`clue-line ${state ? "" : "is-muted"}`} key={id}>
                        <span>{index + 1}</span>
                        <p>{state === "full" ? point.clue.full : state === "partial" ? point.clue.partial : "Pista bloqueada"}</p>
                      </div>
                    );
                  })}
                </div>}
              </section>
            )}
          </section>

          <aside className="side-panel">
            <div className="phone-frame mini-phone">
              <div className="top-bar">
                <span><PokeballIcon size={14} /> {collectedCount + 317}</span>
                <span>TEAM</span>
              </div>
              <div className="progress-ring" style={{ "--progress": (collectedCount / totalCount) * 100 }}>
                <strong>{collectedCount}/{totalCount}</strong>
                <span>capturados</span>
              </div>
              <div className="team-list">
                {TREASURES.map((point) => (
                  <PokemonCard key={point.id} point={point} locked={!unlocked.includes(point.id)} compact />
                ))}
              </div>
              <div className="hint-box">
                <strong>Pistas completas</strong>
                <span>{fullClues}/{totalCount}</span>
              </div>
            </div>
          </aside>
        </div>

        <nav className="bottom-tabs" aria-label="Navegacao principal">
          {[
            ["map", "Mapa"],
            ["inventory", "Equipe"],
            ["enigma", "Batalha"],
          ].map(([tab, label]) => (
            <button
              className={activeTab === tab ? "is-active" : ""}
              key={tab}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </nav>
      </section>

      {activePoint && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setActivePoint(null)}>
          <section className="modal-card">
            <PokemonCard point={activePoint} />
            <div className="modal-copy">
              <span className="eyebrow">Rota concluida</span>
              <h2>{activePoint.name}</h2>
              <p>{activePoint.clue.full}</p>
            </div>
            <button className="primary-button" onClick={() => setActivePoint(null)}>Fechar</button>
          </section>
        </div>
      )}

      {reward && (
        <div className="modal-backdrop reward" onClick={(event) => event.target === event.currentTarget && setReward(null)}>
          <section className="modal-card reward-card">
            <Particles count={20} color={reward.color} />
            <div className="capture-scene">
              <img className="capture-pokemon" src={reward.pokemon.sprite} alt={reward.pokemon.name} />
              <div className="capture-ball"><PokeballIcon size={74} /></div>
              <div className="capture-flash" />
            </div>
            <div className="modal-copy">
              <span className="eyebrow">Pokemon capturado</span>
              <h2>{reward.pokemon.name}</h2>
              <p>Pista adicionada: {reward.clue.full}</p>
            </div>
            <button className="primary-button" onClick={() => {
              setReward(null);
              if (pendingCompletion) {
                setPendingCompletion(false);
                setShowCompletion(true);
              }
            }}>Continuar</button>
          </section>
        </div>
      )}
      {showCompletion && (
        <div className="modal-backdrop complete-modal" onClick={(event) => event.target === event.currentTarget && setShowCompletion(false)}>
          <section className="modal-card completion-card">
            <Particles count={32} color="#ffcb05" />
            <div className="completion-orbit">
              {TREASURES.map((point, index) => (
                <img key={point.id} src={point.pokemon.sprite} alt={point.pokemon.name} style={{ "--i": index }} />
              ))}
            </div>
            <div className="modal-copy">
              <span className="eyebrow">Pokedex completa</span>
              <h2>Voce cacou todos os Pokemon!</h2>
              <p>A arena final foi liberada. Organize a ordem da equipe e depois enfrente o chefao.</p>
            </div>
            <button className="primary-button" onClick={() => { setShowCompletion(false); setActiveTab("inventory"); }}>
              Organizar equipe
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
