"""Questions shown after a high heart-rate session, and the plain-text summary for sharing.

Questionnaire items are adapted from the Altman Self-Rating Mania Scale (ASRM): five items,
0-4 each, about the past week. A total of 6 or more is the published screening cut-off.
It is a prompt to talk to someone, not a diagnosis.
"""

# Everyday things that raise heart rate. Any one of these explains the reading.
REASONS = [
    ("exercise", "Exercise or physical activity in the last hour"),
    ("caffeine", "Coffee, energy drinks, nicotine or alcohol"),
    ("excitement", "A scary or intense movie, game, or news"),
    ("stress", "Stress, worry, an argument or a panic feeling"),
    ("condition", "A health condition acting up (blood sugar, blood pressure, thyroid, heart)"),
    ("medication", "Medication or other substances (e.g. decongestants, stimulants)"),
    ("unwell", "Feeling sick, feverish, dehydrated or in pain"),
]

FREQUENCY = ["Not more than usual", "Occasionally", "Often", "Most of the time", "All of the time"]

ITEMS = [
    ("cheerful", "Felt happier or more cheerful than usual"),
    ("confident", "Felt more self-confident than usual"),
    ("less_sleep", "Needed less sleep than usual, without feeling tired"),
    ("talkative", "Talked more than usual, or found it hard to stop talking"),
    ("active", "Been more active than usual (socially, at work, at home, with plans or projects)"),
]

# Not scored; listed in the summary because people often notice them alongside a high phase.
ALSO = [
    ("racing_thoughts", "Racing thoughts or jumping between ideas"),
    ("distracted", "Easily distracted"),
    ("irritable", "More irritable or impatient than usual"),
    ("risky", "Spending, decisions or risks that are unusual for me"),
]

THRESHOLD = 6

REASON_IDS = [k for k, _ in REASONS]
ITEM_IDS = [k for k, _ in ITEMS]
ALSO_IDS = [k for k, _ in ALSO]


def form() -> dict:
    as_list = lambda pairs: [{"id": k, "label": v} for k, v in pairs]  # noqa: E731
    return {
        "reasons": as_list(REASONS), "items": as_list(ITEMS), "also": as_list(ALSO),
        "frequency": FREQUENCY, "threshold": THRESHOLD,
    }


def outcome(score: int | None) -> str:
    if score is None:
        return "An everyday reason explained the higher heart rate. No questionnaire needed."
    if score >= THRESHOLD:
        return (
            "These answers show several changes people often watch for as early signs of a high "
            "(manic or hypomanic) phase. This is not a diagnosis. It is a good time to talk with "
            "someone you trust or your clinician."
        )
    return (
        "These answers do not show many of the usual signs of a high phase. If your heart rate "
        "stays high or you feel unwell, check in with a doctor."
    )


def summary_text(row: dict) -> str:
    """Plain text that the person can email to a friend or professional."""
    labels = dict(REASONS) | dict(ITEMS) | dict(ALSO)
    when = row["created_at"].astimezone().strftime("%A %d %B %Y, %H:%M")
    lines = [f"BipolarBird check-in shared with you ({when})", ""]
    if row["heart_rate"] is not None:
        hr = f"Heart rate during a camera session: {round(row['heart_rate'])} bpm"
        if row["usual_heart_rate"] is not None:
            hr += f" (usual for me: about {round(row['usual_heart_rate'])} bpm)"
        lines += [hr, ""]
    if row["explained_by"]:
        lines += ["Everyday reasons I noted:"] + [f"- {labels[k]}" for k in row["explained_by"]] + [""]
    if row["answers"] is not None:
        lines.append("Over the past week (adapted from the Altman Self-Rating Mania Scale):")
        for k in ITEM_IDS:
            lines.append(f"- {labels[k]}: {FREQUENCY[row['answers'][k]]}")
        lines += [f"Total: {row['score']} of 20 (6 or more suggests talking it over)", ""]
        if row["also_noticed"]:
            lines += ["I also noticed:"] + [f"- {labels[k]}" for k in row["also_noticed"]] + [""]
    lines += [
        outcome(row["score"]), "",
        "Camera heart-rate readings are estimates and can be affected by light and movement.",
        "If this is an emergency, call or text 988 (US) or your local emergency number.",
    ]
    return "\n".join(lines)
