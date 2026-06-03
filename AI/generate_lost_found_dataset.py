import json
import math
import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path


SEED = 20260525
GROUP_COUNT = 3000
REPORTS_PER_GROUP = 4
TARGET_POSITIVE_PAIRS = 15000
TARGET_NEGATIVE_PAIRS = 15000

CATEGORIES = ["electronics", "documents", "clothing", "accessories", "other"]

OUT_DIR = Path(__file__).resolve().parent / "datasets" / "lost_found_matching"
ITEMS_PATH = OUT_DIR / "items.json"
PAIRS_PATH = OUT_DIR / "training_pairs.json"


PLACES = [
    ("Tribhuvan University central library, Kirtipur", 27.6816, 85.2866),
    ("Pulchowk Engineering Campus gate", 27.6823, 85.3188),
    ("Kathmandu Mall food court", 27.7055, 85.3141),
    ("Ratna Park bus stop", 27.7062, 85.3158),
    ("New Baneshwor bus stand", 27.6895, 85.3355),
    ("Boudha Stupa cafe lane", 27.7215, 85.3620),
    ("Patan Durbar Square museum entrance", 27.6727, 85.3253),
    ("Pokhara Lakeside taxi stand", 28.2096, 83.9856),
    ("Pokhara University library block", 28.1536, 84.0887),
    ("Biratnagar bus park", 26.4525, 87.2718),
    ("Dharan clock tower", 26.8124, 87.2839),
    ("Chitwan medical college cafeteria", 27.6830, 84.4333),
    ("Delhi University north campus library", 28.6863, 77.2100),
    ("Connaught Place metro gate 4", 28.6315, 77.2167),
    ("Kashmere Gate ISBT platform", 28.6676, 77.2273),
    ("Jawaharlal Nehru University admin block", 28.5457, 77.1707),
    ("IIT Delhi main gate", 28.5450, 77.1926),
    ("Select Citywalk Saket atrium", 28.5286, 77.2190),
    ("Bangalore Majestic bus stand", 12.9767, 77.5713),
    ("Christ University central block", 12.9344, 77.6069),
    ("IISc Bangalore library", 13.0219, 77.5671),
    ("Mumbai CST ticket counter", 18.9402, 72.8356),
    ("Phoenix Marketcity Kurla", 19.0864, 72.8898),
    ("Pune FC Road book cafe", 18.5236, 73.8416),
    ("Hyderabad Gachibowli bus stop", 17.4401, 78.3489),
    ("Chennai Central station concourse", 13.0827, 80.2755),
    ("Kolkata College Street coffee house", 22.5761, 88.3649),
    ("Ahmedabad University library", 23.0388, 72.5491),
    ("Lucknow Hazratganj metro exit", 26.8500, 80.9462),
    ("Jaipur Sindhi Camp bus stand", 26.9220, 75.7997),
]

COLORS = [
    ("black", ["black", "dark black", "matte black", "charcoal black"]),
    ("blue", ["navy blue", "sky blue", "faded blue", "royal blue", "bluish"]),
    ("red", ["crimson red", "maroon", "wine red", "bright red"]),
    ("green", ["olive green", "dark green", "bottle green", "mint green"]),
    ("white", ["white", "off white", "cream white", "milky white"]),
    ("grey", ["grey", "silver grey", "ash grey", "graphite"]),
    ("brown", ["brown", "tan brown", "coffee brown", "chocolate brown"]),
    ("pink", ["pink", "dusty pink", "rose pink", "light pink"]),
    ("yellow", ["yellow", "mustard yellow", "golden yellow"]),
    ("purple", ["purple", "lavender", "violet"]),
]

ELECTRONICS = {
    "brands": ["Apple", "Samsung", "Dell", "Lenovo", "HP", "Asus", "Acer", "Sony", "JBL", "Boat", "OnePlus", "Xiaomi", "Realme", "Canon", "Nikon", None, None],
    "objects": [
        "laptop", "phone", "tablet", "earbuds case", "wireless headphones", "power bank",
        "scientific calculator", "camera lens", "USB drive", "smart watch", "charging adapter",
        "Bluetooth speaker", "graphics tablet", "mouse", "keyboard pouch", "hard disk",
    ],
    "details": [
        "with cracked corner", "with faded sticker on the back", "inside a soft sleeve",
        "with loose charging cable", "screen protector chipped near top edge",
        "with college ID wallpaper", "wrapped in transparent cover", "with scratched body",
        "with one missing rubber foot", "has a small tape mark near the hinge",
    ],
}

