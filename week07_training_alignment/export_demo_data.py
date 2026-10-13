"""Every number the demo page shows, produced by the notebook's own code -> artifacts/demo_data.json.

    uv run python export_demo_data.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
D = {}
json.dump(D, open("artifacts/demo_data.json", "w"), ensure_ascii=False, separators=(",", ":"))
