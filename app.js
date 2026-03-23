(function () {
  const baseDictionary = Array.isArray(window.MANDOA_DICTIONARY) ? window.MANDOA_DICTIONARY : [];

  const entryCountEl = document.getElementById("entryCount");
  const directionEl = document.getElementById("direction");
  const sourceTextEl = document.getElementById("sourceText");
  const translateBtn = document.getElementById("translateBtn");
  const clearBtn = document.getElementById("clearBtn");
  const copyBtn = document.getElementById("copyBtn");
  const translationResultEl = document.getElementById("translationResult");
  const translationSuggestionsEl = document.getElementById("translationSuggestions");
  const matchListEl = document.getElementById("matchList");
  const searchInputEl = document.getElementById("searchInput");
  const resultsEl = document.getElementById("results");
  const resultsCountEl = document.getElementById("resultsCount");
  const themeToggleEl = document.getElementById("themeToggle");

  const mandoaIndex = new Map();
  const englishIndex = new Map();
  const grammarRules = window.MANDOA_GRAMMAR_RULES || {
    verbEndings: ["ir", "ar", "ur", "or", "er"],
    prefixes: {
      question: ["tion"],
      command: ["ke", "k'"],
      negative: ["n'", "nu", "nu'", "ne"],
      past: ["ru"],
      future: ["ven"],
    },
    suffixes: {
      plural: ["e"],
      adjectiveOrAdverb: ["la", "yc"],
      comparative: ["shy'a"],
      superlative: ["ne"],
    },
    notes: [],
  };

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

  function singularize(word) {
    const irregular = {
      children: "child",
      people: "person",
      men: "man",
      women: "woman",
      teeth: "tooth",
      feet: "foot",
      mice: "mouse",
      geese: "goose",
    };

    if (irregular[word]) {
      return irregular[word];
    }
    if (/[^aeiou]ies$/.test(word) && word.length > 3) {
      return `${word.slice(0, -3)}y`;
    }
    if (/(ches|shes|sses|xes|zes|oes)$/.test(word) && word.length > 3) {
      return word.slice(0, -2);
    }
    if (/ves$/.test(word) && word.length > 3) {
      return `${word.slice(0, -3)}f`;
    }
    if (/s$/.test(word) && !/ss$/.test(word) && word.length > 2) {
      return word.slice(0, -1);
    }

    return word;
  }

  function englishLookupCandidates(word) {
    const key = normalizeSimpleWord(word);
    if (!key) {
      return [];
    }

    const candidates = new Set();
    const irregularVerbs = {
      has: "have",
      does: "do",
      is: "be",
      was: "be",
      were: "be",
      am: "be",
      are: "be",
      went: "go",
      gone: "go",
      came: "come",
      did: "do",
      done: "do",
      had: "have",
      made: "make",
      took: "take",
      felt: "feel",
      left: "leave",
      knew: "know",
      thought: "think",
      fought: "fight",
      spoke: "speak",
      wrote: "write",
      drove: "drive",
      found: "find",
      held: "hold",
      told: "tell",
    };

    if (irregularVerbs[key]) {
      candidates.add(irregularVerbs[key]);
    }

    const singular = singularize(key);
    if (singular !== key) {
      candidates.add(singular);
    }

    if (/ied$/.test(key) && key.length > 3) {
      candidates.add(`${key.slice(0, -3)}y`);
    }

    if (/ed$/.test(key) && key.length > 3) {
      const withoutEd = key.slice(0, -2);
      candidates.add(withoutEd);
      candidates.add(`${withoutEd}e`);
      if (/(bb|dd|ff|gg|ll|mm|nn|pp|rr|tt)$/.test(withoutEd)) {
        candidates.add(withoutEd.slice(0, -1));
      }
    }

    if (/ing$/.test(key) && key.length > 4) {
      const withoutIng = key.slice(0, -3);
      candidates.add(withoutIng);
      candidates.add(`${withoutIng}e`);
      if (/(bb|dd|ff|gg|ll|mm|nn|pp|rr|tt)$/.test(withoutIng)) {
        candidates.add(withoutIng.slice(0, -1));
      }
    }

    if (/(ches|shes|sses|xes|zes|oes)$/.test(key) && key.length > 3) {
      candidates.add(key.slice(0, -2));
    } else if (/s$/.test(key) && !/ss$/.test(key) && key.length > 2) {
      candidates.add(key.slice(0, -1));
    }

    candidates.delete(key);
    return Array.from(candidates);
  }

  function expandVerbCandidate(word) {
    if (!word || /r$/.test(word)) {
      return word;
    }
    if (/[aeiou]$/.test(word)) {
      return `${word}r`;
    }
    return word;
  }

  function stripKnownPrefix(word, prefixes) {
    for (const prefix of prefixes) {
      if (word.startsWith(prefix) && word.length > prefix.length) {
        return word.slice(prefix.length);
      }
    }
    return word;
  }

  function mandoaLookupCandidates(word) {
    const key = normalizeWord(word);
    if (!key) {
      return [];
    }

    const candidates = new Set();
    const queue = [key];
    const visited = new Set();
    const prefixGroups = [
      grammarRules.prefixes?.question || [],
      grammarRules.prefixes?.command || [],
      grammarRules.prefixes?.negative || [],
      grammarRules.prefixes?.past || [],
      grammarRules.prefixes?.future || [],
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);

      candidates.add(current);

      prefixGroups.forEach((group) => {
        const stripped = stripKnownPrefix(current, group);
        if (stripped !== current) {
          queue.push(stripped);
        }
      });

      if (current.endsWith("e") && current.length > 2) {
        queue.push(current.slice(0, -1));
      }
      if (current.endsWith("la") && current.length > 3) {
        queue.push(current.slice(0, -2));
      }
      if (current.endsWith("yc") && current.length > 3) {
        queue.push(current.slice(0, -2));
      }
      if (current.endsWith("shy'a") && current.length > 6) {
        queue.push(current.slice(0, -5));
      }
      if (current.endsWith("ne") && current.length > 3) {
        queue.push(current.slice(0, -2));
      }
    }

    Array.from(candidates).forEach((candidate) => {
      candidates.add(expandVerbCandidate(candidate));
    });

    candidates.delete(key);
    return Array.from(candidates).filter(Boolean);
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

    if (direction === "englishToMandoa") {
      for (const candidate of englishLookupCandidates(key)) {
        const fallback = englishIndex.get(candidate);
        if (fallback && fallback.length > 0) {
          return fallback[0];
        }
      }
    } else {
      for (const candidate of mandoaLookupCandidates(key)) {
        const fallback = mandoaIndex.get(candidate);
        if (fallback && fallback.length > 0) {
          return fallback[0];
        }
      }
    }

    return null;
  }

  function tokenTranslate(text, direction) {
    if (direction === "mandoaToEnglish") {
      return translateMandoaToEnglishColloquial(text);
    }

    const tokens = String(text || "").match(/[A-Za-z']+|[^A-Za-z']+/g) || [];
    const matched = [];
    const grammarActions = new Set();
    const translatedParts = [];

    for (const token of tokens) {
      if (!/^[A-Za-z']+$/.test(token)) {
        translatedParts.push(token);
        continue;
      }

      if (direction === "englishToMandoa") {
        const plain = normalizeWord(token).replace(/'/g, "");

        if (["am", "is", "are", "was", "were", "be", "been", "being"].includes(plain)) {
          grammarActions.add("Dropped English copula (be/am/is/are) to fit common Mando'a phrasing.");
          continue;
        }

        if (plain === "will") {
          grammarActions.add("Converted future auxiliary 'will' to Mando'a future prefix form ('ven').");
          translatedParts.push("ven");
          continue;
        }

        if (["not", "no", "never", "dont", "cant", "wont", "isnt", "arent", "wasnt", "werent", "didnt"].includes(plain)) {
          grammarActions.add("Converted English negation to Mando'a negative marker ('nu'').");
          translatedParts.push("nu'");
          continue;
        }
      }

      const entry = findBestEntry(token, direction);
      if (!entry) {
        translatedParts.push(token);
        continue;
      }

      matched.push(entry);
      translatedParts.push(direction === "mandoaToEnglish" ? entry.english : entry.mandoa);
    }

    let translated = translatedParts.join("");
    if (direction === "englishToMandoa") {
      translated = translated
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;!?])/g, "$1")
        .trim();
    }

    return {
      text: translated,
      matched,
      grammarActions: Array.from(grammarActions),
    };
  }

  function detectEnglishGrammarActions(source) {
    const text = normalize(source);
    if (!text) {
      return [];
    }

    const actions = new Set();
    if (/\bwill\b/.test(text)) {
      actions.add("Converted future auxiliary 'will' to Mando'a future prefix form ('ven').");
    }
    if (/\b(am|is|are|was|were|be|been|being)\b/.test(text)) {
      actions.add("Dropped English copula (be/am/is/are) to fit common Mando'a phrasing.");
    }
    if (/\b(not|no|never|dont|don't|cant|can't|wont|won't|isnt|isn't|arent|aren't|wasnt|wasn't|werent|weren't|didnt|didn't)\b/.test(text)) {
      actions.add("Converted English negation to Mando'a negative marker ('nu'').");
    }
    if (/\?$/.test(source.trim())) {
      actions.add("Question phrasing detected; Mando'a may use the 'tion' prefix.");
    }

    return Array.from(actions);
  }

  function cleanEnglishGloss(value) {
    let text = String(value || "");
    text = text.replace(/\([^)]*\)/g, " ");
    text = text.replace(/\s-\s.*$/g, " ");
    text = text.replace(/\blit\..*$/i, " ");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function chooseColloquialEnglish(entry, originalWord) {
    const word = normalizeWord(originalWord);
    const pronounMap = {
      ni: "I",
      gar: "you",
      kaysh: "they",
      mhi: "we",
      ibic: "this",
      "ibi'tuur": "today",
    };
    if (pronounMap[word]) {
      return pronounMap[word];
    }

    const cleaned = cleanEnglishGloss(entry?.english || "");
    if (!cleaned) {
      return originalWord;
    }

    const first = cleaned
      .split(/[,;/]/)
      .map((part) => part.trim())
      .find(Boolean) || cleaned;

    return first.replace(/^to\s+/i, "").trim();
  }

  function conjugatePast(verb) {
    const w = normalizeSimpleWord(verb);
    const irregular = {
      be: "was",
      do: "did",
      have: "had",
      go: "went",
      come: "came",
      make: "made",
      take: "took",
      fight: "fought",
      know: "knew",
      think: "thought",
      speak: "spoke",
      write: "wrote",
      drive: "drove",
      find: "found",
      hold: "held",
      tell: "told",
      leave: "left",
      feel: "felt",
      defeat: "defeated",
      destroy: "destroyed",
    };
    if (irregular[w]) {
      return irregular[w];
    }
    if (/e$/.test(w)) {
      return `${w}d`;
    }
    if (/[^aeiou]y$/.test(w)) {
      return `${w.slice(0, -1)}ied`;
    }
    return `${w}ed`;
  }

  function translateMandoaToEnglishColloquial(text) {
    const tokens = String(text || "").match(/[A-Za-z']+|[^A-Za-z']+/g) || [];
    const matched = [];
    const grammarActions = new Set();
    const out = [];
    let futurePending = false;
    let pastPending = false;

    function nextWord(from) {
      for (let i = from; i < tokens.length; i += 1) {
        if (/^[A-Za-z']+$/.test(tokens[i])) {
          return { word: tokens[i], index: i };
        }
      }
      return null;
    }

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (!/^[A-Za-z']+$/.test(token)) {
        out.push(token);
        continue;
      }

      const word = normalizeWord(token);
      const next = nextWord(i + 1);
      const phrase = next ? `${token} ${next.word}` : "";
      const phraseEntry = phrase ? findBestEntry(phrase, "mandoaToEnglish") : null;
      if (phraseEntry) {
        matched.push(phraseEntry);
        out.push(chooseColloquialEnglish(phraseEntry, phrase));
        i = next.index;
        continue;
      }

      if (word === "ven") {
        futurePending = true;
        grammarActions.add("Interpreted 'ven' as future tense ('will').");
        continue;
      }
      if (word === "ru") {
        pastPending = true;
        grammarActions.add("Interpreted 'ru' as past tense.");
        continue;
      }
      if (word === "nu'" || word === "nu" || word === "n'" || word === "ne") {
        out.push("not");
        grammarActions.add("Interpreted negative marker as 'not'.");
        continue;
      }

      const entry = findBestEntry(token, "mandoaToEnglish");
      if (!entry) {
        out.push(token);
        continue;
      }

      matched.push(entry);
      let english = chooseColloquialEnglish(entry, token);
      const isVerb = /^to\s+/i.test(cleanEnglishGloss(entry.english || "")) ||
        /\b(verb|defeat|destroy|attack|fight|carry|move|act|leave|need|want)\b/i.test(cleanEnglishGloss(entry.english || ""));

      if (isVerb && futurePending) {
        english = `will ${english}`;
        futurePending = false;
      } else if (isVerb && pastPending) {
        english = conjugatePast(english);
        pastPending = false;
      }

      out.push(english);
    }

    const translated = out
      .join("")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;!?])/g, "$1")
      .trim();

    return {
      text: translated,
      matched,
      grammarActions: Array.from(grammarActions),
    };
  }

  function renderTranslationSuggestions(direction, source, grammarActions) {
    if (!translationSuggestionsEl) {
      return;
    }

    if (direction !== "englishToMandoa") {
      translationSuggestionsEl.textContent = "";
      return;
    }

    if (!String(source || "").trim()) {
      translationSuggestionsEl.textContent = "";
      return;
    }

    if (!grammarActions || grammarActions.length === 0) {
      translationSuggestionsEl.textContent = "";
      return;
    }

    translationSuggestionsEl.innerHTML = grammarActions
      .slice(0, 2)
      .map((s) => `Applied grammar: ${escapeHtml(s)}`)
      .join("<br>");
  }

  async function copyResultToClipboard() {
    const text = String(translationResultEl?.textContent || "").trim();
    if (!text) {
      return false;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      // Fallback below.
    }

    try {
      const temp = document.createElement("textarea");
      temp.value = text;
      temp.setAttribute("readonly", "");
      temp.style.position = "absolute";
      temp.style.left = "-9999px";
      document.body.appendChild(temp);
      temp.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(temp);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function entryCard(entry) {
    const sourceTag = entry.source ? `<span class="tag">Source: ${escapeHtml(entry.source)}</span>` : "";
    const inferredTag = entry.inferred ? '<span class="tag">Inferred plural</span>' : "";

    return `
      <article class="entry">
        <h3>${escapeHtml(entry.mandoa || "")}</h3>
        <p class="pron">${escapeHtml(entry.pronunciation || "")}</p>
        <p>${escapeHtml(entry.english || "")}</p>
        ${inferredTag}
        ${sourceTag}
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
    const sourceActions = direction === "englishToMandoa" ? detectEnglishGrammarActions(source) : [];

    if (!source) {
      translationResultEl.textContent = "Enter text to translate.";
      renderTranslationSuggestions(direction, "", []);
      matchListEl.innerHTML = "";
      return;
    }

    const wholeMatch = findBestEntry(source, direction);
    if (wholeMatch) {
      translationResultEl.textContent = direction === "mandoaToEnglish" ? wholeMatch.english : wholeMatch.mandoa;
      renderTranslationSuggestions(direction, source, sourceActions);
      renderMatched([wholeMatch]);
      return;
    }

    const byToken = tokenTranslate(source, direction);
    translationResultEl.textContent = byToken.text;
    const combinedActions = Array.from(new Set([...(sourceActions || []), ...((byToken.grammarActions || []))]));
    renderTranslationSuggestions(direction, source, combinedActions);
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

    const variants = new Set([q]);
    const simple = normalizeSimpleWord(q);
    if (simple) {
      englishLookupCandidates(simple).forEach((v) => variants.add(v));
      variants.add(singularize(simple));
      variants.add(pluralize(simple));
    }
    mandoaLookupCandidates(q).forEach((v) => variants.add(v));

    const variantList = Array.from(variants).filter(Boolean);

    const filtered = dictionary.filter((entry) => {
      const mandoa = normalize(entry.mandoa);
      const english = normalize(entry.english);
      const pronunciation = normalize(entry.pronunciation);

      return variantList.some(
        (variant) =>
          mandoa.includes(variant) ||
          english.includes(variant) ||
          pronunciation.includes(variant)
      );
    });

    filtered.sort((a, b) => {
      const aNormM = normalize(a.mandoa);
      const aNormE = normalize(a.english);
      const bNormM = normalize(b.mandoa);
      const bNormE = normalize(b.english);

      const aExact = aNormM === q || aNormE === q;
      const bExact = bNormM === q || bNormE === q;
      if (aExact && !bExact) {
        return -1;
      }
      if (!aExact && bExact) {
        return 1;
      }

      const aVariantExact = variantList.some((v) => aNormM === v || aNormE === v);
      const bVariantExact = variantList.some((v) => bNormM === v || bNormE === v);
      if (aVariantExact && !bVariantExact) {
        return -1;
      }
      if (!aVariantExact && bVariantExact) {
        return 1;
      }

      return aNormM.localeCompare(bNormM);
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
    if (entryCountEl) {
      entryCountEl.textContent = String(dictionary.length);
    }
    renderDictionary(dictionary);
    initTheme();

    translateBtn.addEventListener("click", translateInput);
    clearBtn.addEventListener("click", () => {
      sourceTextEl.value = "";
      translationResultEl.textContent = "";
      renderTranslationSuggestions(directionEl.value, "", []);
      matchListEl.innerHTML = "";
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const original = copyBtn.textContent;
        const ok = await copyResultToClipboard();
        copyBtn.textContent = ok ? "Copied" : "Copy failed";
        window.setTimeout(() => {
          copyBtn.textContent = original || "Copy";
        }, 1200);
      });
    }

    sourceTextEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const start = sourceTextEl.selectionStart;
        const end = sourceTextEl.selectionEnd;
        const value = sourceTextEl.value;
        sourceTextEl.value = `${value.slice(0, start)}\n${value.slice(end)}`;
        sourceTextEl.selectionStart = start + 1;
        sourceTextEl.selectionEnd = start + 1;
        return;
      }

      event.preventDefault();
      translateInput();
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
