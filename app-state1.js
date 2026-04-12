(() => {
  "use strict";
  const App = {};
  window.App = App;
  App.SAVE_KEY = "mindmap_full_integrated_v70";
  App.SLOT_KEY = "mindmap_multi_slots_v70";
  App.DOUBLE_TAP_MS = 320;
  App.DOUBLE_TAP_DIST = 26;
  App.LONG_PRESS_MS = 420;
  App.FIVEW2H_LABELS = ["Who","What","When","Where","Why","How","HowMuch"];
  App.WEB_SEARCH_TYPES = ["web","image","youtube"];
  App.MAP_TYPES = ["private","group","world"];
  App.ROLE_DEFS = [
    { key: "unassigned", label: "未配属", defaultCount: 2, color: "#9aa4b2" },
    { key: "adventurer", label: "冒険者", defaultCount: 1, color: "#f28b82" },
    { key: "interdisciplinary", label: "学際", defaultCount: 2, color: "#7bdff2" },
    { key: "editor", label: "編集者", defaultCount: 2, color: "#c7b8ff" },
    { key: "miner", label: "採掘", defaultCount: 2, color: "#ffd166" },
    { key: "painter", label: "画家", defaultCount: 1, color: "#8ce99a" },
    { key: "villager", label: "村人", defaultCount: 1, color: "#a5d8ff" }
  ];
  App.RSS_SOURCES = [{ name: "NHK", url: "https://www3.nhk.or.jp/rss/news/cat0.xml" }];
  App.RSS_STOPWORDS = new Set(["こと","もの","ため","これ","それ","など","よう","日本","東京","全国","速報","最新","発表","判明","ニュース","記事","動画","写真","会見","政府"]);
  App.dom = {
    canvas: document.getElementById("canvas"),
    startBtn: document.getElementById("startBtn"), stopBtn: document.getElementById("stopBtn"),
    saveBtn: document.getElementById("saveBtn"), loadBtn: document.getElementById("loadBtn"),
    fitBtn: document.getElementById("fitBtn"), alignBtn: document.getElementById("alignBtn"),
    settingsBtn: document.getElementById("settingsBtn"), toggleLogBtn: document.getElementById("toggleLogBtn"),
    followBtn: document.getElementById("followBtn"),
    quickInput: document.getElementById("quickInput"), quickInputClearBtn: document.getElementById("quickInputClearBtn"),
    quickEditBtn: document.getElementById("quickEditBtn"), quickAddBtn: document.getElementById("quickAddBtn"),
    quickSearchBtn: document.getElementById("quickSearchBtn"),
    settingsPanel: document.getElementById("settingsPanel"), logPanel: document.getElementById("logPanel"), log: document.getElementById("log"),
    viewModeBtn: document.getElementById("viewModeBtn"), editModeBtn: document.getElementById("editModeBtn"),
    linkModeBtn: document.getElementById("linkModeBtn"), webModeBtn: document.getElementById("webModeBtn"),
    pruneModeBtn: document.getElementById("pruneModeBtn"),
    nodeCount: document.getElementById("nodeCount"), linkCount: document.getElementById("linkCount"),
    selectedInfo: document.getElementById("selectedInfo"), agentCountMini: document.getElementById("agentCountMini"),
    followMini: document.getElementById("followMini"), zoomHud: document.getElementById("zoomHud"),
    modeBadge: document.getElementById("modeBadge"), mapTypeMini: document.getElementById("mapTypeMini"),
    userNameMini: document.getElementById("userNameMini"), userPointMini: document.getElementById("userPointMini"),
    stickWrap: document.getElementById("stickWrap"), stickKnob: document.getElementById("stickKnob"),
    nodeEditor: document.getElementById("nodeEditor"), nodeLabelInput: document.getElementById("nodeLabelInput"),
    nodeXInput: document.getElementById("nodeXInput"), nodeYInput: document.getElementById("nodeYInput"),
    nodeZInput: document.getElementById("nodeZInput"), nodeWidthInput: document.getElementById("nodeWidthInput"),
    nodeHeightInput: document.getElementById("nodeHeightInput"), nodeRadiusInput: document.getElementById("nodeRadiusInput"),
    nodeShapeInput: document.getElementById("nodeShapeInput"), nodeFixedInput: document.getElementById("nodeFixedInput"),
    nodeHiddenInput: document.getElementById("nodeHiddenInput"), nodeThumbInput: document.getElementById("nodeThumbInput"),
    nodeLinkInput: document.getElementById("nodeLinkInput"), nodeMemoInput: document.getElementById("nodeMemoInput"),
    nodeColorInput: document.getElementById("nodeColorInput"), nodeSaveBtn: document.getElementById("nodeSaveBtn"),
    nodeDeleteBtn: document.getElementById("nodeDeleteBtn"), nodeCloseBtn: document.getElementById("nodeCloseBtn"),
    agentEditor: document.getElementById("agentEditor"), agentNameInput: document.getElementById("agentNameInput"),
    agentRoleInput: document.getElementById("agentRoleInput"), agentDestinationInput: document.getElementById("agentDestinationInput"),
    agentHpInput: document.getElementById("agentHpInput"), agentHungerInput: document.getElementById("agentHungerInput"),
    agentSaveBtn: document.getElementById("agentSaveBtn"), agentCloseBtn: document.getElementById("agentCloseBtn"),
    topBarPanel: document.getElementById("topBarPanel"), pinTopBarBtn: document.getElementById("pinTopBarBtn"),
    pinSettingsBtn: document.getElementById("pinSettingsBtn"), zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    nodeDetailPanel: document.getElementById("nodeDetailPanel"), nodeDetailBody: document.getElementById("nodeDetailBody"),
    pinDetailBtn: document.getElementById("pinDetailBtn"), toggleNodeDetailBtn: document.getElementById("toggleNodeDetailBtn"),
    tabAgentBtn: document.getElementById("tabAgentBtn"), tabViewBtn: document.getElementById("tabViewBtn"),
    tabPhysicsBtn: document.getElementById("tabPhysicsBtn"), tabDataBtn: document.getElementById("tabDataBtn"),
    tabWorldBtn: document.getElementById("tabWorldBtn"),
    settingsAgentSection: document.getElementById("settingsAgentSection"), settingsViewSection: document.getElementById("settingsViewSection"),
    settingsPhysicsSection: document.getElementById("settingsPhysicsSection"), settingsDataSection: document.getElementById("settingsDataSection"),
    settingsWorldSection: document.getElementById("settingsWorldSection"),
    webSearchPanel: document.getElementById("webSearchPanel"), closeWebSearchBtn: document.getElementById("closeWebSearchBtn"),
    webSearchTabBtn: document.getElementById("webSearchTabBtn"), imageSearchTabBtn: document.getElementById("imageSearchTabBtn"),
    youtubeSearchTabBtn: document.getElementById("youtubeSearchTabBtn"), webSearchQueryInput: document.getElementById("webSearchQueryInput"),
    runWebSearchBtn: document.getElementById("runWebSearchBtn"), applyWebSearchSelectionBtn: document.getElementById("applyWebSearchSelectionBtn"),
    webSearchStatus: document.getElementById("webSearchStatus"), webSearchResults: document.getElementById("webSearchResults"),
    saveSlotPanel: document.getElementById("saveSlotPanel"), closeSaveSlotPanelBtn: document.getElementById("closeSaveSlotPanelBtn"),
    mapTypeSelect: document.getElementById("mapTypeSelect"), userNameInput: document.getElementById("userNameInput"),
    saveNameInput: document.getElementById("saveNameInput"), saveToSlotBtn: document.getElementById("saveToSlotBtn"),
    refreshSlotListBtn: document.getElementById("refreshSlotListBtn"), saveSlotList: document.getElementById("saveSlotList"),
    saveSlotModeText: document.getElementById("saveSlotModeText"),
    youtubeOverlay: document.getElementById("youtubeOverlay"), youtubePlayerWrap: document.getElementById("youtubePlayerWrap"),
    closeYoutubeOverlayBtn: document.getElementById("closeYoutubeOverlayBtn")
  };
  App.ctx = App.dom.canvas.getContext("2d");
  App.W = 0; App.H = 0; App.DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); App.view = { x: 0, y: 0, scale: 1 };
  App.currentMapType = "private"; App.currentMapId = "local-primary"; App.currentSaveName = ""; App.saveSlots = [];
  App.userState = { userId: "localUser", userName: "guest", points: 0, walletOpened: false, evaluatorRank: 5, authorRank: 5 };
  App.integrations = { youtubeApiKey: "", googleApiKey: "", googleCx: "" };
  App.searchProviders = { web: { duckduckgo: true, wikipedia: true, google: false, yahoo: false }, image: { wikipedia: true, google: false, yahoo: false } };
  App.uiState = { showGrid: true, fix5w2h: true, showLinkType: false, compactText: true, physics: true, repel: 150, spring: 10, damping: 92, inter: true, autoExpand: true, expandCount: 2, autoSave: true, autoSaveSec: 15, rssEnabled: true, rssRefreshMin: 15, showAgentLinks: true, visibleNodeLimit: Infinity, agentsIgnoreHiddenNodes: true, showNodeDetailPanel: true, autoShowNodeDetail: true, nodeDetailCollapsed: true, showHint: true, showLegend: true, showMiniInfo: true };
  App.rssState = { items: [], keywordCounts: new Map(), lastFetchAt: 0, fetching: false, seenHeadlines: new Set() };
  App.rssTimer = null; App.visibleNodeSet = new Set();
  App.roleCounts = Object.fromEntries(App.ROLE_DEFS.map(r => [r.key, r.defaultCount]));
  App.totalAgentCount = Object.values(App.roleCounts).reduce((a, b) => a + b, 0);
  App.nodes = []; App.links = []; App.agents = []; App.parties = []; App.partyCounter = 1; App.agentCount = 0; App.followAgentId = null; App.pendingAgentTargetId = null;
  App.selectedNodeId = null; App.hoveredNodeId = null; App.linkingFromId = null; App.editingNodeId = null; App.editingAgentId = null; App.zoomedImageNodeId = null; App.playingYoutubeNodeId = null;
  App.running = true; App.mode = "view"; App.webSubMode = "web";
  App.idCounter = 1; App.frame = 0; App.autoSaveTimer = null;
  App.pointerDown = false; App.draggingNodeId = null; App.resizingNodeId = null; App.panning = false; App.dragOffsetWorldX = 0; App.dragOffsetWorldY = 0; App.lastPointer = { x: 0, y: 0 }; App.lastTapTime = 0; App.lastTapX = 0; App.lastTapY = 0; App.longPressTimer = null;
  App.searchResults = []; App.searchIndex = 0; App.lastSearchQuery = "";
  App.webSearchState = { sourceNodeId: null, query: "", type: "web", running: false, results: [], selectedResultIds: new Set() };
  App.panelPins = { topBarPanel: true, settingsPanel: true, nodeDetailPanel: true };
  App.panelPositions = { topBarPanel: { left: 8, top: 8 }, settingsPanel: { left: 8, top: 88 }, nodeDetailPanel: { left: Math.max(8, window.innerWidth - 300), top: 150 } };
  App.stickState = { active: false, dx: 0, dy: 0, max: 32 };
})();