DOCUMENTS = {
    "brands": [None, None, None, "Oxford", "Classmate", "Camlin", "Navneet"],
    "objects": [
        "engineering drawing file", "semester notes bundle", "passport cover", "citizenship certificate photocopy",
        "admit card folder", "lab record notebook", "library issue card", "bank cheque book",
        "blue exam answer sheet folder", "medical report envelope", "project report spiral file",
        "visa document folder", "school transcript envelope", "internship certificate file",
    ],
    "details": [
        "with handwritten index page", "held by a black binder clip", "with coffee stain on first page",
        "name written only on inside cover", "contains photocopies and fee receipt",
        "corners bent from being kept in a backpack", "with a small sticky note attached",
        "plastic cover slightly torn", "roll number written in pencil", "rubber band around it",
    ],
}

CLOTHING = {
    "brands": ["Nike", "Adidas", "Puma", "H&M", "Zara", "Uniqlo", "Levi's", "North Face", None, None, None],
    "objects": [
        "hoodie", "denim jacket", "raincoat", "school blazer", "scarf", "cap", "sweater",
        "sports jersey", "kurta shawl", "track pants", "woolen muffler", "lab coat",
        "formal coat", "windcheater", "college T-shirt",
    ],
    "details": [
        "with initials stitched inside", "zipper pull is broken", "one sleeve has a faint stain",
        "kept in a thin plastic bag", "logo is almost worn out", "smells a bit of perfume",
        "has a small tear near pocket", "folded and left on a chair", "with bus ticket in pocket",
        "size tag faded",
    ],
}

ACCESSORIES = {
    "brands": ["Nike", "Adidas", "Puma", "Fastrack", "Casio", "Titan", "Ray-Ban", "American Tourister", "Wildcraft", "Skybags", None, None],
    "objects": [
        "backpack", "trolley bag", "wristwatch", "wallet", "spectacles case", "sunglasses",
        "keychain bunch", "handbag", "college ID lanyard", "belt pouch", "waterproof sling bag",
        "umbrella", "makeup pouch", "coin purse", "travel neck pillow",
    ],
    "details": [
        "with Superman sticker", "zip has a red thread tied to it", "contains a metro card",
        "engraved on the back", "strap is peeling", "one side pocket is torn",
        "has hostel room key attached", "with small Ganesh charm", "handle has tape wrapped around",
        "inside lining is checked pattern",
    ],
}

OTHER = {
    "brands": ["Cello", "Milton", "Nataraj", "Faber-Castell", "Camel", None, None, None],
    "objects": [
        "steel water bottle", "lunch box", "geometry box", "sketchbook", "medicine pouch",
        "tiffin carrier", "lab safety goggles", "yoga mat", "helmet", "novel", "thermos flask",
        "small tool kit", "prayer beads pouch", "paint brush roll", "folding umbrella cover",
    ],
    "details": [
        "with name scratched lightly", "lid has a dent", "wrapped in newspaper",
        "with blue tape around it", "kept near the notice board", "has a faint smell of sanitizer",
        "with old library stamp", "one corner is chipped", "has a handwritten phone number",
        "covered with dust from bus floor",
    ],
}

CATALOG = {
    "electronics": ELECTRONICS,
    "documents": DOCUMENTS,
    "clothing": CLOTHING,
    "accessories": ACCESSORIES,
    "other": OTHER,
}

CONTEXTS = [
    "after lunch near the cafeteria",
    "while changing buses in the evening rush",
    "outside Block C after practical class",
    "near the library issue counter",
    "beside the security desk",
    "around the photocopy shop",
    "on a bench by the main gate",
    "inside the public bus, back half",
    "near the mall escalator",
    "at the cafe table near the window",
    "during the morning lecture break",
    "near the hostel notice board",
    "around the metro token counter",
    "close to the exam hall queue",
    "near the taxi stand after rain",
]

