"""Capture live screenshots of the running HealthNav app for the deck.

Requires the frontend (5173) + backend (8000) running.
Run: backend/.venv/Scripts/python.exe docs/capture_screenshots.py
Outputs PNGs into docs/screenshots/.
"""
import os
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(OUT, exist_ok=True)
TS = int(time.time())
PW = "supersecret123"

shots = []


def shot(page, name):
    path = os.path.join(OUT, f"{name}.png")
    page.screenshot(path=path)
    shots.append(name)
    print("  shot:", name)


def safe(fn, label):
    try:
        fn()
    except Exception as e:
        print(f"  [skip] {label}: {type(e).__name__}: {str(e)[:80]}")


def signup(page, name, email, role="patient", age="34"):
    page.goto(f"{BASE}/signup")
    page.wait_for_selector("#name", timeout=15000)
    if role == "doctor":
        page.get_by_role("button", name="I'm a doctor").click()
    page.fill("#name", name)
    page.fill("#email", email)
    page.fill("#password", PW)
    if role == "patient":
        page.fill("#age", age)
    return email


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------- Doctor account (created first so the patient can pick them) ----------
    doc_email = f"drsarah{TS}@example.com"
    dctx = browser.new_context(viewport={"width": 420, "height": 880}, device_scale_factor=2)
    dpage = dctx.new_page()
    safe(lambda: (signup(dpage, "Sarah Chen", doc_email, role="doctor"),
                  dpage.get_by_role("button", name="Sign up").click(),
                  dpage.wait_for_url("**/doctor", timeout=20000)), "doctor signup")

    # ---------- Patient flow ----------
    pat_email = f"jordan{TS}@example.com"
    ctx = browser.new_context(
        viewport={"width": 420, "height": 880}, device_scale_factor=2,
        geolocation={"latitude": 49.28, "longitude": -123.12}, permissions=["geolocation"],
    )
    page = ctx.new_page()

    signup(page, "Jordan Lee", pat_email, role="patient")
    shot(page, "01_signup")
    page.get_by_role("button", name="Sign up").click()
    page.wait_for_url("**/home", timeout=20000)
    page.wait_for_timeout(1200)
    shot(page, "02_home_light")

    # Dark mode
    def dark():
        page.get_by_label("Toggle dark mode").click()
        page.wait_for_timeout(600)
        shot(page, "03_home_dark")
        page.get_by_label("Toggle dark mode").click()
        page.wait_for_timeout(400)
    safe(dark, "dark mode")

    # Symptom checker (OpenBioLLM guidance)
    def triage():
        page.goto(f"{BASE}/triage")
        page.wait_for_selector(".chip", timeout=15000)
        page.locator(".chip", has_text="Fever").click()
        page.locator(".chip", has_text="Cough").click()
        page.fill("textarea", "sore throat and cough for two days")
        page.get_by_label("Get guidance").click()
        page.wait_for_selector(".result", timeout=60000)
        page.wait_for_timeout(1500)
        shot(page, "04_symptom_checker")
    safe(triage, "triage")

    # Health AI chat
    def chat():
        page.goto(f"{BASE}/chat")
        page.wait_for_selector(".chat-input input", timeout=15000)
        page.fill(".chat-input input", "I have a mild fever and sore throat, what should I do?")
        page.get_by_label("Send").click()
        # wait for a second assistant bubble (beyond the intro) — OpenBioLLM may cold-start
        page.wait_for_function("document.querySelectorAll('.bubble.assistant').length >= 2", timeout=60000)
        page.wait_for_timeout(1500)
        shot(page, "05_chat_openbiollm")
    safe(chat, "chat")

    # Nearby (live ED wait times)
    def nearby():
        page.goto(f"{BASE}/nearby")
        page.wait_for_selector(".wait-bar", timeout=20000)
        page.wait_for_timeout(800)
        shot(page, "06_nearby_waittimes")
    safe(nearby, "nearby")

    # Meds
    def meds():
        page.goto(f"{BASE}/meds")
        page.wait_for_selector(".add-btn", timeout=15000)
        page.get_by_label("Add reminder").click()
        page.fill("input[placeholder*='Medication']", "Amoxicillin")
        page.fill("input[placeholder*='Dosage']", "500 mg")
        page.get_by_role("button", name="Add reminder").click()
        page.wait_for_timeout(1000)
        shot(page, "07_meds")
    safe(meds, "meds")

    # Profile (My page) + pick doctor in edit
    def profile():
        page.goto(f"{BASE}/profile")
        page.wait_for_timeout(1200)
        shot(page, "08_profile_mypage")
        page.goto(f"{BASE}/profile/edit")
        page.wait_for_selector(".avatar-xl", timeout=15000)
        page.wait_for_timeout(600)
        shot(page, "09_edit_profile")
        # select the doctor
        page.locator("select").last.select_option(label="Dr. Sarah Chen")
        page.get_by_role("button", name="Save").click()
        page.wait_for_timeout(1200)
    safe(profile, "profile")

    # ---------- Doctor dashboard (now that patient linked) ----------
    def doctor_views():
        dpage.goto(f"{BASE}/doctor")
        dpage.wait_for_timeout(1500)
        shot(dpage, "10_doctor_dashboard")
        # open the patient
        dpage.locator(".activity-row").first.click()
        dpage.wait_for_timeout(1500)
        shot(dpage, "11_doctor_patient_history")
    safe(doctor_views, "doctor views")

    # ---------- Desktop responsive (sidebar) ----------
    def desktop():
        dctx2 = browser.new_context(viewport={"width": 1360, "height": 850}, device_scale_factor=1.5)
        dp = dctx2.new_page()
        dp.goto(f"{BASE}/login")
        dp.wait_for_selector("#email", timeout=15000)
        dp.fill("#email", pat_email)
        dp.fill("#password", PW)
        dp.get_by_role("button", name="Sign in").click()
        dp.wait_for_url("**/home", timeout=20000)
        dp.wait_for_timeout(1500)
        shot(dp, "12_desktop_sidebar")
    safe(desktop, "desktop")

    browser.close()

print(f"\nCaptured {len(shots)} screenshots into {OUT}")
for s in shots:
    print(" -", s)
