"use client";

import { useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import { maximumPrize, type GameSnapshot, type GamePlay } from "@rarefriends/friendsdk/game";
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import { createFriendReader, type GenerationSprites } from "@rarefriends/friendsdk/sprites";
import "@rarefriends/friendsdk/frame.css";
import "./style.css";
import { RareForceEngine, VIEW, type Cue, type Mode } from "./engine";

type Menu = "title" | "armory" | "inventory" | "settings" | "reward" | "help" | null;
const ALLY_ID = 1337n;
const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;

function outcomeBonus(name: string) {
  if (name === "Field ration") return "Deploy: +1 life this run.";
  if (name === "Extra magazine") return "Deploy: rapid fire this run.";
  if (name === "Spread kit") return "Deploy: three-way shot this run.";
  if (name === "Life medal") return "Deploy: +2 lives this run.";
  if (name === "Hero bounty") return "Deploy: 3-hit shield and +500 score.";
  return "No field bonus. Keep or ignore.";
}

export default function RareForce({ friendId, client, paused }: GameComponentProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<RareForceEngine | null>(null);
  const sound = useRef<FriendSoundKit | null>(null);
  const epoch = useRef(0);
  const locked = useRef(false);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [menu, setMenu] = useState<Menu>("title");
  const [status, setStatus] = useState("Loading your Rare Friend…");
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Simulated RF. Reloading resets the preview.");
  const [result, setResult] = useState<GamePlay | null>(null);
  const [hud, setHud] = useState({ lives: 3, score: 0, levelName: "Jungle Drop", weapon: "standard", phase: "title" as string, mode: "solo" as Mode });
  const live = useRef({ paused, reducedMotion, muted, menu });
  live.current = { paused, reducedMotion, muted, menu };

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const version = ++epoch.current;
    sound.current = createFriendSoundKit({ muted: true });
    setMuted(true);
    setSnapshot(null);
    setResult(null);
    setError("");
    setBusy(false);
    locked.current = false;
    void client.read().then(value => { if (version === epoch.current) setSnapshot(value); }).catch(cause => {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "Could not load the preview.");
    });
    return () => { epoch.current++; sound.current?.dispose(); sound.current = null; };
  }, [client, friendId]);

  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) {
      setFailed(true);
      setStatus("This browser cannot render Rare Force.");
      return;
    }
    let cancelled = false;
    let frame = 0;
    let previous = 0;
    engine.current = null;
    setFailed(false);
    setStatus("Loading your Rare Friend’s artwork…");
    const stop = () => engine.current?.stopInput();
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);

    void Promise.all([
      createFriendReader().read(friendId),
      createFriendReader().read(ALLY_ID).catch(() => null),
      client.read(),
    ]).then(([hero, ally, snap]) => {
      if (cancelled) return;
      if (snap.friendId !== friendId) throw new Error("Game session does not match the selected Friend.");
      setSnapshot(snap);
      setStatus("");
      const play = (cue: Cue) => { if (!live.current.muted) sound.current?.play(cue); };
      const game = new RareForceEngine(ctx, hero as GenerationSprites, ally as GenerationSprites | null, {
        play,
        reducedMotion: () => live.current.reducedMotion,
        paused: () => live.current.paused || live.current.menu !== null,
      });
      engine.current = game;
      setMenu("title");
      const tick = (now: number) => {
        const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
        previous = now;
        game.update(dt);
        game.draw();
        const next = game.hud();
        setHud(current => (
          current.lives === next.lives && current.score === next.score && current.phase === next.phase && current.levelName === next.levelName
            ? current
            : { lives: next.lives, score: next.score, levelName: next.levelName, weapon: next.weapon, phase: next.phase, mode: next.mode }
        ));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }).catch(() => {
      if (!cancelled) {
        setFailed(true);
        setStatus("Your Friend’s artwork could not load. Check the wallet network and retry.");
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stop();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
      engine.current = null;
    };
  }, [friendId, client, revision]);

  useEffect(() => {
    if (paused || menu !== null) engine.current?.stopInput();
  }, [paused, menu]);

  async function act(work: () => Promise<void>, cue?: Cue, after?: () => void) {
    if (locked.current || paused) return;
    const version = epoch.current;
    locked.current = true;
    setBusy(true);
    setError("");
    void sound.current?.unlock();
    try {
      await work();
      const value = await client.read();
      if (version === epoch.current) {
        setSnapshot(value);
        if (cue) sound.current?.play(cue);
        after?.();
      }
    } catch (cause) {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "The preview action failed.");
    } finally {
      if (version === epoch.current) { locked.current = false; setBusy(false); }
    }
  }

  function begin(mode: Mode) {
    void sound.current?.unlock();
    engine.current?.start(mode);
    setMenu(null);
    canvas.current?.focus();
  }

  function deploy(name: string) {
    engine.current?.applyDrop(name);
    setMessage(`${name} deployed into the current run.`);
    setMenu(null);
  }

  const definition = client.definition;
  const blocked = paused || menu !== null || Boolean(status);
  const maxPrize = maximumPrize(definition);
  const canBuy = snapshot ? snapshot.rfBalance >= definition.price && snapshot.freeStake >= maxPrize && snapshot.freeStake + definition.price >= maxPrize : false;
  const pending = snapshot?.plays.find(play => play.outcomeId === null);
  const outcome = result?.outcomeId ? definition.outcomes[result.outcomeId - 1] : null;

  const openDrop = () => act(async () => {
    const version = epoch.current;
    const play = pending ?? (await client.play(1n))[0];
    const settled = await client.settle(play.id);
    if (version === epoch.current) { setResult(settled); setMenu("reward"); }
  }, "reveal-common");

  return <section className="rf-force" aria-label="Rare Force">
    <div className="rf-force-stage" inert={paused || (menu !== null && menu !== "title") || undefined}>
      <canvas
        ref={canvas}
        width={VIEW.w}
        height={VIEW.h}
        tabIndex={blocked ? -1 : 0}
        aria-label="Rare Force battlefield. A D or arrows move, W or space jump, J or tap Fire to shoot."
        onBlur={() => engine.current?.stopInput()}
        onKeyDown={event => {
          if (blocked) return;
          const key = event.key.toLowerCase();
          if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
          engine.current?.setKey(event.key, true);
          if (key === "p" && engine.current?.hud().phase === "dead") engine.current.retry();
        }}
        onKeyUp={event => engine.current?.setKey(event.key, false)}
      />
      <div className="rf-force-hud">
        <div className="rf-force-title">
          <strong>RARE FORCE</strong>
          <span>{hud.levelName} · {hud.weapon.toUpperCase()}</span>
        </div>
        <span className="rf-force-stat">♥ {hud.lives}</span>
        <span className="rf-force-stat">{hud.score.toString().padStart(6, "0")}</span>
        <button type="button" onClick={() => setMenu("armory")}>Armory</button>
        <button type="button" onClick={() => setMenu("settings")}>Settings</button>
      </div>
      {hud.phase === "dead" && menu === null && <div className="rf-force-banner">
        <p>Downed. {hud.lives} {hud.lives === 1 ? "life" : "lives"} left.</p>
        <button type="button" onClick={() => { engine.current?.retry(); canvas.current?.focus(); }}>Continue</button>
      </div>}
      {hud.phase === "over" && menu === null && <div className="rf-force-banner">
        <p>Mission failed. Score {hud.score}.</p>
        <button type="button" onClick={() => { engine.current?.retry(); setMenu("title"); }}>Return to brief</button>
      </div>}
      {hud.phase === "win" && menu === null && <div className="rf-force-banner">
        <p>Core destroyed. Score {hud.score}.</p>
        <button type="button" onClick={() => setMenu("armory")}>Open armory</button>
        <button type="button" onClick={() => { engine.current?.retry(); setMenu("title"); }}>Play again</button>
      </div>}
      <div className="rf-force-pads" aria-hidden="true">
        <div className="rf-force-cluster">
          <button type="button" disabled={blocked} onPointerDown={event => { event.preventDefault(); engine.current?.pointers.set(event.pointerId, { role: "p1-left", x: 0, y: 0 }); }}
            onPointerUp={event => engine.current?.pointers.delete(event.pointerId)} onPointerCancel={event => engine.current?.pointers.delete(event.pointerId)}>◀</button>
          <button type="button" disabled={blocked} onPointerDown={event => { event.preventDefault(); engine.current?.pointers.set(event.pointerId, { role: "p1-right", x: 0, y: 0 }); }}
            onPointerUp={event => engine.current?.pointers.delete(event.pointerId)} onPointerCancel={event => engine.current?.pointers.delete(event.pointerId)}>▶</button>
        </div>
        <div className="rf-force-cluster">
          <button type="button" disabled={blocked} onPointerDown={event => { event.preventDefault(); engine.current?.pointers.set(event.pointerId, { role: "p1-jump", x: 0, y: 0 }); }}
            onPointerUp={event => engine.current?.pointers.delete(event.pointerId)} onPointerCancel={event => engine.current?.pointers.delete(event.pointerId)}>JUMP</button>
          <button type="button" className="rf-force-fire" disabled={blocked} onPointerDown={event => { event.preventDefault(); engine.current?.pointers.set(event.pointerId, { role: "p1-fire", x: 0, y: 0 }); }}
            onPointerUp={event => engine.current?.pointers.delete(event.pointerId)} onPointerCancel={event => engine.current?.pointers.delete(event.pointerId)}>FIRE</button>
        </div>
      </div>
      <p className="rf-force-hint">
        <span className="rf-force-desktop">P1 A/D move · W/Space jump · J/Z fire · P2 arrows + Enter fire · </span>
        Touch pads work on phones
      </p>
    </div>

    {status && <div className="rf-force-status" role={failed ? "alert" : "status"}>
      <p>{status}</p>
      {failed && <button type="button" disabled={paused} onClick={() => setRevision(value => value + 1)}>Retry loading</button>}
    </div>}

    {menu && <GameMenu
      title={menu === "title" ? "Rare Force" : menu === "armory" ? "Field armory" : menu === "reward" ? "Supply drop" : menu === "inventory" ? "Medals & kit" : menu === "help" ? "How to play" : "Settings"}
      onClose={busy || menu === "title" ? undefined : () => setMenu(null)}>
      {menu === "title" ? <>
        <p>Your verified Rare Friend drops into a four-stage run-and-gun. Original 16×16 artwork is preserved — that Friend is player one.</p>
        <p>Solo deploys Friend #{ALLY_ID.toString()} as an AI rifle partner. Local co-op puts a second operator on the arrows.</p>
        <button type="button" className="rf-frame-primary" disabled={paused || Boolean(status)} onClick={() => begin("solo")}>Solo + AI partner</button>
        <button type="button" disabled={paused || Boolean(status)} onClick={() => begin("coop")}>Local 2-player</button>
        <button type="button" disabled={paused} onClick={() => setMenu("help")}>Controls</button>
        <button type="button" disabled={paused} onClick={() => setMenu("armory")}>Armory · simulated RF</button>
      </> : menu === "help" ? <>
        <p><strong>P1</strong> A/D or touch pads to run, W / Space / JUMP to jump, J / Z / FIRE to shoot.</p>
        <p><strong>P2</strong> Arrow keys to run, Up to jump, Enter or Shift to shoot.</p>
        <p>Four stages: Jungle Drop, Waterfall Ascent, Red Base, Core Guardian. Shared lives. Checkpoints last for this visit only.</p>
        <p>Buy a simulated supply drop in the armory, then deploy the field bonus into the run.</p>
        <button type="button" onClick={() => setMenu("title")}>Back</button>
      </> : menu === "armory" && snapshot ? <>
        <p>Preview balance {rf(snapshot.rfBalance)} · {snapshot.consumables.toString()} drops ready. All purchases and rewards are simulated.</p>
        <table><thead><tr><th>Drop</th><th>Chance</th><th>Value</th></tr></thead>
          <tbody>{definition.outcomes.map(item => <tr key={item.name}><td>{item.name}</td><td>{item.chanceBps / 100}%</td><td>{rf(item.reward)}</td></tr>)}</tbody></table>
        <button type="button" className="rf-frame-primary" disabled={!canBuy || busy || paused} onClick={() => void act(() => client.buy(1n), "purchase", () => setMessage("One simulated supply drop added."))}>Buy supply drop · {rf(definition.price)}</button>
        <button type="button" disabled={busy || paused || !pending && snapshot.consumables === 0n} onClick={() => void openDrop()}>{pending ? "Finish pending drop" : "Open one drop"}</button>
        <button type="button" disabled={paused} onClick={() => setMenu("inventory")}>Medals & kit</button>
        {!canBuy && <p>{snapshot.rfBalance < definition.price ? "Not enough simulated RF." : "Purchases pause until free backing covers the 3 RF hero bounty."}</p>}
        <p>Each drop reserves {rf(maxPrize)}.</p>
      </> : menu === "reward" && outcome ? <>
        <h3>{outcome.name}</h3>
        <p>{rf(outcome.reward)} · {outcome.chanceBps / 100}% · {outcomeBonus(outcome.name)}</p>
        <button type="button" disabled={paused} onClick={() => deploy(outcome.name)}>Deploy into this run</button>
        <button type="button" disabled={paused} onClick={() => setMenu("inventory")}>Keep in inventory</button>
        {outcome.reward > 0n && <button type="button" disabled={busy || paused} onClick={() => void act(() => client.redeem(result!.outcomeId!, 1n), "reward", () => setMenu("inventory"))}>Redeem · {rf(outcome.reward)}</button>}
      </> : menu === "inventory" && snapshot ? <>
        <p>Kept medals retain a fixed simulated value with no expiry. Deploying a kit only affects the current run.</p>
        {definition.outcomes.map((item, index) => <div className="rf-force-item" key={item.name}>
          <span><strong>{item.name}</strong><small>{snapshot.inventory[index].toString()} owned · {rf(item.reward)}</small></span>
          <span className="rf-force-item-actions">
            <button type="button" disabled={paused || snapshot.inventory[index] === 0n} onClick={() => deploy(item.name)}>Deploy</button>
            <button type="button" disabled={busy || paused || snapshot.inventory[index] === 0n || item.reward === 0n} onClick={() => void act(() => client.redeem(index + 1, 1n), "reward")}>Redeem</button>
          </span>
        </div>)}
      </> : menu === "settings" ? <>
        <button type="button" aria-pressed={!muted} onClick={() => {
          const next = !muted; setMuted(next); sound.current?.setMuted(next); if (!next) void sound.current?.unlock();
        }}>{muted ? "Sound off" : "Sound on"}</button>
        <label><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /> Reduce motion</label>
        <p>Wallet connection and ownership checks stay in the SDK runtime.</p>
        <p>No networked multiplayer — the sandbox has no live player server. Co-op is local, plus an AI Rare Friend partner.</p>
        <p>Progress resets on reload. Simulated RF only.</p>
      </> : <p>Loading armory…</p>}
      <p role={error ? "alert" : "status"}>{error || message || (busy ? "Waiting for preview confirmation…" : "")}</p>
    </GameMenu>}
  </section>;
}
