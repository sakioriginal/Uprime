/* =========================
   app-state.js
   定数 / 状態 / DOM参照
========================= */

(() => {
  "use strict";

  const App = window.App || (window.App = {});

  /* =========================
     Storage / Constants
  ========================= */
  App.SAVE_KEY = "mindmap_full_integrated_v3";

  App.ROLE_DEFS = [
    { key:"unassigned", label:"未配属", defaultCount:2, color:"#9aa4b2" },
    { key:"adventurer", label:"冒険者", defaultCount:1, color:"#f28b82" },
    { key:"interdisciplinary", label:"学際", defaultCount:2, color:"#7bdff2" },
    { key:"editor", label:"編集者", defaultCount:3, color:"#c7b8ff" },
    { key:"miner", label:"採掘", defaultCount:2, color:"#ffd166" },
    { key:"painter", label:"画家", defaultCount:1, color:"#8ce99a" },
    { key:"villager", label:"村人", defaultCount:1, color:"#a5d8ff" }
  ];

  App.RSS_SOURCES = [
    { name:"NHK", url:"https://www3.nhk.or.jp/rss/news/cat0.xml" },
    { name:"Yahoo", url:"https://news.yahoo.co.jp/rss/topics/top-picks.xml" }
  ];

  App.RSS_STOPWORDS = new Set([
    "こと","もの","ため","これ","それ","など","よう",
    "日本","東京","全国","速報","最新","発表","判明",
    "ニュース","記事","動画","写真","会見","政府"
  ]);

  App.FIVEW2H_LABELS = ["Who","What","When","Where","Why","How","HowMuch"];

  App.DOUBLE_TAP_MS = 320;
  App.DOUBLE_TAP_DIST = 26;
  App.LONG_PRESS_MS = 420;

  /* =========================
     DOM
  ========================= */
  App.dom = {
    canvas: document.getElementById("canvas"),

    startBtn: document.getElementById("startBtn"),
    stopBtn: document.getElementById("stopBtn"),
    saveBtn: document.getElementById("saveBtn"),
    loadBtn: document.getElementById("loadBtn"),
    fitBtn: document.getElementById("fitBtn"),
    alignBtn: document.getElementById("alignBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    toggleLogBtn: document.getElementById("toggleLogBtn"),
    followBtn: document.getElementById("followBtn"),

    quickInput: document.getElementById("quickInput"),
    quickEditBtn: document.getElementById("quickEditBtn"),
    quickAddBtn: document.getElementById("quickAddBtn"),
    quickSearchBtn: document.getElementById("quickSearchBtn"),

    settingsPanel: document.getElementById("settingsPanel"),
    logPanel: document.getElementById("logPanel"),
    logEl: document.getElementById("log"),

    viewModeBtn: document.getElementById("viewModeBtn"),
    editModeBtn: document.getElementById("editModeBtn"),
    linkModeBtn: document.getElementById("linkModeBtn"),

    nodeCountEl: document.getElementById("nodeCount"),
    linkCountEl: document.getElementById("linkCount"),
    selectedInfoEl: document.getElementById("selectedInfo"),
    agentCountMini: document.getElementById("agentCountMini"),
    followMini: document.getElementById("followMini"),
    zoomHud: document.getElementById("zoomHud"),
    modeBadge: document.getElementById("modeBadge"),

    stickWrap: document.getElementById("stickWrap"),
    stickKnob: document.getElementById("stickKnob"),

    nodeEditor: document.getElementById("nodeEditor"),
    nodeLabelInput: document.getElementById("nodeLabelInput"),
    nodeMemoInput: document.getElementById("nodeMemoInput"),
    nodeColorInput: document.getElementById("nodeColorInput"),
    nodeSaveBtn: document.getElementById("nodeSaveBtn"),
    nodeDeleteBtn: document.getElementById("nodeDeleteBtn"),
    nodeCloseBtn: document.getElementById("nodeCloseBtn"),

    topBarPanel: document.getElementById("topBarPanel"),
    pinTopBarBtn: document.getElementById("pinTopBarBtn"),
    pinSettingsBtn: document.getElementById("pinSettingsBtn"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),

    nodeDetailPanel: document.getElementById("nodeDetailPanel"),
    nodeDetailBody: document.getElementById("nodeDetailBody"),
    pinDetailBtn: document.getElementById("pinDetailBtn"),

    tabAgentBtn: document.getElementById("tabAgentBtn"),
    tabViewBtn: document.getElementById("tabViewBtn"),
    tabPhysicsBtn: document.getElementById("tabPhysicsBtn"),
    tabDataBtn: document.getElementById("tabDataBtn"),

    settingsAgentSection: document.getElementById("settingsAgentSection"),
    settingsViewSection: document.getElementById("settingsViewSection"),
    settingsPhysicsSection: document.getElementById("settingsPhysicsSection"),
    settingsDataSection: document.getElementById("settingsDataSection")
  };

  App.ctx = App.dom.canvas.getContext("2d");

  /* =========================
     View / Canvas
  ========================= */
  App.W = 0;
  App.H = 0;
  App.DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  App.view = {
    x: 0,
    y: 0,
    scale: 1
  };

  /* =========================
     Core State
  ========================= */
  App.roleCounts = Object.fromEntries(
    App.ROLE_DEFS.map(r => [r.key, r.defaultCount])
  );

  App.totalAgentCount = Object.values(App.roleCounts).reduce((a, b) => a + b, 0);

  App.uiState = {
    showGrid: true,
    fix5w2h: true,
    showLinkType: false,
    compactText: true,
    physics: true,
    repel: 150,
    spring: 10,
    damping: 92,
    inter: true,
    autoExpand: true,
    expandCount: 2,
    autoSave: true,
    autoSaveSec: 15,
    rssEnabled: true,
    rssRefreshMin: 15,
    showAgentLinks: true,
    visibleNodeLimit: Infinity,
    agentsIgnoreHiddenNodes: true
  };

  App.rssState = {
    items: [],
    keywordCounts: new Map(),
    lastFetchAt: 0,
    fetching: false,
    seenHeadlines: new Set()
  };

  App.visibleNodeSet = new Set();

  App.nodes = [];
  App.links = [];
  App.agents = [];

  App.running = true;
  App.mode = "view";

  App.agentCount = 0;
  App.followAgentId = null;
  App.selectedNodeId = null;
  App.hoveredNodeId = null;
  App.linkingFromId = null;
  App.editingNodeId = null;
  App.pendingAgentTargetId = null;

  App.autoSaveTimer = null;
  App.rssTimer = null;
  App.longPressTimer = null;

  App.idCounter = 1;
  App.frame = 0;

  /* =========================
     Pointer / Drag State
  ========================= */
  App.pointerDown = false;
  App.draggingNodeId = null;
  App.resizingNodeId = null;
  App.panning = false;

  App.dragOffsetWorldX = 0;
  App.dragOffsetWorldY = 0;

  App.lastPointer = { x: 0, y: 0 };

  App.lastTapTime = 0;
  App.lastTapX = 0;
  App.lastTapY = 0;

  /* =========================
     Search State
  ========================= */
  App.searchResults = [];
  App.searchIndex = 0;
  App.lastSearchQuery = "";

  /* =========================
     Panel / UI Layout
  ========================= */
  App.panelPins = {
    topBarPanel: true,
    settingsPanel: true,
    nodeDetailPanel: true
  };

  App.panelPositions = {
    topBarPanel: { left: 8, top: 8 },
    settingsPanel: { left: 8, top: 88 },
    nodeDetailPanel: {
      left: Math.max(8, window.innerWidth - 388),
      top: 150
    }
  };

  App.stickState = {
    active: false,
    dx: 0,
    dy: 0,
    max: 32
  };

  /* =========================
     Simple helpers stored in state namespace
  ========================= */
  App.resetTransientFlags = function resetTransientFlags() {
    App.pointerDown = false;
    App.draggingNodeId = null;
    App.resizingNodeId = null;
    App.panning = false;
    App.hoveredNodeId = null;
    App.linkingFromId = null;
    App.editingNodeId = null;
  };
})();