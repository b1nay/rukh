"""Starter itineraries shown to every Climate Partner ("Popular in Nepal")."""

INTL = {"category": "flight", "mode": "international", "destination": "KTM", "round_trip": True, "day": 1,
        "label": "International flight to Kathmandu (return)"}


def _taxi(day, label):
    return {"category": "road", "mode": "taxi", "distance_km": 7, "share": 2, "day": day, "label": label}


TEMPLATES = [
    {
        "name": "Everest Base Camp Trek",
        "kind": "trek",
        "days": 14,
        "description": "Kathmandu, Lukla flight via Ramechhap, teahouse trek to EBC and back.",
        "legs": [
            INTL,
            _taxi(1, "Airport to hotel"),
            {"category": "stay", "mode": "hotel_standard", "nights": 2, "day": 1, "label": "Kathmandu hotel"},
            {"category": "road", "mode": "jeep", "distance_km": 130, "share": 5, "day": 3, "label": "Kathmandu to Ramechhap"},
            {"category": "flight", "mode": "domestic", "origin": "RHP", "destination": "LUA", "day": 3, "label": "Ramechhap to Lukla"},
            {"category": "trail", "mode": "trek", "distance_km": 130, "day": 3, "label": "Lukla – EBC – Lukla"},
            {"category": "stay", "mode": "teahouse", "nights": 9, "day": 3, "label": "Teahouses on the trail"},
            {"category": "flight", "mode": "domestic", "origin": "LUA", "destination": "RHP", "day": 12, "label": "Lukla to Ramechhap"},
            {"category": "road", "mode": "jeep", "distance_km": 130, "share": 5, "day": 12, "label": "Ramechhap to Kathmandu"},
            {"category": "stay", "mode": "hotel_standard", "nights": 2, "day": 12, "label": "Kathmandu hotel"},
            _taxi(14, "Hotel to airport"),
        ],
    },
    {
        "name": "Annapurna Base Camp Trek",
        "kind": "trek",
        "days": 12,
        "description": "Bus to Pokhara, jeep to Nayapul, teahouse trek to ABC, fly back.",
        "legs": [
            INTL,
            _taxi(1, "Airport to hotel"),
            {"category": "stay", "mode": "hotel_standard", "nights": 1, "day": 1, "label": "Kathmandu hotel"},
            {"category": "road", "mode": "tourist_bus", "distance_km": 200, "day": 2, "label": "Kathmandu to Pokhara"},
            {"category": "stay", "mode": "hotel_standard", "nights": 1, "day": 2, "label": "Pokhara hotel"},
            {"category": "road", "mode": "jeep", "distance_km": 45, "share": 5, "day": 3, "label": "Pokhara to Nayapul"},
            {"category": "trail", "mode": "trek", "distance_km": 110, "day": 3, "label": "Nayapul – ABC – Nayapul"},
            {"category": "stay", "mode": "teahouse", "nights": 7, "day": 3, "label": "Teahouses on the trail"},
            {"category": "road", "mode": "jeep", "distance_km": 45, "share": 5, "day": 10, "label": "Nayapul to Pokhara"},
            {"category": "stay", "mode": "hotel_standard", "nights": 1, "day": 10, "label": "Pokhara hotel"},
            {"category": "flight", "mode": "domestic", "origin": "PKR", "destination": "KTM", "day": 11, "label": "Pokhara to Kathmandu"},
            {"category": "stay", "mode": "hotel_standard", "nights": 1, "day": 11, "label": "Kathmandu hotel"},
            _taxi(12, "Hotel to airport"),
        ],
    },
    {
        "name": "Kathmandu · Chitwan · Pokhara Tour",
        "kind": "tour",
        "days": 8,
        "description": "Heritage sites, jungle safari in Chitwan and lakeside Pokhara.",
        "legs": [
            INTL,
            _taxi(1, "Airport to hotel"),
            {"category": "stay", "mode": "hotel_luxury", "nights": 2, "day": 1, "label": "Kathmandu hotel"},
            {"category": "activity", "mode": "cultural_tour", "day": 2, "label": "Kathmandu heritage tour"},
            {"category": "road", "mode": "tourist_bus", "distance_km": 160, "day": 3, "label": "Kathmandu to Chitwan"},
            {"category": "stay", "mode": "hotel_standard", "nights": 2, "day": 3, "label": "Chitwan resort"},
            {"category": "activity", "mode": "jungle_safari", "day": 4, "label": "Jungle jeep safari"},
            {"category": "activity", "mode": "canoe", "day": 4, "label": "Rapti river canoe"},
            {"category": "road", "mode": "tourist_bus", "distance_km": 150, "day": 5, "label": "Chitwan to Pokhara"},
            {"category": "stay", "mode": "hotel_standard", "nights": 2, "day": 5, "label": "Pokhara hotel"},
            {"category": "activity", "mode": "paragliding", "day": 6, "label": "Sarangkot paragliding"},
            {"category": "flight", "mode": "domestic", "origin": "PKR", "destination": "KTM", "day": 7, "label": "Pokhara to Kathmandu"},
            {"category": "stay", "mode": "hotel_luxury", "nights": 1, "day": 7, "label": "Kathmandu hotel"},
            _taxi(8, "Hotel to airport"),
        ],
    },
    {
        "name": "Langtang Valley Trek",
        "kind": "trek",
        "days": 9,
        "description": "Jeep to Syabrubesi and a teahouse trek up the Langtang valley.",
        "legs": [
            INTL,
            _taxi(1, "Airport to hotel"),
            {"category": "stay", "mode": "hotel_standard", "nights": 1, "day": 1, "label": "Kathmandu hotel"},
            {"category": "road", "mode": "jeep", "distance_km": 120, "share": 5, "day": 2, "label": "Kathmandu to Syabrubesi"},
            {"category": "trail", "mode": "trek", "distance_km": 65, "day": 2, "label": "Syabrubesi – Kyanjin Gompa – Syabrubesi"},
            {"category": "stay", "mode": "teahouse", "nights": 6, "day": 2, "label": "Teahouses on the trail"},
            {"category": "road", "mode": "jeep", "distance_km": 120, "share": 5, "day": 8, "label": "Syabrubesi to Kathmandu"},
            {"category": "stay", "mode": "hotel_standard", "nights": 1, "day": 8, "label": "Kathmandu hotel"},
            _taxi(9, "Hotel to airport"),
        ],
    },
]
