(() => {
  "use strict";

  const App = window.App;
  if (!App) {
    throw new Error("App が先に初期化されていません。app-state.js を先に読み込んでください。");
  }

  console.log("app-agents loaded");

  /* =========================
     Role display helpers
  ========================= */
  App.roleLabelJa = function roleLabelJa(roleKey) {
    const found = App.ROLE_DEFS.find(r => r.key === roleKey);
    return found ? found.label : roleKey;
  };

  App.roleColor = function roleColor(roleKey) {
    const found = App.ROLE_DEFS.find(r => r.key === roleKey);
    return found ? found.color : "#ff8be6";
  };

  /* =========================
     RSS fetch / parse
  ========================= */
  App.parseRssXmlText = function parseRssXmlText(xmlText, feedUrl) {
    const xml = new DOMParser().parseFromString(xmlText, "text/xml");
    const parserError = xml.querySelector("parsererror");
    if (parserError) {
      throw new Error(`RSS XML parse error: ${feedUrl}`);
    }

    const items = [...xml.querySelectorAll("item")];
    return items.map(item => ({
      title: item.querySelector("title")?.textContent?.trim() || "",
      link: item.querySelector("link")?.textContent?.trim() || "",
      pubDate: item.querySelector("pubDate")?.textContent?.trim() || "",
      sourceFeed: feedUrl
    }));
  };

  App.fetchRssDirect = async function fetchRssDirect(feedUrl) {
    const res = await fetch(feedUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`direct fetch failed: ${feedUrl}`);
    const text = await res.text();
    return App.parseRssXmlText(text, feedUrl);
  };

  App.fetchRssViaAllOrigins = async function fetchRssViaAllOrigins(feedUrl) {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
    const res = await fetch(proxy, { cache: "no-store" });
    if (!res.ok) throw new Error(`allorigins failed: ${feedUrl}`);
    const data = await res.json();
    if (!data?.contents) throw new Error(`allorigins empty: ${feedUrl}`);
    return App.parseRssXmlText(data.contents, feedUrl);
  };

  App.fetchRssViaRss2Json = async function fetchRssViaRss2Json(feedUrl) {
    const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const res = await fetch(api, { cache: "no-store" });
    if (!res.ok) throw new Error(`rss2json failed: ${feedUrl}`);

    const data = await res.json();
    if (data.status !== "ok") throw new Error(`rss2json bad status: ${feedUrl}`);

    return (data.items || []).map(item => ({
      title: item.title || "",
      link: item.link || "",
      pubDate: item.pubDate || "",
      sourceFeed: feedUrl
    }));
  };

  App.fetchRssFeed = async function fetchRssFeed(feedUrl) {
    const errors = [];

    try { return await App.fetchRssDirect(feedUrl); }
    catch (e) { errors.push(`direct:${e.message}`); }

    try { return await App.fetchRssViaAllOrigins(feedUrl); }
    catch (e) { errors.push(`allorigins:${e.message}`); }

    try { return await App.fetchRssViaRss2Json(feedUrl); }
    catch (e) { errors.push(`rss2json:${e.message}`); }

    throw new Error(errors.join(" | "));
  };

  App.rebuildRssKeywordCounts = function rebuildRssKeywordCounts() {
    const counts = new Map();

    for (const item of App.rssState.items) {
      const words = App.extractHeadlineKeywords(item.title);
      for (const w of words) {
        counts.set(w, (counts.get(w) || 0) + 1);
      }
    }

    App.rssState.keywordCounts = counts;
  };

  App.getRssHotKeywords = function getRssHotKeywords(limit = 20) {
    return [...App.rssState.keywordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  };

  App.refreshRssFeeds = async function refreshRssFeeds(force = false) {
    if (!App.uiState.rssEnabled) return;
    if (App.rssState.fetching) return;

    const now = Date.now();
    const refreshMs = Math.max(1, App.uiState.rssRefreshMin) * 60 * 1000;
    if (!force && now - App.rssState.lastFetchAt < refreshMs) return;

    App.rssState.fetching = true;

    try {
      const results = await Promise.allSettled(
        App.RSS_SOURCES.map(src => App.fetchRssFeed(src.url))
      );

      const items = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          r.value.forEach(item => {
            items.push({
              ...item,
              sourceName: App.RSS_SOURCES[i].name
            });
          });
        } else {
          console.warn("RSS fetch failed:", App.RSS_SOURCES[i].name, r.reason);
          App.addLog(`RSS失敗: ${App.RSS_SOURCES[i].name}`);
        }
      });

      App.rssState.items = items.slice(0, 120);
      App.rssState.lastFetchAt = now;
      App.rebuildRssKeywordCounts();
      App.addLog(`RSS更新: ${App.rssState.items.length}件`);

      for (const item of App.rssState.items.slice(0, 3)) {
        const title = String(item.title || "").trim();
        if (!title) continue;
        if (App.rssState.seenHeadlines.has(title)) continue;
        App.rssState.seenHeadlines.add(title);
        App.spawnHeadlineNode(title);
      }
    } catch (err) {
      console.error(err);
      App.addLog("RSS更新失敗");
    } finally {
      App.rssState.fetching = false;
    }
  };

  App.restartRssTimer = function restartRssTimer() {
    if (App.rssTimer) {
      clearInterval(App.rssTimer);
      App.rssTimer = null;
    }

    if (!App.uiState.rssEnabled) return;

    const intervalMs = Math.max(1, App.uiState.rssRefreshMin) * 60 * 1000;
    App.rssTimer = setInterval(() => {
      App.refreshRssFeeds(false);
    }, intervalMs);
  };

  /* =========================
     Wikipedia / Web helpers
  ========================= */
  App.wikiOpenSearch = async function wikiOpenSearch(query, limit = 5) {
    try {
      const url = `https://ja.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.[1]) ? data[1] : [];
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  App.wikiSummary = async function wikiSummary(title) {
    try {
      const url = `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  App.wikiRelatedWords = async function wikiRelatedWords(title, limit = 6) {
    const list = await App.wikiOpenSearch(title, limit + 2);
    return App.uniqueStrings(
      list
        .map(s => App.sanitizeGeneratedLabel(s))
        .filter(s => s && App.normalizeTitleKey(s) !== App.normalizeTitleKey(title))
        .slice(0, limit)
    );
  };

  App.wikiImageForTitle = async function wikiImageForTitle(title) {
    const summary = await App.wikiSummary(title);
    return summary?.thumbnail?.source || null;
  };

  App.webSuggestWords = async function webSuggestWords(title) {
    try {
      const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(title)}&type=list`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();

      return App.uniqueStrings(
        (data || [])
          .map(x => App.sanitizeGeneratedLabel(x.phrase || ""))
          .filter(Boolean)
          .filter(s => App.normalizeTitleKey(s) !== App.normalizeTitleKey(title))
      ).slice(0, 6);
    } catch (err) {
      console.warn(err);
      return [];
    }
  };

  App.webSignalWeights = async function webSignalWeights(title) {
    const weights = { Who: 0, What: 0, When: 0, Where: 0, Why: 0, How: 0 };
    const text = String(title || "");

    if (/人|者|企業|会社|住民|政府|軍|作者|利用者|メーカー/.test(text)) weights.Who += 2;
    if (/仕組み|方法|製造|設計|実装|手順|使い方|攻略/.test(text)) weights.How += 2;
    if (/理由|原因|背景|目的/.test(text)) weights.Why += 2;
    if (/場所|地域|都市|国|海峡|港|工場/.test(text)) weights.Where += 2;
    if (/時期|年|月|日|歴史|戦後|速報/.test(text)) weights.When += 2;
    if (/とは|意味|概要|性能|価格|構造|種類/.test(text)) weights.What += 2;

    try {
      const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(title)}&type=list`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const phrases = (data || []).map(x => String(x.phrase || ""));
        const joined = phrases.join(" ");

        if (/誰|企業|メーカー|人物/.test(joined)) weights.Who += 2;
        if (/どこ|場所|地域|拠点/.test(joined)) weights.Where += 2;
        if (/いつ|時期|年/.test(joined)) weights.When += 2;
        if (/なぜ|理由|原因/.test(joined)) weights.Why += 2;
        if (/どうやって|方法|仕組み|使い方/.test(joined)) weights.How += 2;
        if (/とは|意味|性能|価格|種類|構造/.test(joined)) weights.What += 2;
      }
    } catch (err) {
      console.warn("webSignalWeights suggest fetch failed", err);
    }

    return weights;
  };

  App.chooseTopW = function chooseTopW(weights, count = 2) {
    return Object.entries(weights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([k]) => k);
  };

  /* =========================
     Review / score
  ========================= */
  App.calcVerificationScore = function calcVerificationScore(node, wikiRelated, wikiSummaryOk, webRelated) {
    let score = 0;
    const label = String(node.title || node.label || "");
    const degree = App.getNodeDegree(node.id);

    if (wikiSummaryOk) score += 3;
    if ((wikiRelated || []).length > 0) score += 2;
    if ((webRelated || []).length > 0) score += 2;
    if (degree >= 3) score += 1;

    if (label.length >= 16) score -= 2;
    if ((label.match(/関連|入口|周辺|派生/g) || []).length >= 2) score -= 2;
    if ((label.match(/Who|What|When|Where|Why|How/g) || []).length >= 2) score -= 2;

    return score;
  };

  App.editorReviewNode = async function editorReviewNode(targetNode) {
    const base = targetNode.title || targetNode.label;
    if (targetNode.wikiBusy) return "busy";

    targetNode.wikiBusy = true;

    try {
      const wikiRelated = await App.wikiRelatedWords(base, 5);
      const wikiSum = await App.wikiSummary(base);
      const webRelated = await App.webSuggestWords(base);

      const summaryOk = !!wikiSum?.extract;

      targetNode.keywords = App.uniqueStrings([
        ...(targetNode.keywords || []),
        ...wikiRelated,
        ...webRelated
      ]);

      targetNode.tags = App.uniqueStrings([
        ...(targetNode.tags || []),
        "edited"
      ]);

      if (summaryOk && !targetNode.summary) {
        targetNode.summary = wikiSum.extract.slice(0, 140);
      }

      const score = App.calcVerificationScore(targetNode, wikiRelated, summaryOk, webRelated);
      targetNode.qualityScore = score;

      const degree = App.getNodeDegree(targetNode.id);

      if (score <= 0 && degree <= 1) {
        App.links = App.links.filter(l => l.source !== targetNode.id && l.target !== targetNode.id);
        App.nodes = App.nodes.filter(n => n.id !== targetNode.id);
        App.addLog(`編集者削除: ${base}`);
        return "deleted";
      }

      if (score <= 1) {
        let removed = 0;

        App.links = App.links.filter(l => {
          const hit = l.source === targetNode.id || l.target === targetNode.id;
          if (!hit) return true;

          const weak =
            l.type === "candidate" ||
            l.type === "explore" ||
            l.type === "agent-think";

          if (weak) {
            removed++;
            return false;
          }
          return true;
        });

        targetNode.tags = App.uniqueStrings([
          ...(targetNode.tags || []),
          "unverified",
          "editor-held"
        ]);
        targetNode.qualityScore = score;

        App.addLog(`編集者弱リンク整理: ${base} (${removed}本)`);
        return "hold";
      }

      if (score <= 3) {
        targetNode.tags = App.uniqueStrings([...(targetNode.tags || []), "unverified"]);
        App.addLog(`編集者保留: ${base}`);
        return "hold";
      }

      const candidates = [...wikiRelated, ...webRelated];
      let added = 0;

      for (const word of candidates) {
        if (App.nodeExistsByLabel(word)) continue;

        const child = App.makeNode({
          x: targetNode.x + (Math.random() - 0.5) * 160,
          y: targetNode.y + 90 + Math.random() * 50,
          label: word,
          memo: "編集者が検証追加",
          r: 18,
          color: "#1f2e3a",
          textColor: "#d7f3ff",
          isAutoCandidate: true,
          category: "auto-candidate",
          baseNodeId: targetNode.id
        });

        child.title = word;
        child.rootNodeId = child.id;
        child.tags = ["editor", "verified-candidate"];
        child.summary = `${base} の検証関連`;

        App.nodes.push(child);
        App.links.push(App.makeLink(targetNode.id, child.id, "candidate", 0.8, true));

        added++;
        if (added >= 2) break;
      }

      App.addLog(`編集者補強: ${base}`);
      return "kept";
    } finally {
      targetNode.wikiBusy = false;
    }
  };

  /* =========================
     Mining priority
  ========================= */
  App.getMinePriority = function getMinePriority(node) {
    if (!node) return -Infinity;
    if (node.is5w2h || node.isAgentNode) return -Infinity;
    if (node.tags?.includes("mined-out")) return -Infinity;
    if (node.visible === false) return -Infinity;

    const degree = App.getNodeDegree(node.id);
    const baseScore = typeof node.mineScore === "number" ? node.mineScore : 100;
    const hits = typeof node.mineHits === "number" ? node.mineHits : 0;
    const exhaustion = typeof node.mineExhaustion === "number" ? node.mineExhaustion : 0;
    const depth = typeof node.depth === "number" ? node.depth : 0;

    let score = baseScore;

    if (node.tags?.includes("fresh")) score += 25;
    if (node.tags?.includes("rss-seed")) score += 18;
    if (node.isUserCreated) score += 22;
    if ((node.userFocusScore || 0) > 0) score += node.userFocusScore;

    if (depth === 1) score += 12;
    if (depth === 2) score += 20;
    if (depth === 3) score += 12;
    if (depth >= 4) score -= depth * 6;

    score += Math.max(0, 24 - degree * 6);
    score -= hits * 20;
    score -= exhaustion * 24;

    if (typeof node.qualityScore === "number" && node.qualityScore < 2) {
      score -= 20;
    }

    return score;
  };

  App.decayMineScoreAfterMining = function decayMineScoreAfterMining(node, addedCount) {
    if (!node) return;

    const current = typeof node.mineScore === "number" ? node.mineScore : 100;
    const hits = typeof node.mineHits === "number" ? node.mineHits : 0;
    const exhaustion = typeof node.mineExhaustion === "number" ? node.mineExhaustion : 0;

    node.mineHits = hits + 1;
    node.mineExhaustion = exhaustion + (addedCount <= 0 ? 1 : 0);

    let next = current - 20;
    if (addedCount <= 0) next -= 24;

    node.mineScore = Math.max(0, next);

    if (node.mineScore <= 10 || node.mineHits >= 4) {
      node.tags = App.uniqueStrings([...(node.tags || []), "mined-out"]);
    }
  };

  App.refreshMineScoreForNewNode = function refreshMineScoreForNewNode(node, parentNode) {
    if (!node) return;

    const parentScore = typeof parentNode?.mineScore === "number" ? parentNode.mineScore : 100;
    const depth = typeof node.depth === "number" ? node.depth : 0;

    let score = 95;

    if (depth >= 1) score = Math.max(score, parentScore * 0.95 + 14);
    if (depth >= 2) score += 10;

    if (node.tags?.includes("fresh")) score += 10;
    if (node.tags?.includes("rss-seed")) score += 6;

    node.mineScore = Math.min(140, Math.round(score));
  };

  /* =========================
     Miner
  ========================= */
  App.minerFetchRelated = async function minerFetchRelated(targetNode, agent) {
    const base = targetNode.title || targetNode.label;
    if (targetNode.wikiBusy) return "busy";

    targetNode.wikiBusy = true;

    try {
      if ((targetNode.depth || 0) >= 2) {
        App.decayMineScoreAfterMining(targetNode, 0);
        return "exhausted";
      }

      const related = await App.wikiRelatedWords(base, 12);
      const webRelated = await App.webSuggestWords(base);
      const candidates = App.uniqueStrings([...related, ...webRelated]);

      if (!agent.mineState) {
        agent.mineState = {
          lockedNodeId: targetNode.id,
          triedWords: [],
          exhausted: false,
          depth: 0
        };
      }

      const tried = new Set(agent.mineState.triedWords || []);
      const fresh = candidates.filter(word => {
        if (tried.has(word)) return false;
        if (App.nodeExistsByLabel(word)) return false;
        return true;
      });

      if (fresh.length === 0) {
        agent.mineState.exhausted = true;
        App.decayMineScoreAfterMining(targetNode, 0);
        return "exhausted";
      }

      if (agent.mineState.depth >= 12) {
        App.decayMineScoreAfterMining(targetNode, 0);
        return "exhausted";
      }

      const branchLimit =
        (targetNode.depth || 0) >= 2 ? 6 :
        targetNode.hensachi >= 60 ? 5 :
        targetNode.hensachi >= 50 ? 4 : 3;

      let added = 0;

      for (const word of fresh) {
        const child = App.makeNode({
          x: targetNode.x + (Math.random() - 0.5) * 220,
          y: targetNode.y + 80 + Math.random() * 140,
          label: word,
          memo: "採掘者がWikipedia/Webから取得",
          r: 20,
          color: "#2b3344",
          textColor: "#eaf1ff"
        });

        child.title = word;
        child.rootNodeId = targetNode.rootNodeId || targetNode.id;
        child.depth = (targetNode.depth || 0) + 1;
        child.keywords = [base, word];
        child.tags = ["miner", "wiki", "fresh"];
        child.summary = `${base} の関連要素`;
        child.qualityScore = 4;
        child.attentionScore = 1;

        App.refreshMineScoreForNewNode(child, targetNode);

        App.nodes.push(child);
        App.links.push(App.makeLink(targetNode.id, child.id, "explore", 0.7, true));

        agent.mineState.triedWords.push(word);
        added++;
        if (added >= branchLimit) break;
      }

      agent.mineState.depth += added;
      targetNode.keywords = App.uniqueStrings([...(targetNode.keywords || []), ...fresh]);
      targetNode.tags = App.uniqueStrings([...(targetNode.tags || []), "mined"]);

      App.decayMineScoreAfterMining(targetNode, added);
      App.mergeDuplicateNodes();

      App.addLog(`採掘拡張: ${base} → ${added}本`);
      return added > 0 ? "expanded" : "exhausted";
    } finally {
      targetNode.wikiBusy = false;
    }
  };

  App.pickTargetForMiner = function pickTargetForMiner(candidatesOverride = null) {
    const candidates = (candidatesOverride || App.nodes).filter(n => {
      if (n.is5w2h || n.isAgentNode) return false;
      if (n.visible === false) return false;
      if (App.uiState.agentsIgnoreHiddenNodes && !App.visibleNodeSet.has(n.id)) return false;
      if (n.tags?.includes("mined-out")) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    const scored = candidates.map(node => ({
      node,
      score: App.getMinePriority(node)
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, Math.min(5, scored.length));

    return top[Math.floor(Math.random() * top.length)].node;
  };

  /* =========================
     Painter
  ========================= */
  App.canHaveImage = function canHaveImage(node) {
    const title = String(node?.title || node?.label || "");
    if (!node) return false;
    if (node.imageSrc) return false;
    if (node.is5w2h || node.isAgentNode) return false;
    if (node.visible === false) return false;
    if (title.length <= 1) return false;

    if (/成功|失敗|理由|方法|仕組み|情報|関連|候補|意味|概要|性能|価格|構造|種類/.test(title)) {
      return false;
    }

    if (/^[0-9０-９]+$/.test(title)) return false;

    return true;
  };

  App.painterFetchImage = async function painterFetchImage(targetNode) {
    if (!App.canHaveImage(targetNode) || targetNode.wikiBusy) return false;

    targetNode.wikiBusy = true;

    try {
      const base = targetNode.title || targetNode.label;
      let imageUrl = await App.wikiImageForTitle(base);

      if (!imageUrl) {
        const candidates = await App.wikiOpenSearch(base, 6);

        for (const title of candidates) {
          imageUrl = await App.wikiImageForTitle(title);
          if (imageUrl) {
            targetNode.title = title;
            targetNode.label = title;
            break;
          }
        }
      }

      if (!imageUrl) {
        targetNode.tags = App.uniqueStrings([...(targetNode.tags || []), "image-miss"]);
        return false;
      }

      targetNode.imageSrc = imageUrl;
      targetNode.shape = "rect";
      targetNode.tags = App.uniqueStrings([...(targetNode.tags || []), "image", "wiki-image"]);

      App.restoreImageNode(targetNode);

      if (targetNode.imageEl) {
        targetNode.imageEl.onload = () => {
          targetNode.imageLoaded = true;

          const iw = targetNode.imageEl.width || 4;
          const ih = targetNode.imageEl.height || 3;

          const baseH = 120;
          targetNode.height = baseH;
          targetNode.width = Math.max(80, Math.round(baseH * (iw / ih)));
          targetNode.imageAspect = iw / ih;
        };

        targetNode.imageEl.src = imageUrl;
      }

      return true;
    } finally {
      targetNode.wikiBusy = false;
    }
  };

  /* =========================
     Villager
  ========================= */
  App.villagerAssignWFromWeb = async function villagerAssignWFromWeb(targetNode) {
    const base = targetNode.title || targetNode.label;
    await App.refreshRssFeeds(false);

    const weights = await App.webSignalWeights(base);
    const ws = App.chooseTopW(weights, 2);

    targetNode.tags = App.uniqueStrings([...(targetNode.tags || []), ...ws, "web-weighted"]);

    const rssCount = App.rssState.keywordCounts.get(base) || 0;
    const webRelated = await App.webSuggestWords(base);
    const webCount = webRelated.length;

    const rawScore = rssCount * 2 + webCount;
    targetNode.attentionScore = rawScore;

    const scores = App.nodes
      .filter(n => !n.isAgentNode && !n.is5w2h)
      .map(n => Number(n.attentionScore || 0));

    scores.push(rawScore);

    const mean = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
    const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, scores.length);
    const std = Math.sqrt(variance) || 1;

    const hensachi = 50 + 10 * ((rawScore - mean) / std);
    targetNode.hensachi = Math.round(hensachi * 10) / 10;
    targetNode.tags = App.uniqueStrings([...(targetNode.tags || []), "village"]);

    if (!targetNode.summary) {
      targetNode.summary = `${base} に対するWeb/RSS由来の観点付与`;
    }
  };

  /* =========================
     Adventurer
  ========================= */
  App.adventurerAction = async function adventurerAction(node) {
    await App.refreshRssFeeds(false);

    const hot = App.getRssHotKeywords(20);
    let candidate = null;

    for (const item of hot) {
      if (!App.nodeExistsByLabel(item.word)) {
        candidate = item.word;
        break;
      }
    }

    if (!candidate) {
      const wildcards = ["未来","資源","戦争","市場","気候","衛星","電池","物流","教育","医療"];
      candidate = wildcards[Math.floor(Math.random() * wildcards.length)];
    }

    if (App.nodeExistsByLabel(candidate)) return null;

    const newNode = App.makeNode({
      x: node.x + (Math.random() - 0.5) * 220,
      y: node.y - 150,
      label: candidate,
      memo: "冒険者生成",
      r: 20,
      color: "#2b3344",
      textColor: "#eaf1ff",
      category: "normal"
    });

    newNode.title = candidate;
    newNode.rootNodeId = newNode.id;
    newNode.tags = ["wildcard", "rss-adventure"];
    newNode.summary = "冒険者がRSSまたはワイルドカードから発見";

    App.nodes.push(newNode);
    App.addLinkSmart(node, newNode);
    App.addLog(`冒険者追加: ${candidate}`);

    return newNode;
  };

  /* =========================
     Party / focus / target score
  ========================= */
  App.computeAgentTargetScore = function computeAgentTargetScore(agent, node) {
    let score = App.computeNodeDisplayWeight(node);

    if (agent.thinkingStyle === "supportUser") {
      score += node.userFocusScore || 0;
      if (node.isUserCreated) score += 40;
    }

    if (agent.thinkingStyle === "deepMine") {
      score += App.getMinePriority(node) * 1.2;
    }

    if (agent.thinkingStyle === "imageFirst") {
      if (!node.imageSrc) score += 30;
      if (node.youtubeVideoId) score -= 10;
    }

    if (agent.thinkingStyle === "cleanup") {
      if (node.tags?.includes("unverified")) score += 35;
    }

    if (agent.thinkingStyle === "balanced") {
      score += (node.userFocusScore || 0) * 0.5;
    }

    return score;
  };

  App.createExplorationPartyAroundNode = function createExplorationPartyAroundNode(centerNodeId) {
    const freeAgents = App.agents.filter(a => !a.partyId);
    const picked = [];
    const wantRoles = ["adventurer", "miner", "interdisciplinary", "painter"];

    for (const role of wantRoles) {
      const found = freeAgents.find(a => a.role === role && !picked.includes(a));
      if (found) picked.push(found);
    }

    if (!picked.length) return null;

    const party = App.makeParty({
      name: "開拓パーティ",
      memberIds: picked.map(a => a.id),
      centerNodeId,
      objective: "explore",
      radius: 2
    });

    App.parties.push(party);

    picked.forEach(agent => {
      agent.partyId = party.id;
      if (agent.role === "adventurer") agent.thinkingStyle = "supportUser";
      if (agent.role === "miner") agent.thinkingStyle = "deepMine";
      if (agent.role === "interdisciplinary") agent.thinkingStyle = "balanced";
      if (agent.role === "painter") agent.thinkingStyle = "imageFirst";
    });

    App.addLog(`パーティ結成: ${party.name}`);
    return party;
  };

  /* =========================
     Agent roster / target selection
  ========================= */
  App.sumAssignedWithoutUnassigned = function sumAssignedWithoutUnassigned() {
    return Object.entries(App.roleCounts)
      .filter(([k]) => k !== "unassigned")
      .reduce((sum, [, v]) => sum + (v || 0), 0);
  };

  App.rebalanceRoleCounts = function rebalanceRoleCounts() {
    const assigned = App.sumAssignedWithoutUnassigned();
    App.roleCounts.unassigned = Math.max(0, App.totalAgentCount - assigned);
  };

  App.expandRolesFromCounts = function expandRolesFromCounts() {
    const roles = [];
    App.ROLE_DEFS.forEach(r => {
      const count = Number(App.roleCounts[r.key] || 0);
      for (let i = 0; i < count; i++) roles.push(r.key);
    });
    return roles;
  };

  App.pickTargetForAgent = function pickTargetForAgent(agent) {
    if (agent.role === "miner" && agent.mineState?.lockedNodeId) {
      const locked = App.getNode(agent.mineState.lockedNodeId);
      if (locked && locked.visible !== false) return locked;
    }

    const party = agent.partyId
      ? App.parties.find(p => p.id === agent.partyId && p.active)
      : null;

    let candidates = [];

    if (party) {
      candidates = App.getPartyNodes(party).filter(n => !n.is5w2h && !n.isAgentNode);
    } else {
      candidates = App.nodes.filter(n => !n.is5w2h && !n.isAgentNode);
    }

    candidates = candidates.filter(n => n.visible !== false);

    if (App.uiState.agentsIgnoreHiddenNodes) {
      candidates = candidates.filter(n => App.visibleNodeSet.has(n.id));
    }

    if (candidates.length === 0) return null;

    if (agent.role === "miner") {
      return App.pickTargetForMiner(candidates);
    }

    const scored = candidates.map(node => ({
      node,
      score: App.computeAgentTargetScore(agent, node)
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, Math.min(6, scored.length));
    return top[Math.floor(Math.random() * top.length)].node;
  };

  App.syncAgentsFromRoleCounts = function syncAgentsFromRoleCounts() {
    App.rebalanceRoleCounts();
    const expandedRoles = App.expandRolesFromCounts();
    App.agentCount = expandedRoles.length;
    App.totalAgentCount = App.agentCount;

    const existingAgentNodes = App.nodes.filter(n => n.isAgentNode);

    if (existingAgentNodes.length < App.agentCount) {
      for (let i = existingAgentNodes.length; i < App.agentCount; i++) {
        const roleKey = expandedRoles[i];
        const node = App.makeNode({
          x: -520 + (i % 4) * 95,
          y: 220 + Math.floor(i / 4) * 80,
          label: `Agent${i + 1}\n${App.roleLabelJa(roleKey)}`,
          memo: `${App.roleLabelJa(roleKey)}エージェント`,
          r: 20,
          color: "#402843",
          textColor: "#ffd8fb",
          category: "agent",
          isAgentNode: true,
          visible: true
        });
        node.roleKey = roleKey;
        node.rootNodeId = node.id;
        App.nodes.push(node);
      }
    } else if (existingAgentNodes.length > App.agentCount) {
      const remove = existingAgentNodes.slice(App.agentCount);
      const removeSet = new Set(remove.map(n => n.id));
      App.nodes = App.nodes.filter(n => !removeSet.has(n.id));
      App.links = App.links.filter(l => !removeSet.has(l.source) && !removeSet.has(l.target));
      App.agents = App.agents.filter(a => !removeSet.has(a.id));
      if (App.followAgentId && removeSet.has(App.followAgentId)) App.followAgentId = null;
      if (App.pendingAgentTargetId && removeSet.has(App.pendingAgentTargetId)) App.pendingAgentTargetId = null;
    }

    const agentNodes = App.nodes.filter(n => n.isAgentNode);
    const prevAgents = [...App.agents];

    App.agents = agentNodes.map((n, i) => {
      const prev = prevAgents.find(a => a.id === n.id);
      const roleKey = expandedRoles[i];

      n.label = `Agent${i + 1}\n${App.roleLabelJa(roleKey)}`;
      n.title = n.label;
      n.memo = `${App.roleLabelJa(roleKey)}エージェント`;
      n.roleKey = roleKey;

      return {
        id: n.id,
        role: roleKey,
        tickOffset: prev?.tickOffset ?? i * 41,
        targetNodeId: prev?.targetNodeId || null,
        mode: prev?.mode || "wander",
        taskText: prev?.taskText || "待機",
        workUntilFrame: prev?.workUntilFrame || 0,
        busy: prev?.busy || false,
        mineState: prev?.mineState || null,
        partyId: prev?.partyId || null,
        thinkingStyle: prev?.thinkingStyle || "balanced"
      };
    });

    App.agents.forEach(agent => {
      if (!agent.targetNodeId) {
        const picked = App.pickTargetForAgent(agent);
        if (picked) agent.targetNodeId = picked.id;
      }
    });

    if (!App.followAgentId && App.agents[0]) {
      App.followAgentId = App.agents[0].id;
    }
  };

  /* =========================
     Per-role actions
  ========================= */
  App.roleAction = async function roleAction(agent, targetNode) {
    const base = targetNode.title || targetNode.label;

    if (agent.role === "unassigned") {
      agent.taskText = "未配属";
      return;
    }

    if (agent.role === "adventurer") {
      await App.adventurerAction(targetNode);
      agent.taskText = `${base} から冒険`;
      return;
    }

    if (agent.role === "miner") {
      if (!agent.mineState) {
        agent.mineState = {
          lockedNodeId: null,
          triedWords: [],
          exhausted: false,
          depth: 0
        };
      }

      if (!agent.mineState.lockedNodeId) {
        agent.mineState.lockedNodeId = targetNode.id;
        agent.mineState.triedWords = [];
        agent.mineState.exhausted = false;
        agent.mineState.depth = 0;
        App.addLog(`採掘固定開始: ${base}`);
      }

      const result = await App.minerFetchRelated(targetNode, agent);

      if (result === "exhausted") {
        App.addLog(`採掘完了: ${base}`);
        agent.mineState.lockedNodeId = null;
        agent.mineState.triedWords = [];
        agent.mineState.exhausted = true;
        agent.mineState.depth = 0;
        agent.targetNodeId = null;
        agent.taskText = `${base} を掘り尽くした`;
      } else {
        agent.taskText = `${base} を採掘中`;
      }
      return;
    }

    if (agent.role === "interdisciplinary") {
      const wNodes = App.nodes.filter(n => n.is5w2h && n.visible !== false);

      if (wNodes.length) {
        const scoredW = wNodes.map(w => ({
          node: w,
          score:
            (targetNode.tags || []).includes(w.label) ? 8 :
            (targetNode.keywords || []).includes(w.label) ? 6 : 0
        })).sort((a, b) => b.score - a.score);

        const pickedW = scoredW[0]?.node || wNodes[Math.floor(Math.random() * wNodes.length)];
        App.addLinkSmart(targetNode, pickedW);
      }

      const others = App.nodes.filter(n =>
        !n.is5w2h &&
        !n.isAgentNode &&
        n.visible !== false &&
        n.id !== targetNode.id &&
        !App.linkExists(targetNode.id, n.id)
      );

      const scored = others
        .map(n => ({ node: n, score: App.calcNodeAffinity(targetNode, n) }))
        .filter(x => x.score >= 4)
        .sort((a, b) => b.score - a.score);

      if (scored.length) {
        const other = scored[Math.floor(Math.random() * Math.min(3, scored.length))].node;
        App.links.push(App.makeLink(targetNode.id, other.id, "related", 1, true));
        App.addLog(`学際接続: ${targetNode.title || targetNode.label} ↔ ${other.title || other.label}`);
      } else {
        App.addLog(`学際見送り: ${targetNode.title || targetNode.label}`);
      }

      agent.taskText = `${base} を学際化`;
      return;
    }

    if (agent.role === "editor") {
      await App.editorReviewNode(targetNode);
      agent.taskText = `${base} を検証`;
      return;
    }

    if (agent.role === "painter") {
      const ok = await App.painterFetchImage(targetNode);
      agent.taskText = ok ? `${base} に画像` : `${base} 画像失敗`;
      App.addLog(ok ? `画家取得: ${base}` : `画家失敗: ${base}`);
      return;
    }

    if (agent.role === "villager") {
      await App.villagerAssignWFromWeb(targetNode);
      agent.taskText = `${base} にW/偏差値`;
      App.addLog(`村人付与: ${base}`);
      return;
    }
  };

  /* =========================
     Agent movement / thinking
  ========================= */
  App.moveAgents = function moveAgents() {
    App.agents.forEach(agent => {
      const agentNode = App.getNode(agent.id);
      if (!agentNode) return;

      let targetNode = agent.targetNodeId ? App.getNode(agent.targetNodeId) : null;

      if (targetNode && targetNode.visible === false) {
        agent.targetNodeId = null;
        targetNode = null;
      }

      if (
        targetNode &&
        App.uiState.agentsIgnoreHiddenNodes &&
        !targetNode.isAgentNode &&
        !App.visibleNodeSet.has(targetNode.id)
      ) {
        agent.targetNodeId = null;
        targetNode = null;
      }

      if (!targetNode) {
        const picked = App.pickTargetForAgent(agent);
        agent.targetNodeId = picked ? picked.id : null;
        targetNode = picked || null;
      }

      if (!targetNode) {
        agent.mode = "wander";
        agent.taskText = "待機";
        return;
      }

      const dx = targetNode.x - agentNode.x;
      const dy = targetNode.y - agentNode.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 36) {
        agent.mode = "work";
        if (App.frame > (agent.workUntilFrame || 0)) {
          agent.workUntilFrame = App.frame + 150;
        }
        return;
      }

      agent.mode = "move";
      agent.taskText = `${targetNode.title || targetNode.label} へ移動`;
      const speed = 1.5;
      agentNode.x += (dx / Math.max(1, dist)) * speed;
      agentNode.y += (dy / Math.max(1, dist)) * speed;
    });
  };

  App.updateAgentThinking = function updateAgentThinking(frame) {
    if (!App.running) return;

    App.agents.forEach(agent => {
      const agentNode = App.getNode(agent.id);
      let targetNode = agent.targetNodeId ? App.getNode(agent.targetNodeId) : null;
      if (!agentNode || agent.busy || agent.role === "unassigned") return;

      if (targetNode && targetNode.visible === false) {
        targetNode = null;
        agent.targetNodeId = null;
      }

      if (targetNode && App.uiState.agentsIgnoreHiddenNodes && !App.visibleNodeSet.has(targetNode.id)) {
        targetNode = null;
        agent.targetNodeId = null;
      }

      if (!targetNode) {
        const next = App.pickTargetForAgent(agent);
        agent.targetNodeId = next ? next.id : null;
        targetNode = next || null;
        if (!targetNode) return;
      }

      if (!App.linkExists(agentNode.id, targetNode.id)) {
        App.links.push(App.makeLink(agentNode.id, targetNode.id, "agent-think", 0.5, true));
      }

      const dist = Math.hypot(targetNode.x - agentNode.x, targetNode.y - agentNode.y);

      if (dist < 36 && frame >= (agent.workUntilFrame || 0)) {
        agent.busy = true;
        Promise.resolve(App.roleAction(agent, targetNode))
          .catch(err => {
            console.error(err);
            App.addLog(`役割処理エラー: ${agent.role}`);
          })
          .finally(() => {
            agent.busy = false;
            if (agent.targetNodeId === targetNode.id) {
              const next = App.pickTargetForAgent(agent);
              agent.targetNodeId = next ? next.id : null;
            }
            agent.workUntilFrame = frame + 150;
            App.scheduleAutoSave();
            App.updateInfo();
          });
      }
    });
  };
})();