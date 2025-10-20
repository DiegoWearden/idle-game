import React, { useState, useEffect, useRef } from "react";
import iceCube from "../images/ice_cube.png";
import pickaxeImg from "../images/pickaxe.png";
import flamethrowerImg from "../images/flamethrower.png";
import jackhammerImg from "../images/jackhammer.png";
import "./App.css";

export default function App() {
  const [drops, setDrops] = useState(0);
  const [isClicking, setIsClicking] = useState(false);
  const [owned, setOwned] = useState({ pickaxe: 0, flamethrower: 0, jackhammer: 0 });
  const [dps, setDps] = useState(0);
  const lastTimeRef = useRef(Date.now());
  const autoAccumRef = useRef(0);

  const [workers, setWorkers] = useState({ miner: 0, torch: 0, jack: 0 });
  const [devMode, setDevMode] = useState(false);
  const [devAmount, setDevAmount] = useState(100000);

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
          <aside className="shop-panel automation-floating">
            <h2 className="shop-title">Automation</h2>
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

          <button
            className={`ice-cube-button ${isClicking ? "clicking" : ""}`}
            onClick={() => {
              const clickGain = calculateClickGain();
              setDrops(v => v + clickGain);
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
          </div>

          <aside className="shop-panel shop-floating">
          <h2 className="shop-title">Shop</h2>
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
        </div>
      </main>
      </div>
  );
}
