"""
Feed sources. Three reputable public RSS feeds, deliberately picked to have
*different* underlying formats so the normalization step in ingest.py actually
has to do work (BBC uses <description>, Guardian uses <content:encoded> +
different date format, Al Jazeera has yet another date/summary shape).
"""

FEEDS = [
    {"source": "BBC News", "url": "http://feeds.bbci.co.uk/news/rss.xml"},
    {"source": "The Guardian", "url": "https://www.theguardian.com/world/rss"},
    {"source": "Al Jazeera", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
]
