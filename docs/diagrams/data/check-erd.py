"""Check rendered documentation semantics, not application/database execution."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
NS = {"svg": "http://www.w3.org/2000/svg"}

# Expected optional FKs from the reviewed model, independent of renderer logic.
OPTIONAL = {
    "profiles.school_id, major_id", "user_roles.assigned_by",
    "profiles.school_id", "profiles.major_id", "student_verifications.reviewer_id",
    "profile_skills.expertise_approved_by", "skill_evidence.reviewer_id", "classes.completed_by",
    "wallets.owner_user_id", "ledger_transactions.booking_id", "ledger_transactions.withdrawal_request_id",
    "ledger_transactions.initiated_by_user_id", "ledger_transactions.reverses_transaction_id",
    "ledger_postings.user_id", "ledger_postings.class_id", "audit_events.actor_id",
}
UNIQUE_FKS = {
    "profiles.user_id", "wallets.owner_user_id", "ratings.booking_id",
    "ledger_transactions.reverses_transaction_id",
}
REQUIRED_CHILD = {"profiles.user_id", "ledger_transactions.withdrawal_request_id"}
IDENTIFYING = {
    "user_roles.user_id", "school_majors.school_id", "school_majors.major_id",
    "class_skills.class_id", "class_skills.skill_id",
}


def load_view(stem, table_count, relation_count):
    root = ET.parse(ROOT / f"{stem}.svg").getroot()
    nodes = [node for node in root.findall(".//svg:g", NS) if node.get("class") == "node"]
    assert len([node for node in nodes if not node.get("id", "").startswith("enum-")]) == table_count, stem
    edges = [node for node in root.findall(".//svg:g", NS) if node.get("class") == "edge"]
    assert len(edges) == relation_count, stem
    relations = {}
    for edge in edges:
        key = (edge.get("data-from"), edge.get("data-to"))
        assert None not in key and key not in relations, (stem, key)
        values = (edge.get("data-from-cardinality"), edge.get("data-to-cardinality"))
        assert all(value in {"0..1", "1..1", "0..N", "1..N"} for value in values), key
        # Check the actual circles, not just the metadata written by the renderer.
        assert len(edge.findall("svg:ellipse", NS)) == sum(value.startswith("0") for value in values), key
        paths = edge.findall("svg:path", NS)
        assert len(paths) == 2 and paths[0].get("stroke") == "white", key
        assert paths[0].get("stroke-dasharray") is None, key
        relations[key] = (values, paths[1].get("stroke-dasharray") is None)
    return root, relations


logical, relations = load_view("skillswap-logical", 22, 40)
assert OPTIONAL <= {foreign for foreign, _ in relations}, "Reviewed optional relations missing"
for (foreign, parent), (values, solid) in relations.items():
    expected_child = f"{1 if foreign in REQUIRED_CHILD else 0}..{'1' if foreign in UNIQUE_FKS else 'N'}"
    expected_parent = "0..1" if foreign in OPTIONAL else "1..1"
    assert values == (expected_child, expected_parent), (foreign, parent, values)
    assert solid == (foreign in IDENTIFYING), foreign

conceptual, concept_relations = load_view("skillswap-conceptual", 19, 31)
cases = {
    ("User.id", "Profile.user_id"): ("1..1", "1..1"),
    ("User.id", "Wallet.owner_id"): ("0..1", "0..1"),
    ("Booking.id", "Rating.booking_id"): ("1..1", "0..1"),
    ("LedgerTransaction.reverses_transaction_id", "LedgerTransaction.id"): ("0..1", "0..1"),
    ("WithdrawalRequest.id", "LedgerTransaction.withdrawal_request_id"): ("0..1", "1..N"),
    ("Class.id", "ClassSkill.class_id"): ("1..1", "0..N"),
    ("LedgerTransaction.id", "LedgerPosting.transaction_id"): ("1..1", "0..N"),
    ("User.id", "SkillEvidence.reviewer_id"): ("0..1", "0..N"),
}
for key, expected in cases.items():
    assert concept_relations[key][0] == expected, (key, expected)

covered = {}
for domain, tables, count in [("identity", 9, 15), ("skills", 5, 6), ("learning", 7, 9), ("finance", 8, 15)]:
    _, focused = load_view(f"skillswap-logical-{domain}", tables, count)
    for key, value in focused.items():
        assert relations[key] == value, (domain, key)
    covered.update(focused)
assert covered == relations, "Focused views must cover every logical FK"

text = " ".join(logical.itertext())
for label in ["PK", "FK", "UQ1", "UQ2: (kind, idempotency_key)",
              "UQ1: (reverses_transaction_id)", "published: at least 1",
              "posted/reversed: at least 2", "original has 0..1 full reversal"]:
    assert label in text, label

for link in re.findall(r"\]\(([^)]+)\)", (ROOT / "README.md").read_text()):
    if not link.startswith(("https:", "http:", "#")):
        assert (ROOT / link.split("#")[0]).exists(), link

print("PASS: 6 SVGs; 40 logical and 31 conceptual relationships; all 16 nullable FKs")
print("PASS: actual optional circles, identifying styles, key labels and state annotations")
print("PASS: focused-view coverage and README links")