FOUND_VERBS = [
    "Found near", "Picked up from", "Someone left this around", "Found lying beside",
    "Collected from security near", "Found on a chair at", "Recovered from the bus stop near",
]

LOST_VERBS = [
    "Lost near", "Might have dropped around", "Left at", "Misplaced somewhere close to",
    "I think I forgot it near", "Last seen around", "Probably slipped out near",
]


def choose_weighted_category(rng):
    return rng.choices(
        CATEGORIES,
        weights=[0.28, 0.18, 0.17, 0.25, 0.12],
        k=1,
    )[0]


def jitter_location(rng, lat, lng, min_km=0.05, max_km=4.7):
    distance = rng.uniform(min_km, max_km)
    angle = rng.uniform(0, 2 * math.pi)
    dlat = (distance / 111.0) * math.cos(angle)
    dlng = (distance / (111.0 * math.cos(math.radians(lat)))) * math.sin(angle)
    return round(lat + dlat, 6), round(lng + dlng, 6)


def iso_time(dt):
    return dt.replace(microsecond=0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def color_variant(rng, color_family):
    variants = dict(COLORS)[color_family]
    return rng.choice(variants)


def maybe_brand_for_report(rng, brand, keep_chance=0.76):
    if brand is None or rng.random() > keep_chance:
        return None
    return brand


def build_title(rng, report_type, category, obj, color, brand, detail):
    noun_aliases = {
        "phone": ["mobile phone", "handset", "smartphone"],
        "earbuds case": ["earphones case", "earbud charging case", "wireless buds case"],
        "backpack": ["school bag", "college backpack", "bag"],
        "trolley bag": ["rolling suitcase", "travel trolley", "luggage bag"],
        "wristwatch": ["watch", "hand watch", "analog watch"],
        "semester notes bundle": ["class notes", "semester notebook set", "notes bundle"],
        "engineering drawing file": ["drawing sheet file", "engineering graphics file", "drafter file"],
        "spectacles case": ["glasses case", "specs box", "eyeglass case"],
        "steel water bottle": ["metal bottle", "water flask", "steel flask"],
        "scientific calculator": ["calculator", "exam calculator", "Casio-type calculator"],
    }
    noun = rng.choice(noun_aliases.get(obj, [obj]))
    brand_text = "" if brand is None else rng.choice([brand, brand.lower(), f"{brand} logo"])
    parts = []
    if rng.random() < 0.82:
        parts.append(color)
    if brand_text and rng.random() < 0.72:
        parts.append(brand_text)
    parts.append(noun)
    if rng.random() < 0.58:
        parts.append(detail)
    title = " ".join(parts)
    if rng.random() < 0.18:
        title = f"{report_type.lower()} {title}"
    if category == "documents" and rng.random() < 0.3:
        title = title.replace(color + " ", "")
    return " ".join(title.split())


def build_description(rng, report_type, landmark, obj, color, brand, detail, context, serial_hint):
    action = rng.choice(LOST_VERBS if report_type == "LOST" else FOUND_VERBS)
    brand_phrase = "" if brand is None else rng.choice([f"It is {brand}. ", f"{brand} branding is visible. ", f"May be {brand}, not fully sure. "])
    informal = rng.choice([
        "Please check once, I am not fully sure about the exact spot.",
        "The owner may describe the inside contents.",
        "It looked used, not new.",
        "I was in a hurry so the timing may be off by a little.",
        "Security may have seen it too.",
        "There is no proper name tag outside.",
        "I remember this because of the small mark on it.",
    ])
    contents = rng.choice([
        "Contains a folded receipt.",
        "There may be class notes inside.",
        "A small sticker is visible.",
        "No cash was checked.",
        "It has a personal mark near one edge.",
        "The zip or cover looked slightly worn.",
        "It was kept separately from other things.",
    ])
    return (
        f"{action} {landmark} {context}. "
        f"{color.capitalize()} {obj} {detail}. "
        f"{brand_phrase}{contents} {informal} Ref {serial_hint}."
    )


def make_base_object(rng, group_index):
    category = choose_weighted_category(rng)
    spec = CATALOG[category]
    place = rng.choice(PLACES)
    color_family, _ = rng.choice(COLORS)
    brand = rng.choice(spec["brands"])
    obj = rng.choice(spec["objects"])
    detail = rng.choice(spec["details"])
    context = rng.choice(CONTEXTS)
    base_date = datetime(2025, 1, 1, 6, 0, 0) + timedelta(
        days=rng.randint(0, 500),
        hours=rng.randint(0, 15),
        minutes=rng.randint(0, 59),
    )
    serial_hint = f"{rng.choice(['A', 'B', 'K', 'R', 'S'])}{rng.randint(10, 99)}"
    return {
        "group": f"PAIR-G{group_index:05d}",
        "category": category,
        "place": place,
        "color_family": color_family,
        "brand": brand,
        "object": obj,
        "detail": detail,
        "context": context,
        "base_date": base_date,
        "serial_hint": serial_hint,
    }


def make_reports_for_group(rng, base, group_index):
    reports = []
    report_types = ["LOST", "FOUND", "LOST", "FOUND"]
    rng.shuffle(report_types)
    landmark, lat, lng = base["place"]
    for report_index, report_type in enumerate(report_types):
        color = color_variant(rng, base["color_family"])
        report_brand = maybe_brand_for_report(rng, base["brand"])
        report_lat, report_lng = jitter_location(rng, lat, lng)
        date = base["base_date"] + timedelta(
            hours=rng.randint(-18, 72),
            minutes=rng.randint(0, 59),
        )
        item_id = f"item_{group_index:05d}_{report_index + 1}"
        title = build_title(
            rng,
            report_type,
            base["category"],
            base["object"],
            color,
            report_brand,
            base["detail"],
        )
        description = build_description(
            rng,
            report_type,
            landmark,
            base["object"],
            color,
            report_brand,
            base["detail"],
            base["context"],
            base["serial_hint"],
        )
        reports.append(
            {
                "id": item_id,
                "type": report_type,
                "title": title,
                "description": description,
                "category": base["category"],
                "color": color,
                "brand": report_brand,
                "location": {"lat": report_lat, "lng": report_lng},
                "dateReported": iso_time(date),
                "possiblePairGroup": base["group"],
            }
        )
    return reports


def pair_key(a, b):
    return tuple(sorted((a, b)))


def distance_km(a, b):
    lat1, lng1 = a["location"]["lat"], a["location"]["lng"]
    lat2, lng2 = b["location"]["lat"], b["location"]["lng"]
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(h))


