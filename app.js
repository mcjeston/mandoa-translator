(function () {
  const baseDictionary = Array.isArray(window.MANDOA_DICTIONARY) ? window.MANDOA_DICTIONARY : [];

  const entryCountEl = document.getElementById("entryCount");
  const directionEl = document.getElementById("direction");
  const sourceTextEl = document.getElementById("sourceText");
  const translateBtn = document.getElementById("translateBtn");
  const clearBtn = document.getElementById("clearBtn");
  const translationResultEl = document.getElementById("translationResult");
  const matchListEl = document.getElementById("matchList");
  const searchInputEl = document.getElementById("searchInput");
  const resultsEl = document.getElementById("results");
  const resultsCountEl = document.getElementById("resultsCount");
  const themeToggleEl = document.getElementById("themeToggle");

  const mandoaIndex = new Map();
  const englishIndex = new Map();

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[“”"`]/g, "")
      .replace(/[()\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeWord(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z']/g, "")
      .trim();
  }

  function normalizeSimpleWord(value) {
    const simple = normalize(value);
    return /^[a-z]+$/.test(simple) ? simple : "";
  }

  function splitAlternatives(value) {
    return String(value || "")
      .split(/[,;/]/)
      .map((part) => normalize(part))
      .filter(Boolean);
  }

  function englishAlternatives(value) {
    const raw = String(value || "");
    const trimmed = normalize(raw);
    if (!trimmed) {
      return [];
    }

    const withoutParens = normalize(raw.replace(/\([^)]*\)/g, " "));
    const bits = raw
      .split(/[,;/]|\s-\s|\bor\b/gi)
      .map((part) => normalize(part))
      .filter(Boolean);

    return Array.from(new Set([trimmed, withoutParens, ...bits].filter(Boolean)));
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pluralize(word) {
    const irregular = {
      man: "men",
      woman: "women",
      child: "children",
      person: "people",
      tooth: "teeth",
      foot: "feet",
      mouse: "mice",
      goose: "geese",
    };

    if (irregular[word]) {
      return irregular[word];
    }
    if (/[^aeiou]y$/.test(word)) {
      return `${word.slice(0, -1)}ies`;
    }
    if (/(s|x|z|ch|sh)$/.test(word)) {
      return `${word}es`;
    }
    if (/fe$/.test(word)) {
      return `${word.slice(0, -2)}ves`;
    }
    if (/f$/.test(word)) {
      return `${word.slice(0, -1)}ves`;
    }

    return `${word}s`;
  }

  function isLikelyNounWord(word) {
    if (!/^[a-z]+$/.test(word) || word.length < 2) {
      return false;
    }

    const blocked = new Set([
      "and",
      "or",
      "but",
      "if",
      "with",
      "without",
      "between",
      "before",
      "after",
      "during",
      "toward",
      "towards",
      "this",
      "that",
      "these",
      "those",
      "the",
      "a",
      "an",
      "be",
      "is",
      "are",
      "was",
      "were",
      "am",
      "do",
      "does",
      "did",
      "done",
      "have",
      "has",
      "had",
      "up",
      "down",
      "in",
      "out",
      "on",
      "off",
      "there",
      "here",
      "today",
      "tomorrow",
      "yesterday",
      "now",
      "then",
      "feel",
      "rest",
      "numb",
      "either",
      "extra",
      "high",
      "where",
      "detect",
    ]);

    if (blocked.has(word)) {
      return false;
    }

    if (/(less|ous|ful|ive|ed|ing|ly|able|ible|ic)$/.test(word)) {
      return false;
    }

    return true;
  }

  function learnPluralRules(entries) {
    const englishWordIndex = new Map();

    entries.forEach((entry) => {
      englishAlternatives(entry.english).forEach((alt) => {
        const w = normalizeSimpleWord(alt);
        if (!w) {
          return;
        }

        if (!englishWordIndex.has(w)) {
          englishWordIndex.set(w, []);
        }
        englishWordIndex.get(w).push(entry);
      });
    });

    const suffixStats = {
      ii: new Map(),
      default: new Map(),
    };

    function countSuffix(group, suffix) {
      if (!suffix) {
        return;
      }
      const current = suffixStats[group].get(suffix) || 0;
      suffixStats[group].set(suffix, current + 1);
    }

    englishWordIndex.forEach((singularEntries, singularWord) => {
      const pluralWord = pluralize(singularWord);
      const pluralEntries = englishWordIndex.get(pluralWord);
      if (!pluralEntries) {
        return;
      }

      singularEntries.forEach((singEntry) => {
        const singMandoa = normalizeWord(splitAlternatives(singEntry.mandoa)[0]);
        if (!singMandoa) {
          return;
        }

        pluralEntries.forEach((pluralEntry) => {
          const plMandoa = normalizeWord(splitAlternatives(pluralEntry.mandoa)[0]);
          if (!plMandoa || plMandoa === singMandoa || !plMandoa.startsWith(singMandoa)) {
            return;
          }

          const suffix = plMandoa.slice(singMandoa.length);
          const group = singMandoa.endsWith("ii") ? "ii" : "default";
          countSuffix(group, suffix);
        });
      });
    });

    function pickBest(map, fallback) {
      let best = fallback;
      let max = -1;
      map.forEach((count, suffix) => {
        if (count > max) {
          best = suffix;
          max = count;
        }
      });
      return best;
    }

    return {
      ii: pickBest(suffixStats.ii, "se"),
      default: pickBest(suffixStats.default, "e"),
    };
  }

  function buildInferredPluralEntries(entries) {
    const rules = learnPluralRules(entries);
    const existingEnglish = new Set();
    const existingMandoa = new Set();

    entries.forEach((entry) => {
      englishAlternatives(entry.english).forEach((alt) => {
        const w = normalizeSimpleWord(alt);
        if (w) {
          existingEnglish.add(w);
        }
      });
      splitAlternatives(entry.mandoa).forEach((alt) => existingMandoa.add(normalizeWord(alt)));
    });

    const generated = [];
    const generatedKey = new Set();

    entries.forEach((entry) => {
      const mandoaBase = normalizeWord(splitAlternatives(entry.mandoa)[0]);
      if (!mandoaBase) {
        return;
      }

      const singular = normalizeSimpleWord(entry.english);
      if (!isLikelyNounWord(singular)) {
        return;
      }

      const plural = pluralize(singular);
      if (plural === singular || existingEnglish.has(plural)) {
        return;
      }

      const suffix = mandoaBase.endsWith("ii") ? rules.ii : rules.default;
      const mandoaPlural = `${mandoaBase}${suffix}`;
      if (existingMandoa.has(mandoaPlural)) {
        return;
      }

      const key = `${mandoaPlural}|${plural}`;
      if (generatedKey.has(key)) {
        return;
      }

      generatedKey.add(key);
      existingEnglish.add(plural);
      existingMandoa.add(mandoaPlural);

      generated.push({
        mandoa: mandoaPlural,
        pronunciation: entry.pronunciation || "",
        english: plural,
        inferred: true,
      });
    });

    return generated;
  }

  const inferredPluralEntries = buildInferredPluralEntries(baseDictionary);
  const dictionary = [...baseDictionary, ...inferredPluralEntries];

  function addToIndex(index, key, entry) {
    if (!key) {
      return;
    }
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(entry);
  }

  function buildIndexes() {
    dictionary.forEach((entry) => {
      splitAlternatives(entry.mandoa).forEach((alt) => addToIndex(mandoaIndex, alt, entry));
      englishAlternatives(entry.english).forEach((alt) => addToIndex(englishIndex, alt, entry));
    });
  }

  function findBestEntry(word, direction) {
    const key = normalize(word);
    if (!key) {
      return null;
    }

    const index = direction === "mandoaToEnglish" ? mandoaIndex : englishIndex;
    const matches = index.get(key);
    if (matches && matches.length > 0) {
      return matches[0];
    }

    return null;
  }

  function tokenTranslate(text, direction) {
    const tokens = String(text || "").match(/[A-Za-z']+|[^A-Za-z']+/g) || [];
    const matched = [];

    const translated = tokens
      .map((token) => {
        if (!/^[A-Za-z']+$/.test(token)) {
          return token;
        }

        const entry = findBestEntry(token, direction);
        if (!entry) {
          return token;
        }

        matched.push(entry);
        return direction === "mandoaToEnglish" ? entry.english : entry.mandoa;
      })
      .join("");

    return {
      text: translated,
      matched,
    };
  }

  function entryCard(entry) {
    return `
      <article class="entry">
        <h3>${escapeHtml(entry.mandoa || "")}</h3>
        <p class="pron">${escapeHtml(entry.pronunciation || "")}</p>
        <p>${escapeHtml(entry.english || "")}</p>
        ${entry.inferred ? '<span class="tag">Inferred plural</span>' : ""}
      </article>
    `;
  }

  function renderMatched(entries) {
    const unique = [];
    const seen = new Set();

    entries.forEach((entry) => {
      const id = `${entry.mandoa}|${entry.english}|${entry.pronunciation}`;
      if (!seen.has(id)) {
        seen.add(id);
        unique.push(entry);
      }
    });

    if (unique.length === 0) {
      matchListEl.innerHTML = "<p class='hint'>No dictionary entries were matched.</p>";
      return;
    }

    matchListEl.innerHTML = unique.map(entryCard).join("");
  }

  function translateInput() {
    const direction = directionEl.value;
    const source = sourceTextEl.value.trim();

    if (!source) {
      translationResultEl.textContent = "Enter text to translate.";
      matchListEl.innerHTML = "";
      return;
    }

    const wholeMatch = findBestEntry(source, direction);
    if (wholeMatch) {
      translationResultEl.textContent = direction === "mandoaToEnglish" ? wholeMatch.english : wholeMatch.mandoa;
      renderMatched([wholeMatch]);
      return;
    }

    const byToken = tokenTranslate(source, direction);
    translationResultEl.textContent = byToken.text;
    renderMatched(byToken.matched);
  }

  function renderDictionary(items) {
    resultsCountEl.textContent = `${items.length} result${items.length === 1 ? "" : "s"}`;

    if (items.length === 0) {
      resultsEl.innerHTML = "<p class='hint'>No matches.</p>";
      return;
    }

    resultsEl.innerHTML = items
      .slice(0, 300)
      .map((entry) => entryCard(entry))
      .join("");

    if (items.length > 300) {
      resultsCountEl.textContent += " (showing first 300)";
    }
  }

  function runSearch() {
    const q = normalize(searchInputEl.value);
    if (!q) {
      renderDictionary(dictionary);
      return;
    }

    const filtered = dictionary.filter((entry) => {
      return (
        normalize(entry.mandoa).includes(q) ||
        normalize(entry.english).includes(q) ||
        normalize(entry.pronunciation).includes(q)
      );
    });

    filtered.sort((a, b) => {
      const aExact = normalize(a.mandoa) === q || normalize(a.english) === q;
      const bExact = normalize(b.mandoa) === q || normalize(b.english) === q;
      if (aExact && !bExact) {
        return -1;
      }
      if (!aExact && bExact) {
        return 1;
      }
      return normalize(a.mandoa).localeCompare(normalize(b.mandoa));
    });

    renderDictionary(filtered);
  }

  function applyTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", selected);
    themeToggleEl.checked = selected === "dark";
    localStorage.setItem("mandoa-theme", selected);
  }

  function initTheme() {
    const saved = localStorage.getItem("mandoa-theme");
    const preferredDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (preferredDark ? "dark" : "light"));

    themeToggleEl.addEventListener("change", () => {
      applyTheme(themeToggleEl.checked ? "dark" : "light");
    });
  }

  function init() {
    buildIndexes();
    entryCountEl.textContent = String(dictionary.length);
    renderDictionary(dictionary);
    initTheme();

    translateBtn.addEventListener("click", translateInput);
    clearBtn.addEventListener("click", () => {
      sourceTextEl.value = "";
      translationResultEl.textContent = "";
      matchListEl.innerHTML = "";
    });

    sourceTextEl.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        translateInput();
      }
    });

    searchInputEl.addEventListener("input", runSearch);

    resultsEl.addEventListener("click", (event) => {
      const card = event.target.closest(".entry");
      if (!card) {
        return;
      }

      const mandoa = card.querySelector("h3")?.textContent || "";
      if (!mandoa) {
        return;
      }

      directionEl.value = "mandoaToEnglish";
      sourceTextEl.value = mandoa;
      translateInput();
      sourceTextEl.focus();
    });
  }

  init();
})();
