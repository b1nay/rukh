"""Typical routings to Kathmandu from 10 major source airports.

Segment distances are saved great-circle air distances (km). Layovers are
typical minimum connection times at each hub. Carriers are examples of who
flies the route; operators can override per traveler later.
"""

TO_KTM: dict[str, dict] = {
    "LHR": {"segments": [("LHR", "DOH", 5241), ("DOH", "KTM", 3360)], "layovers": {"DOH": 2.5}, "carrier": "Qatar Airways"},
    "FRA": {"segments": [("FRA", "IST", 1838), ("IST", "KTM", 5305)], "layovers": {"IST": 3.0}, "carrier": "Turkish Airlines"},
    "CDG": {"segments": [("CDG", "DXB", 5239), ("DXB", "KTM", 2990)], "layovers": {"DXB": 3.0}, "carrier": "Emirates / flydubai"},
    "AMS": {"segments": [("AMS", "DOH", 4923), ("DOH", "KTM", 3360)], "layovers": {"DOH": 2.5}, "carrier": "Qatar Airways"},
    "JFK": {"segments": [("JFK", "DOH", 10769), ("DOH", "KTM", 3360)], "layovers": {"DOH": 2.5}, "carrier": "Qatar Airways"},
    "LAX": {"segments": [("LAX", "DOH", 13347), ("DOH", "KTM", 3360)], "layovers": {"DOH": 2.5}, "carrier": "Qatar Airways"},
    "SYD": {"segments": [("SYD", "SIN", 6294), ("SIN", "KTM", 3537)], "layovers": {"SIN": 2.5}, "carrier": "Singapore Airlines"},
    "DEL": {"segments": [("DEL", "KTM", 815)], "layovers": {}, "carrier": "Nepal Airlines / Air India"},
    "BKK": {"segments": [("BKK", "KTM", 2229)], "layovers": {}, "carrier": "Thai Airways"},
    "ICN": {"segments": [("ICN", "KTM", 3966)], "layovers": {}, "carrier": "Korean Air"},
}
