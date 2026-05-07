// ==UserScript==
// @name         ShikiPlayer
// @namespace    https://github.com/Onzis/ShikiPlayer
// @version      2.0
// @description  Player for Shikimori
// @author       Onzis

// @match        *://shikimori.one/*
// @match        *://shikimori.me/*
// @match        *://shikimori.io/*
// @match        *://shiki.one/*

// @match        *://beggins-as.pljjalgo.online/*
// @match        *://beggins-as.allarknow.online/*
// @match        *://beggins-as.algonoew.online/*

// @grant        GM.xmlHttpRequest
// @connect      kodikapi.com
// @connect      apicollaps.cc
// @connect      fbphdplay.top
// @connect      shikimori.one
// @connect      shikimori.me
// @connect      shikimori.io

// @run-at       document-end
// ==/UserScript==

"use strict";

// ===================== UTILS =====================
class GMHttp {
 async fetch(url, init = {}) {
  return new Promise((resolve, reject) => {
   GM.xmlHttpRequest({
    url: url.toString(),
    method: init.method || "GET",
    headers: init.headers || {},
    data: init.body,
    timeout: init.timeout || 5000,
    responseType: "blob",
    onload: r => resolve(new Response(r.response, { status: r.status })),
    onerror: reject,
    ontimeout: () => reject(new Error("Timeout"))
   });
  });
 }
}

const parseJSON = (text) => {
 try { return JSON.parse(text); }
 catch { throw new Error("Invalid JSON"); }
};

const setItemStatus = (item, status) => {
 const i = item.querySelector(".sp-status-indicator");
 item.classList.remove("loading");
 if (!i) return;
 i.classList.remove("loading", "online", "offline");
 i.classList.add(status);
};

// ===================== BASE PLAYER =====================
class PlayerBase {
 dispose() {}
}

class IframePlayer extends PlayerBase {
 constructor(url, name) {
  super();
  this.name = name;
  this.element = document.createElement("iframe");
  this.element.allowFullscreen = true;
  this.element.style.width = "100%";
  this.element.style.aspectRatio = "16/9";
  this.element.src = new URL(url).toString();
 }
}

// ===================== FACTORIES =====================
class SimpleFactory {
 constructor(type) { this.name = type; }
 create(kodik, players) {
  if (!kodik?.kinopoisk_id) return null;
  const p = players.find(x => x.type === this.name);
  return p?.iframeUrl ? new IframePlayer(p.iframeUrl, this.name) : null;
 }
}

class KodikPlayer extends PlayerBase {
 constructor(uid, data) {
  super();
  if (!data.length) throw new Error("No translations");
  this.data = data;
  this.uid = uid;
  this.current = data[0];

  this.element = document.createElement("iframe");
  this.element.allowFullscreen = true;
  this.element.style.width = "100%";
  this.element.style.aspectRatio = "16/9";

  this.update();

  this.onMessage = this.onMessage.bind(this);
  window.addEventListener("message", this.onMessage);
 }

 update() {
  const src = new URL(`https:${this.current.link}`);
  src.searchParams.set("uid", this.uid);
  this.element.src = src;
 }

 onMessage(e) {
  if (e.source !== this.element.contentWindow) return;
 }

 dispose() {
  window.removeEventListener("message", this.onMessage);
 }
}

class KodikFactory {
 constructor(uid, api) {
  this.uid = uid;
  this.api = api;
  this.name = "Kodik";
 }
 async create(id) {
  const res = await this.api.search(id);
  return res.length ? new KodikPlayer(this.uid, res) : null;
 }
}

// ===================== API =====================
class KodikApi {
 constructor(http, token) {
  this.http = http;
  this.token = token;
 }
 async search(id) {
  const url = new URL("https://kodikapi.com/search");
  url.searchParams.set("token", this.token);
  url.searchParams.set("shikimori_id", id);

  const r = await this.http.fetch(url);
  const data = parseJSON(await r.text());
  return data.results || [];
 }
}

class KinoboxApi {
 constructor(http) { this.http = http; }
 async players(kp) {
  const url = new URL("https://fbphdplay.top/api/players");
  url.searchParams.set("kinopoisk", kp);

  const r = await this.http.fetch(url, {
   headers: { Origin: "https://fbphdplay.top" }
  });

  const data = parseJSON(await r.text());
  return Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
 }
}