def build_positive_pairs(rng, items_by_group):
    all_pairs = []
    for group_items in items_by_group.values():
        for i in range(len(group_items)):
            for j in range(i + 1, len(group_items)):
                all_pairs.append(
                    {
                        "item1_id": group_items[i]["id"],
                        "item2_id": group_items[j]["id"],
                        "label": 1,
                    }
                )
    rng.shuffle(all_pairs)
    return all_pairs[:TARGET_POSITIVE_PAIRS]


def build_negative_pairs(rng, items):
    by_category = defaultdict(list)
    by_category_color = defaultdict(list)
    by_title_token = defaultdict(list)
    for item in items:
        by_category[item["category"]].append(item)
        color_family = next((family for family, variants in COLORS if item["color"] in variants), item["color"])
        by_category_color[(item["category"], color_family)].append(item)
        for token in set(item["title"].lower().replace("-", " ").split()):
            if len(token) > 4:
                by_title_token[token].append(item)

    pairs = {}
    attempts = 0
    max_attempts = TARGET_NEGATIVE_PAIRS * 80
    while len(pairs) < TARGET_NEGATIVE_PAIRS and attempts < max_attempts:
        attempts += 1
        mode = rng.random()
        item1 = rng.choice(items)
        item2 = None

        if mode < 0.45:
            color_family = next((family for family, variants in COLORS if item1["color"] in variants), item1["color"])
            candidates = by_category_color[(item1["category"], color_family)]
            item2 = rng.choice(candidates)
        elif mode < 0.72:
            candidates = by_category[item1["category"]]
            item2 = rng.choice(candidates)
        elif mode < 0.9:
            tokens = [t for t in item1["title"].lower().replace("-", " ").split() if len(t) > 4]
            if tokens:
                candidates = by_title_token[rng.choice(tokens)]
                if candidates:
                    item2 = rng.choice(candidates)
        else:
            item2 = rng.choice(items)

        if item2 is None:
            continue
        if item1["id"] == item2["id"]:
            continue
        if item1["possiblePairGroup"] == item2["possiblePairGroup"]:
            continue

        # Favor hard negatives, but keep some far-apart examples for generalization.
        same_category = item1["category"] == item2["category"]
        same_color = item1["color"].split()[-1] == item2["color"].split()[-1]
        nearby = distance_km(item1, item2) <= 6.0
        token_overlap = bool(set(item1["title"].lower().split()) & set(item2["title"].lower().split()))
        if not (same_category or same_color or nearby or token_overlap):
            continue

        key = pair_key(item1["id"], item2["id"])
        if key in pairs:
            continue
        pairs[key] = {"item1_id": key[0], "item2_id": key[1], "label": 0}

    if len(pairs) < TARGET_NEGATIVE_PAIRS:
        raise RuntimeError(f"Could only create {len(pairs)} negative pairs")
    return list(pairs.values())


