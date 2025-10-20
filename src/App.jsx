import React, { useState, useEffect, useRef, useMemo } from "react";
import iceCube from "../images/ice_cube.png";
import pickaxeImg from "../images/pickaxe.png";
import flamethrowerImg from "../images/flamethrower.png";
import jackhammerImg from "../images/jackhammer.png";
import "./App.css";
import { supabase } from "./lib/supabaseClient";

export default function App() {
  const [drops, setDrops] = useState(0);
  const [isClicking, setIsClicking] = useState(false);
  const [owned, setOwned] = useState({ pickaxe: 0, flamethrower: 0, jackhammer: 0 });
  const [dps, setDps] = useState(0);
  const lastTimeRef = useRef(Date.now());
  const autoAccumRef = useRef(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [playerId, setPlayerId] = useState("");
  const saveRef = useRef({ drops: 0, owned: { pickaxe: 0, flamethrower: 0, jackhammer: 0 }, workers: { miner: 0, torch: 0, jack: 0 }, hasStarted: false, username: "", playerId: "" });
  const lastSentRef = useRef({ drops: 0, t: 0 });

  const [workers, setWorkers] = useState({ miner: 0, torch: 0, jack: 0 });
  const [devMode, setDevMode] = useState(false);
  const [devAmount, setDevAmount] = useState(100000);
  const [leaders, setLeaders] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [around, setAround] = useState([]);
  const [totalPlayers, setTotalPlayers] = useState(null);
  const liveMapRef = useRef(new Map());
  const [liveTick, setLiveTick] = useState(0);
  const channelRef = useRef(null);
  const lastLiveSentRef = useRef(0);

  const leadersView = useMemo(() => {
    const list = Array.isArray(leaders) ? [...leaders] : [];
    const idx = list.findIndex(r => r.player_id === playerId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], username: username || list[idx].username, drops: Math.floor(drops) };
      list.sort((a, b) => (b.drops - a.drops) || String(a.player_id || '').localeCompare(String(b.player_id || '')));
    }
    // Overlay recent live broadcasts for other players (TTL ~5s)
    const now = Date.now();
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      if (!row.player_id || row.player_id === playerId) continue;
      const live = liveMapRef.current.get(row.player_id);
      if (live && now - (live.ts || 0) < 5000) {
        list[i] = { ...row, username: live.username || row.username, drops: Math.floor(live.drops) };
      }
    }
    list.sort((a, b) => (b.drops - a.drops) || String(a.player_id || '').localeCompare(String(b.player_id || '')));
    return list;
  }, [leaders, drops, playerId, username, liveTick]);

  const myIndexInView = useMemo(() => leadersView.findIndex(r => r.player_id === playerId), [leadersView, playerId]);
  const uiRank = useMemo(() => (myIndexInView >= 0 ? myIndexInView + 1 : myRank), [myIndexInView, myRank]);
  const aroundView = useMemo(() => {
    if (myIndexInView >= 0) {
      const start = Math.max(0, myIndexInView - 2);
      return leadersView.slice(start, start + 5);
    }
    return around;
  }, [leadersView, myIndexInView, around]);

  // Subscribe to realtime broadcast for near-real-time peer numbers
  useEffect(() => {
    const ch = supabase.channel('lb-live');
    ch.on('broadcast', { event: 'tick' }, (msg) => {
      const payload = msg?.payload || {};
      if (!payload.player_id || payload.player_id === playerId) return;
      liveMapRef.current.set(payload.player_id, { ...payload, ts: Date.now() });
      setLiveTick(t => t + 1);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [playerId]);

  // Broadcast my current number every ~2s while visible (ephemeral, not persisted)
  useEffect(() => {
    const send = () => {
      const now = Date.now();
      if (!channelRef.current || !playerId || now - lastLiveSentRef.current < 1500) return;
      channelRef.current.send({ type: 'broadcast', event: 'tick', payload: { player_id: playerId, username: username || `Player${(playerId || '').slice(-4)}`, drops: Math.floor(drops), ts: now } });
      lastLiveSentRef.current = now;
    };
    send();
    const id = window.setInterval(send, 2000);
    const onHide = () => { if (document.visibilityState === 'hidden') send(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onHide); };
  }, [drops, username, playerId]);

  const costs = {
    pickaxe: { base: 5000, factor: 1.15 },
    flamethrower: { base: 20000, factor: 1.25 },
    jackhammer: { base: 100000, factor: 1.3 },
  };

  const getCost = (key) => {
    const def = costs[key];
    if (!def) return Infinity;
    return Math.floor(def.base * Math.pow(def.factor, owned[key] || 0));
  };

  const workerCosts = {
    miner: { base: 15000, factor: 1.2 },
    torch: { base: 80000, factor: 1.25 },
    jack: { base: 400000, factor: 1.3 },
  };

  const getWorkerCost = (key) => {
    const def = workerCosts[key];
    if (!def) return Infinity;
    return Math.floor(def.base * Math.pow(def.factor, workers[key] || 0));
  };

  const addDrops = (amount) => setDrops(v => v + amount);
  const setDropsTo = (amount) => setDrops(Number.isFinite(amount) ? amount : 0);
  const grantOwned = (key, n = 1) => setOwned(o => ({ ...o, [key]: (o[key] || 0) + n }));
  const grantWorker = (key, n = 1) => setWorkers(w => ({ ...w, [key]: (w[key] || 0) + n }));

  const calculateClickGain = () => {
    const baseClick = 100;
    return baseClick + (owned.pickaxe * 10) + (owned.flamethrower * 50) + (owned.jackhammer * 200);
  };

  const calculateAutoDPS = () => {
    const minerDPS = workers.miner * 20;
    const torchDPS = workers.torch * 100;
    const jackOpDPS = workers.jack * 400;
    return minerDPS + torchDPS + jackOpDPS;
  };

  useEffect(() => {
    let running = true;
    let prev = performance.now();
    let rafId = 0;

    const loop = (ts) => {
      const deltaTime = Math.min((ts - prev) / 1000, 1);
      prev = ts;

      const currentDPS = calculateAutoDPS();
      setDps(currentDPS);

      if (currentDPS > 0) {
        autoAccumRef.current += currentDPS * deltaTime;
        const intGain = Math.floor(autoAccumRef.current);
        if (intGain > 0) {
          autoAccumRef.current -= intGain;
          setDrops(v => v + intGain);
        }
      }

      if (!running) return;
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => { running = false; if (rafId) cancelAnimationFrame(rafId); };
  }, [workers]);

  useEffect(() => {
    saveRef.current = { drops, owned, workers, hasStarted, username, playerId };
  }, [drops, owned, workers, hasStarted, username, playerId]);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' && window.localStorage.getItem('dripdrip_save');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (typeof data.drops === 'number') setDrops(data.drops);
        if (data.owned && typeof data.owned === 'object') {
          setOwned({
            pickaxe: Number(data.owned.pickaxe) || 0,
            flamethrower: Number(data.owned.flamethrower) || 0,
            jackhammer: Number(data.owned.jackhammer) || 0,
          });
        }
        if (data.workers && typeof data.workers === 'object') {
          setWorkers({
            miner: Number(data.workers.miner) || 0,
            torch: Number(data.workers.torch) || 0,
            jack: Number(data.workers.jack) || 0,
          });
        }
        if (typeof data.hasStarted === 'boolean') setHasStarted(data.hasStarted);
        if (typeof data.username === 'string') {
          setUsername(data.username);
          setUsernameInput(data.username);
        }
        if (typeof data.playerId === 'string') setPlayerId(data.playerId);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!playerId) {
      const existing = typeof window !== 'undefined' ? window.localStorage.getItem('dripdrip_pid') : '';
      if (existing) {
        setPlayerId(existing);
      } else {
        const gen = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        setPlayerId(gen);
        try { window.localStorage.setItem('dripdrip_pid', gen); } catch {}
      }
    }
  }, [playerId]);

  useEffect(() => {
    const saveTick = () => {
      try {
        const payload = { version: 1, ...saveRef.current };
        window.localStorage.setItem('dripdrip_save', JSON.stringify(payload));
      } catch {}
    };
    const id = window.setInterval(saveTick, 5000);
    const onVis = () => { if (document.visibilityState === 'hidden') saveTick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    let timer = 0;
    const upsertAndFetch = async (force = false) => {
      try {
        const baseName = username?.trim();
        const fallback = playerId ? `Player${playerId.slice(-4)}` : `Player${(Math.floor(Math.random()*9000)+1000)}`;
        const uname = baseName && baseName.length > 0 ? baseName : fallback;
        const totalDrops = Math.floor(drops) || 0;
        const now = Date.now();
        const shouldSend = force || (totalDrops !== lastSentRef.current.drops && (now - lastSentRef.current.t) > 30000);
        if (uname && playerId && shouldSend) {
          const { error: upErr } = await supabase
            .from('leaderboard')
            .upsert({ player_id: playerId, username: uname, drops: totalDrops }, { onConflict: 'player_id' });
          if (!upErr) {
            lastSentRef.current = { drops: totalDrops, t: now };
          }
        }
        const { data } = await supabase
          .from('leaderboard')
          .select('player_id,username,drops')
          .order('drops', { ascending: false })
          .order('player_id', { ascending: true })
          .limit(50);
        let localRank = null;
        if (Array.isArray(data)) {
          let list = [...data];
          const i = list.findIndex(r => r.player_id === playerId);
          if (i >= 0) {
            // Override my row with local drops and resort so UI and rank match the big number
            list[i] = { ...list[i], drops: Math.floor(totalDrops), username: uname };
            list.sort((a, b) => (b.drops - a.drops) || String(a.player_id || '').localeCompare(String(b.player_id || '')));
            const idx = list.findIndex(r => r.player_id === playerId);
            localRank = idx + 1;
            setLeaders(list);
            const start = Math.max(0, idx - 2);
            const end = Math.min(list.length, start + 5);
            setAround(list.slice(start, end));
          } else {
            // Not in top list; keep server list as-is and fall back later to server-side window
            setLeaders(list);
          }
        }

        // Always use local in-game drops for my row and rank calculations
        let myDrops = totalDrops;

        if (localRank !== null) {
          setMyRank(localRank);
        } else {
          const { count: aboveCount } = await supabase
          .from('leaderboard')
          .select('id', { count: 'exact', head: true })
          .gt('drops', myDrops);
        const { count: tieBefore } = await supabase
          .from('leaderboard')
          .select('id', { count: 'exact', head: true })
          .eq('drops', myDrops)
          .lt('player_id', playerId || '');
        const rank = (aboveCount ?? 0) + (tieBefore ?? 0) + 1;
        setMyRank(rank);
        }

        const { count: totalCount } = await supabase
          .from('leaderboard')
          .select('id', { count: 'exact', head: true });
        if (typeof totalCount === 'number') setTotalPlayers(totalCount);

        if (localRank === null) {
          const offset = Math.max(0, rank - 3);
          const { data: aroundData } = await supabase
            .from('leaderboard')
            .select('player_id,username,drops')
            .order('drops', { ascending: false })
            .order('player_id', { ascending: true })
            .range(offset, offset + 4);
          if (Array.isArray(aroundData)) setAround(aroundData);
        }
      } catch {}
    };
    upsertAndFetch(true);
    timer = window.setInterval(() => upsertAndFetch(false), 10000);
    const onHide = () => { if (document.visibilityState === 'hidden') upsertAndFetch(true); };
    document.addEventListener('visibilitychange', onHide);
    return () => { if (timer) window.clearInterval(timer); document.removeEventListener('visibilitychange', onHide); };
  }, [username, drops, playerId]);

  useEffect(() => {
    const fromUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1';
    const fromStorage = typeof window !== 'undefined' && window.localStorage.getItem('devMode') === '1';
    if (fromUrl || fromStorage) setDevMode(true);

    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        setDevMode(v => {
          const next = !v;
          try { window.localStorage.setItem('devMode', next ? '1' : '0'); } catch {}
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function buy(key) {
    const price = getCost(key);
    if (drops < price) return;
    setDrops(v => v - price);
    setOwned(o => ({ ...o, [key]: (o[key] || 0) + 1 }));
  }

  function buyWorker(key) {
    const price = getWorkerCost(key);
    if (drops < price) return;
    setDrops(v => v - price);
    setWorkers(w => ({ ...w, [key]: (w[key] || 0) + 1 }));
  }

  const formatDrops = (num) => Math.floor(num).toLocaleString();
  const formatDps = (num) => Math.floor(num).toLocaleString();

  return (
    <div className="game-container">
      {devMode && (
        <div className="dev-panel">
          <div className="dev-row">
            <strong>Dev Mode</strong>
            <button className="dev-btn" onClick={() => setDevMode(false)}>Close</button>
          </div>
          <div className="dev-row">
            <label className="dev-label">Amount</label>
            <input className="dev-input" type="number" value={devAmount}
                   onChange={(e) => setDevAmount(Number(e.target.value) || 0)} />
            <button className="dev-btn" onClick={() => addDrops(devAmount)}>Add</button>
            <button className="dev-btn" onClick={() => setDropsTo(devAmount)}>Set</button>
            <button className="dev-btn" onClick={() => setDropsTo(0)}>Zero</button>
          </div>
          <div className="dev-row">
            <button className="dev-btn" onClick={() => addDrops(1000)}>+1,000</button>
            <button className="dev-btn" onClick={() => addDrops(100000)}>+100,000</button>
            <button className="dev-btn" onClick={() => addDrops(1000000)}>+1,000,000</button>
          </div>
          <div className="dev-row">
            <span className="dev-label">Items</span>
            <button className="dev-btn" onClick={() => grantOwned('pickaxe', 1)}>+1 Pickaxe</button>
            <button className="dev-btn" onClick={() => grantOwned('flamethrower', 1)}>+1 Flamethrower</button>
            <button className="dev-btn" onClick={() => grantOwned('jackhammer', 1)}>+1 Jackhammer</button>
          </div>
          <div className="dev-row">
            <span className="dev-label">Workers</span>
            <button className="dev-btn" onClick={() => grantWorker('miner', 1)}>+1 Miner</button>
            <button className="dev-btn" onClick={() => grantWorker('torch', 1)}>+1 Torch</button>
            <button className="dev-btn" onClick={() => grantWorker('jack', 1)}>+1 Jack Op</button>
          </div>
        </div>
      )}
      <main className="game-main">
        <div className="stage">
          <div className="left-stack automation-floating">
            <aside className="shop-panel">
              <h2 className="shop-title">Tool Shop</h2>
              <div className="shop-items">
                <div className={`shop-item ${drops < getCost('pickaxe') ? 'disabled' : ''}`}>
                  <div className="item-thumbnail">
                    <img src={pickaxeImg} alt="Pickaxe" className="item-image" />
                  </div>
                          <div className="item-info">
                            <h3 className="item-name">Pickaxe</h3>
                            <p className="item-cost">Cost: {getCost('pickaxe').toLocaleString()} drops</p>
                            <p className="item-owned">Owned: {owned.pickaxe}</p>
                            <p className="item-effect">+10 per click</p>
                          </div>
                  <button
                    className="buy-button"
                    onClick={() => buy("pickaxe")}
                    disabled={drops < getCost('pickaxe')}
                    aria-label={`Buy pickaxe for ${getCost('pickaxe')} drops`}
                  >
                    Buy
                  </button>
                </div>

                <div className={`shop-item ${drops < getCost('flamethrower') ? 'disabled' : ''}`}>
                  <div className="item-thumbnail">
                    <img src={flamethrowerImg} alt="Flamethrower" className="item-image" />
                  </div>
                          <div className="item-info">
                            <h3 className="item-name">Flamethrower</h3>
                            <p className="item-cost">Cost: {getCost('flamethrower').toLocaleString()} drops</p>
                            <p className="item-owned">Owned: {owned.flamethrower}</p>
                            <p className="item-effect">+50 per click</p>
                          </div>
                  <button
                    className="buy-button"
                    onClick={() => buy("flamethrower")}
                    disabled={drops < getCost('flamethrower')}
                    aria-label={`Buy flamethrower for ${getCost('flamethrower')} drops`}
                  >
                    Buy
                  </button>
                </div>

                <div className={`shop-item ${drops < getCost('jackhammer') ? 'disabled' : ''}`}>
                  <div className="item-thumbnail">
                    <img src={jackhammerImg} alt="Jackhammer" className="item-image" />
                  </div>
                          <div className="item-info">
                            <h3 className="item-name">Jackhammer</h3>
                            <p className="item-cost">Cost: {getCost('jackhammer').toLocaleString()} drops</p>
                            <p className="item-owned">Owned: {owned.jackhammer}</p>
                            <p className="item-effect">+200 per click</p>
                          </div>
                  <button
                    className="buy-button"
                    onClick={() => buy("jackhammer")}
                    disabled={drops < getCost('jackhammer')}
                    aria-label={`Buy jackhammer for ${getCost('jackhammer')} drops`}
                  >
                    Buy
                  </button>
                </div>
              </div>
            </aside>

            <aside className="shop-panel">
              <h2 className="shop-title">Automation Shop</h2>
              <div className="shop-items">
                <div className={`shop-item ${drops < getWorkerCost('miner') ? 'disabled' : ''}`}>
                  <div className="item-thumbnail">
                    <img src={pickaxeImg} alt="Miner" className="item-image" />
                  </div>
                          <div className="item-info">
                            <h3 className="item-name">Miner</h3>
                            <p className="item-cost">Cost: {getWorkerCost('miner').toLocaleString()} drops</p>
                            <p className="item-owned">Owned: {workers.miner}</p>
                            <p className="item-effect">+20 /s each</p>
                          </div>
                  <button
                    className="buy-button"
                    onClick={() => buyWorker('miner')}
                    disabled={drops < getWorkerCost('miner')}
                    aria-label={`Buy miner for ${getWorkerCost('miner')} drops`}
                  >
                    Buy
                  </button>
                </div>

                <div className={`shop-item ${drops < getWorkerCost('torch') ? 'disabled' : ''}`}>
                  <div className="item-thumbnail">
                    <img src={flamethrowerImg} alt="Torch Operator" className="item-image" />
                  </div>
                          <div className="item-info">
                            <h3 className="item-name">Torch Operator</h3>
                            <p className="item-cost">Cost: {getWorkerCost('torch').toLocaleString()} drops</p>
                            <p className="item-owned">Owned: {workers.torch}</p>
                            <p className="item-effect">+100 /s each</p>
                          </div>
                  <button
                    className="buy-button"
                    onClick={() => buyWorker('torch')}
                    disabled={drops < getWorkerCost('torch')}
                    aria-label={`Buy torch operator for ${getWorkerCost('torch')} drops`}
                  >
                    Buy
                  </button>
                </div>

                <div className={`shop-item ${drops < getWorkerCost('jack') ? 'disabled' : ''}`}>
                  <div className="item-thumbnail">
                    <img src={jackhammerImg} alt="Jackhammer Operator" className="item-image" />
                  </div>
                          <div className="item-info">
                            <h3 className="item-name">Jackhammer Operator</h3>
                            <p className="item-cost">Cost: {getWorkerCost('jack').toLocaleString()} drops</p>
                            <p className="item-owned">Owned: {workers.jack}</p>
                            <p className="item-effect">+400 /s each</p>
                          </div>
                  <button
                    className="buy-button"
                    onClick={() => buyWorker('jack')}
                    disabled={drops < getWorkerCost('jack')}
                    aria-label={`Buy jackhammer operator for ${getWorkerCost('jack')} drops`}
                  >
                    Buy
                  </button>
                </div>
              </div>
            </aside>
          </div>
          <div className={`clicker-section ${isClicking ? "clicking" : ""}`}>
                  <div className="drops-display">
                    <span className="drops-number">{formatDrops(drops)}</span>
                    <span className="drops-label">Drops</span>
                    <div className="dps-display">
                      <div className="dps-pill">
                        <span className="dps-number">{formatDps(calculateClickGain())}</span>
                        <span className="dps-label">Per Click</span>
                      </div>
                      <div className="dps-pill">
                        <span className="dps-number">{formatDps(dps)}/s</span>
                        <span className="dps-label">Auto</span>
                      </div>
                    </div>
      </div>

          {!hasStarted && (
            <div className="start-hint">Click the ice to start!</div>
          )}

          <button
            className={`ice-cube-button ${isClicking ? "clicking" : ""}`}
            onClick={() => {
              const clickGain = calculateClickGain();
              setDrops(v => v + clickGain);
              setHasStarted(true);
              setIsClicking(true);
              setTimeout(() => setIsClicking(false), 240);
            }}
            onMouseDown={() => setIsClicking(true)}
            onMouseUp={() => setIsClicking(false)}
            onMouseLeave={() => setIsClicking(false)}
            onTouchStart={() => setIsClicking(true)}
            onTouchEnd={() => setIsClicking(false)}
            aria-label="Click ice cube to collect drops"
          >
            <img src={iceCube} alt="Ice cube" className="ice-cube-image" />
        </button>
          <div className="username-row">
            <input
              className="username-input"
              type="text"
              maxLength={24}
              placeholder="Enter username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const desired = usernameInput.trim();
                  if (!desired) { setUsername(""); setUsernameError(""); return; }
                  try {
                    const { data } = await supabase
                      .from('leaderboard')
                      .select('player_id')
                      .eq('username', desired)
                      .neq('player_id', playerId || '')
                      .limit(1);
                    if (Array.isArray(data) && data.length > 0) {
                      setUsernameError('That name is already taken.');
                    } else {
                      setUsernameError("");
                      setUsername(desired);
                    }
                  } catch {
                    setUsername(desired);
                  }
                }
              }}
            />
          </div>
          {usernameError && <div className="username-error">{usernameError}</div>}
          </div>

          <aside className="shop-panel shop-floating">
          <h2 className="shop-title">Global Leaderboard</h2>
          <div className="leaderboard">
            <div className="leaderboard-header">Leaderboard</div>
            <ol className="leaderboard-list">
              {leadersView.map((row, idx) => (
                <li key={(row.player_id || row.username) + idx} className={`leaderboard-item ${row.player_id === playerId ? 'me' : ''}`}>
                  <span className="lb-rank">{idx + 1}</span>
                  <span className="lb-name">{row.username}</span>
                  <span className="lb-score">{Number(row.drops || 0).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="leaderboard">
            <div className="leaderboard-header">Your Position {uiRank ? `(#${uiRank}${totalPlayers ? ` of ${totalPlayers}` : ''})` : ''}</div>
            <ol className="leaderboard-list">
              {aroundView.map((row, i) => {
                const rankStart = (uiRank ? uiRank - 2 : 1);
                const rankShown = Math.max(1, rankStart) + i;
                return (
                  <li key={(row.player_id || row.username) + rankShown} className={`leaderboard-item ${row.player_id === playerId ? 'me' : ''}`}>
                    <span className="lb-rank">{rankShown}</span>
                    <span className="lb-name">{row.username}</span>
                    <span className="lb-score">{Number(row.drops || 0).toLocaleString()}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          
          </aside>
        </div>
      </main>
      </div>
  );
}
