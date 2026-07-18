"""Capture the two screenshots that failed the first pass: meds + desktop sidebar."""
import os
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = os.path.join(os.path.dirname(__file__), "screenshots")
TS = int(time.time())
PW = "supersecret123"
email = f"casey{TS}@example.com"


def signup(page):
    page.goto(f"{BASE}/signup")
    page.wait_for_selector("#name", timeout=15000)
    page.fill("#name", "Casey Kim")
    page.fill("#email", email)
    page.fill("#password", PW)
    page.fill("#age", "29")
    page.get_by_role("button", name="Sign up").click()
    page.wait_for_url("**/home", timeout=20000)


with sync_playwright() as p:
    browser = p.chromium.launch()

    # Mobile: meds with a reminder
    ctx = browser.new_context(viewport={"width": 420, "height": 880}, device_scale_factor=2)
    page = ctx.new_page()
    signup(page)
    page.goto(f"{BASE}/meds")
    page.wait_for_selector(".add-btn", timeout=15000)
    page.get_by_label("Add reminder").click()
    page.fill("input[placeholder*='Medication']", "Amoxicillin")
    page.fill("input[placeholder*='Dosage']", "500 mg")
    page.locator("form.form-grid button").click()   # the form's submit (unambiguous)
    page.wait_for_timeout(1200)
    page.screenshot(path=os.path.join(OUT, "07_meds.png"))
    print("shot: 07_meds")

    # Desktop: sidebar layout on home
    dctx = browser.new_context(viewport={"width": 1360, "height": 850}, device_scale_factor=1.5)
    dp = dctx.new_page()
    dp.goto(f"{BASE}/login")
    dp.wait_for_selector("#email", timeout=15000)
    dp.fill("#email", email)
    dp.fill("#password", PW)
    dp.get_by_role("button", name="Sign in").click()
    dp.get_by_text("How can we help").wait_for(timeout=30000)
    dp.wait_for_timeout(1500)
    dp.screenshot(path=os.path.join(OUT, "12_desktop_sidebar.png"))
    print("shot: 12_desktop_sidebar")

    browser.close()
print("done")