// ===================== MAIN =====================
class ShikiPlayer {
 constructor(factories, kodikApi, kinoboxApi) {
  this.factories = factories;
  this.kodikApi = kodikApi;
  this.kinoboxApi = kinoboxApi;

  this.el = document.createElement("div");
  this.el.className = "sp-root";

  this.el.innerHTML = `
   <style>
    .sp-root *{box-sizing:border-box;font-family:system-ui,sans-serif}
    .sp-wrapper{background:#111;border:1px solid #2d2d2d;border-radius:14px;overflow:hidden;margin:20px 0}
    .sp-header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#1a1a1a;border-bottom:1px solid #2d2d2d}
    .sp-title{color:#fff;font-size:16px;font-weight:600}
    .sp-controls{display:flex;gap:10px}
    .sp-btn,.sp-player-item{background:#222;color:#fff;border:1px solid #333;border-radius:10px;padding:8px 12px;cursor:pointer;transition:.2s}
    .sp-btn:hover,.sp-player-item:hover{background:#2a2a2a}
    .sp-viewer{position:relative;background:#000;min-height:500px}
    .sp-viewer iframe{width:100%;height:500px;border:none}
    .sp-dropdown{display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#161616;border-top:1px solid #2d2d2d}
    .sp-player-item{display:flex;align-items:center;gap:8px;color:#bbb}
    .sp-player-item.active{background:#4f46e5;border-color:#4f46e5;color:#fff}
    .sp-status{width:8px;height:8px;border-radius:50%;background:#666}
    .sp-status.online{background:#22c55e}
    .sp-status.offline{background:#ef4444}
    .sp-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.5)}
    .sp-theater{position:fixed!important;inset:0;z-index:99999;margin:0!important;border-radius:0!important}
    .sp-theater .sp-viewer iframe{height:100vh}
   </style>

   <div class="sp-wrapper">
    <div class="sp-header">
      <div class="sp-title">▶ Онлайн просмотр</div>
      <div class="sp-controls">
        <button class="sp-btn sp-theater-btn">Театр</button>
      </div>
    </div>

    <div class="sp-viewer">
      <div class="sp-loading">Загрузка...</div>
    </div>

    <div class="sp-dropdown"></div>
   </div>`;

  this.wrapper = this.el.querySelector(".sp-wrapper");
  this.viewer = this.el.querySelector(".sp-viewer");
  this.dropdown = this.el.querySelector(".sp-dropdown");
  this.loading = this.el.querySelector(".sp-loading");
  this.theaterBtn = this.el.querySelector(".sp-theater-btn");

  this.players = new Map();
  this.current = null;

  this.theaterBtn.onclick = () => {
   this.wrapper.classList.toggle("sp-theater");
   document.body.style.overflow = this.wrapper.classList.contains("sp-theater") ? "hidden" : "";
  };
 }

 async init() {
  const rateEl = document.querySelector(".b-user_rate");

  if (!rateEl) {
   console.error("ShikiPlayer: .b-user_rate not found");
   return;
  }

  const entry = rateEl.dataset.entry;
  if (!entry) return;

  let id;

  try {
   id = JSON.parse(entry).id;
  } catch (e) {
   console.error("ShikiPlayer: invalid data-entry", e);
   return;
  }

  if (!id) {
   console.error("ShikiPlayer: invalid anime id");
   return;
  }
  const mountTarget = document.querySelector(".b-db_entry") || document.querySelector(".l-page") || document.body;

  if (!this.el.isConnected) {
   mountTarget.after ? mountTarget.after(this.el) : mountTarget.appendChild(this.el);
  }

  const kodikFactory = this.factories.find(f => f.name === "Kodik");

  try {
   const kodik = await kodikFactory.create(id);
   if (kodik) {
    this.players.set("Kodik", kodik);
    this.switch("Kodik", kodik);
   }
  } catch (e) {
   console.error("Kodik error", e);
  }

  const kp = document.querySelector("a[href*='kinopoisk']")?.href.match(/(\d+)/)?.[0];

  if (!kp) {
   this.loading?.remove();
   return;
  }

  let players = [];

  try {
   players = await this.kinoboxApi.players(kp);
  } catch (e) {
   console.error("Players API error", e);
  }

  for (const f of this.factories) {
   const item = document.createElement("button");
   item.className = "sp-player-item";
   item.innerHTML = `<span>${f.name}</span><span class="sp-status"></span>`;

   this.dropdown.appendChild(item);

   try {
    const player = f.name === "Kodik"
     ? this.players.get("Kodik")
     : f.create({ kinopoisk_id: kp }, players);

    const status = item.querySelector(".sp-status");

    if (!player) {
     status.classList.add("offline");
     continue;
    }

    status.classList.add("online");
    this.players.set(f.name, player);

    item.onclick = () => this.switch(f.name, player);
   } catch {
    item.querySelector(".sp-status")?.classList.add("offline");
   }
  }

  this.loading.remove();
 }

 switch(name, player) {
  if (!player?.element) return;

  this.viewer.innerHTML = "";
  this.viewer.appendChild(player.element);

  for (const el of this.dropdown.children) {
   el.classList.toggle("active", el.textContent.includes(name));
  }

  this.current?.dispose?.();
  this.current = player;
 }
}

// ===================== START =====================
(function () {
 const allowedHosts = [
  "shikimori.one",
  "shikimori.me",
  "shikimori.io",
  "shiki.one"
 ];

 if (!allowedHosts.includes(location.hostname)) return;

 const http = new GMHttp();
 const kodikApi = new KodikApi(http, "a0457eb45312af80bbb9f3fb33de3e93");
 const kinoboxApi = new KinoboxApi(http);

 const factories = [
  new KodikFactory("", kodikApi),
  new SimpleFactory("Alloha"),
  new SimpleFactory("Collaps"),
  new SimpleFactory("Turbo"),
  new SimpleFactory("Lumex"),
  new SimpleFactory("Veoveo"),
  new SimpleFactory("Vibix")
 ];

 let app = null;

 async function waitForElement(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found: ${selector}`));
    }, timeout);
  });
 }

 async function boot() {
  try {
   document.querySelectorAll(".sp-root").forEach(e => e.remove());

   await waitForElement(".b-db_entry");
   await waitForElement(".b-user_rate");

   app = new ShikiPlayer(factories, kodikApi, kinoboxApi);
   await app.init();
  } catch (e) {
   console.error("ShikiPlayer boot error:", e);
  }
 }

 if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
 } else {
  setTimeout(boot, 300);
 }

 document.addEventListener("turbolinks:load", () => {
  setTimeout(boot, 300);
 });
})();