def validate(items, pairs):
    ids = [item["id"] for item in items]
    if len(items) < 10000:
        raise AssertionError("items.json must contain at least 10,000 items")
    if len(ids) != len(set(ids)):
        raise AssertionError("item ids must be unique")
    if len(pairs) < 30000:
        raise AssertionError("training_pairs.json must contain at least 30,000 pairs")
    if {item["category"] for item in items} - set(CATEGORIES):
        raise AssertionError("invalid category found")
    valid_ids = set(ids)
    label_counts = defaultdict(int)
    seen_pairs = set()
    group_by_id = {item["id"]: item["possiblePairGroup"] for item in items}
    for pair in pairs:
        if pair["item1_id"] not in valid_ids or pair["item2_id"] not in valid_ids:
            raise AssertionError("pair references a missing item id")
        key = pair_key(pair["item1_id"], pair["item2_id"])
        if key in seen_pairs:
            raise AssertionError("duplicate training pair found")
        seen_pairs.add(key)
        label_counts[pair["label"]] += 1
        same_group = group_by_id[pair["item1_id"]] == group_by_id[pair["item2_id"]]
        if pair["label"] == 1 and not same_group:
            raise AssertionError("positive pair uses different groups")
        if pair["label"] == 0 and same_group:
            raise AssertionError("negative pair uses same group")
    if label_counts[0] != label_counts[1]:
        raise AssertionError(f"pairs must be balanced, got {dict(label_counts)}")


def main():
    rng = random.Random(SEED)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    items = []
    items_by_group = {}
    for group_index in range(1, GROUP_COUNT + 1):
        base = make_base_object(rng, group_index)
        group_items = make_reports_for_group(rng, base, group_index)
        items.extend(group_items)
        items_by_group[base["group"]] = group_items

    positive_pairs = build_positive_pairs(rng, items_by_group)
    negative_pairs = build_negative_pairs(rng, items)
    pairs = positive_pairs + negative_pairs
    rng.shuffle(pairs)

    validate(items, pairs)

    ITEMS_PATH.write_text(json.dumps(items, indent=2, ensure_ascii=True), encoding="utf-8")
    PAIRS_PATH.write_text(json.dumps(pairs, indent=2, ensure_ascii=True), encoding="utf-8")

    label_counts = defaultdict(int)
    for pair in pairs:
        label_counts[pair["label"]] += 1
    print(f"Wrote {len(items)} items to {ITEMS_PATH}")
    print(f"Wrote {len(pairs)} training pairs to {PAIRS_PATH}")
    print(f"Pair labels: {dict(sorted(label_counts.items()))}")


if __name__ == "__main__":
    main()
