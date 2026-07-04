"""
Part 1b -- group articles into topic clusters.

Approach: Option A, keyword/word-overlap grouping. Chosen over TF-IDF/sklearn
because the assessment explicitly says a simple approach done well is
preferred, and word-overlap is easy to explain in the video walkthrough and
easy for a reviewer to sanity-check by reading the code. See README for the
tradeoffs vs. TF-IDF.

Algorithm:
  1. Extract "meaningful words" from headline + summary for each article
     (lowercase, strip punctuation, drop stopwords, drop words < 3 chars).
  2. Compare every pair of articles by the count of shared meaningful words.
     If shared_words >= OVERLAP_THRESHOLD, union them into the same cluster
     (union-find, so overlap is transitive: A-B and B-C shared enough words
     means A, B, C end up in one cluster even if A and C alone don't overlap
     enough -- this is what lets 3+ outlets covering the same story converge).
  3. Singleton articles (no sufficiently-overlapping match) become
     single-article clusters -- still shown on the timeline, just narrow.
  4. Label each cluster with its most frequent shared keywords.
"""
import re
from collections import Counter
import hashlib

OVERLAP_THRESHOLD = 3  # >= this many shared meaningful words => same story

STOPWORDS = set("""
a an the is are was were be been being of in on at to for from by with about
as into like through after over between out against during without before
under around among and or but if then else when while so that this these
those it its it's their his her he she they them we you i as not no do does
did will would can could should may might must shall than too very just up
down off again further once here there all any both each few more most other
some such only own same s t don now day says say said new years year also
after amid us people time week two three
""".split())


def meaningful_words(text: str) -> set:
    words = re.findall(r"[a-zA-Z']+", (text or "").lower())
    return {w for w in words if len(w) >= 3 and w not in STOPWORDS}


class UnionFind:
    def __init__(self, items):
        self.parent = {x: x for x in items}

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def cluster_articles(articles: list[dict], threshold: int = OVERLAP_THRESHOLD) -> list[dict]:
    """
    articles: list of dicts with at least id, headline, summary
    returns: list of {id, label, keywords, article_ids}
    """
    word_sets = {a["id"]: meaningful_words(f"{a['headline']} {a.get('summary', '')}") for a in articles}
    ids = list(word_sets.keys())

    uf = UnionFind(ids)
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = ids[i], ids[j]
            shared = word_sets[a] & word_sets[b]
            if len(shared) >= threshold:
                uf.union(a, b)

    groups: dict[str, list[str]] = {}
    for aid in ids:
        root = uf.find(aid)
        groups.setdefault(root, []).append(aid)

    clusters = []
    for root, member_ids in groups.items():
        word_counts = Counter()
        for aid in member_ids:
            word_counts.update(word_sets[aid])
        top_keywords = [w for w, _ in word_counts.most_common(4)]
        label = " ".join(w.capitalize() for w in top_keywords[:3]) if top_keywords else "Uncategorized"
        cluster_id = "c_" + hashlib.sha256(",".join(sorted(member_ids)).encode()).hexdigest()[:16]
        clusters.append(
            {
                "id": cluster_id,
                "label": label,
                "keywords": top_keywords,
                "article_ids": member_ids,
            }
        )

    # Largest clusters first -- more useful default ordering for the API/UI
    clusters.sort(key=lambda c: len(c["article_ids"]), reverse=True)
    return clusters
